import { Request, Response } from 'express';
import { basePrisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';
import {
  centsToMoney,
  FINANCIAL_STATUS,
  moneyToCents,
  normalizePaymentMethod,
  normalizePaymentTransactionType,
} from '../services/orderFinancial.service.js';
import { PaymentGatewayService } from '../services/PaymentGatewayService.js';
import { emitOrderEvent } from '../services/orderEvents.service.js';

function getPaymentStatusForOrder(status: string) {
  if (status === 'APPROVED') return FINANCIAL_STATUS.PAID;
  if (status === 'REFUNDED') return FINANCIAL_STATUS.REFUNDED;
  if (status === 'CANCELED' || status === 'CHARGED_BACK' || status === 'REJECTED') {
    return FINANCIAL_STATUS.CANCELED;
  }
  return FINANCIAL_STATUS.PENDING;
}

function shouldCreateFinancialPayment(status: string) {
  return status === 'APPROVED';
}

export const WebhookController = {
  /**
   * Endpoint publico de provedores de pagamento.
   * O provider valida a assinatura antes de qualquer conciliacao financeira.
   */
  async handlePaymentWebhook(req: Request, res: Response) {
    try {
      const event = await PaymentGatewayService.normalizeWebhook(req);

      logger.info('[Webhook] Pagamento recebido', {
        provider: event.provider,
        eventId: event.eventId,
        externalId: event.externalId,
        status: event.status,
      });

      const webhookEvent = await basePrisma.paymentWebhookEvent
        .create({
          data: {
            provider: event.provider,
            eventId: event.eventId,
            externalId: event.externalId,
            status: 'RECEIVED',
            payload: event.payload as any,
          },
        })
        .catch((error: any) => {
          if (error?.code === 'P2002') return null;
          throw error;
        });

      if (!webhookEvent) {
        return res.status(200).json({ message: 'Webhook duplicado ignorado.' });
      }

      const paymentTransaction = await basePrisma.paymentTransaction.findFirst({
        where: {
          provider: event.provider,
          externalId: event.externalId,
        },
        select: {
          tenantId: true,
          orderId: true,
        },
      });

      const order = await basePrisma.order.findFirst({
        where: paymentTransaction
          ? {
              id: paymentTransaction.orderId,
              tenantId: paymentTransaction.tenantId,
            }
          : {
              paymentProvider: event.provider,
              paymentExternalId: event.externalId,
            },
        include: {
          invoice: { include: { payments: true } },
          paymentTransactions: true,
        },
      });

      if (!order) {
        await basePrisma.paymentWebhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            status: 'FAILED',
            error: `Pedido nao encontrado para externalId ${event.externalId}`,
            processedAt: new Date(),
          },
        });
        logger.warn('[Webhook] Pedido nao encontrado', {
          provider: event.provider,
          externalId: event.externalId,
          orderId: event.orderId,
        });
        return res.status(202).json({ message: 'Webhook recebido; pedido ainda nao localizado.' });
      }

      const paidAt = new Date();
      const method = normalizePaymentMethod(order.paymentMethod, 'ONLINE_CARD');
      const transactionType = normalizePaymentTransactionType(
        event.transactionType,
        event.paymentMode === 'DEPOSIT' ? 'DEPOSIT_PAYMENT' : 'FULL_PAYMENT',
      );
      const nextPaymentStatus = getPaymentStatusForOrder(event.status);

      await basePrisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} AND "tenantId" = ${order.tenantId} FOR UPDATE`;

        const currentOrder = await tx.order.findFirst({
          where: { id: order.id, tenantId: order.tenantId },
          include: { invoice: { include: { payments: true } } },
        });

        if (!currentOrder) {
          throw new Error('Pedido nao encontrado durante o processamento do webhook.');
        }

        const currentTransaction = await tx.paymentTransaction.findUnique({
          where: {
            tenantId_provider_externalId: {
              tenantId: order.tenantId,
              provider: event.provider,
              externalId: event.externalId,
            },
          },
        });
        const currentTransactionType = normalizePaymentTransactionType(
          currentTransaction?.type ?? transactionType,
          event.paymentMode === 'DEPOSIT' ? 'DEPOSIT_PAYMENT' : 'FULL_PAYMENT',
        );
        const currentApprovedAmountCents = moneyToCents(
          event.amount ?? currentTransaction?.amount ?? currentOrder.total,
        );
        const alreadyPaid = currentTransaction?.status === FINANCIAL_STATUS.PAID;

        await tx.paymentWebhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            tenantId: currentOrder.tenantId,
            status: 'PROCESSING',
          },
        });

        await tx.paymentTransaction.upsert({
          where: {
            tenantId_provider_externalId: {
              tenantId: currentOrder.tenantId,
              provider: event.provider,
              externalId: event.externalId,
            },
          },
          update: {
            type: currentTransactionType,
            status: nextPaymentStatus,
            rawStatus: event.rawStatus,
            amount: Number(event.amount ?? currentOrder.total).toFixed(2),
            paidAt: event.status === 'APPROVED' ? (currentTransaction?.paidAt ?? paidAt) : currentTransaction?.paidAt,
            metadata: event.payload as any,
          },
          create: {
            tenantId: currentOrder.tenantId,
            orderId: currentOrder.id,
            provider: event.provider,
            externalId: event.externalId,
            type: currentTransactionType,
            amount: Number(event.amount ?? currentOrder.total).toFixed(2),
            status: nextPaymentStatus,
            rawStatus: event.rawStatus,
            idempotencyKey: `${currentOrder.id}:${currentTransactionType}`,
            paidAt: event.status === 'APPROVED' ? paidAt : null,
            metadata: event.payload as any,
          },
        });

        const currentAmountPaidCents = moneyToCents((currentOrder as any).amountPaid ?? 0);
        const currentAmountDueCents = moneyToCents((currentOrder as any).amountDue ?? currentOrder.total);
        const totalCents = moneyToCents(currentOrder.total);
        const deltaPaidCents =
          event.status === 'APPROVED' && !alreadyPaid ? currentApprovedAmountCents : 0;
        const amountPaidCents =
          currentTransactionType === 'FULL_PAYMENT' && event.status === 'APPROVED'
            ? totalCents
            : Math.min(totalCents, currentAmountPaidCents + deltaPaidCents);
        const amountDueCents =
          currentTransactionType === 'FULL_PAYMENT' && event.status === 'APPROVED'
            ? 0
            : Math.max(0, currentAmountDueCents - deltaPaidCents);
        const orderPaymentStatus =
          event.status === 'APPROVED'
            ? amountDueCents === 0
              ? FINANCIAL_STATUS.PAID
              : FINANCIAL_STATUS.PARTIALLY_PAID
            : nextPaymentStatus;

        await tx.order.update({
          where: { id: currentOrder.id },
          data: {
            status:
              event.status === 'APPROVED' && currentOrder.status === 'PENDING'
                ? 'PREPARING'
                : currentOrder.status,
            paymentMethod: method,
            paymentStatus: orderPaymentStatus,
            amountPaid: centsToMoney(amountPaidCents).toFixed(2),
            amountDue: centsToMoney(amountDueCents).toFixed(2),
            remainingPaymentStatus:
              currentOrder.paymentMode === 'DEPOSIT'
                ? amountDueCents === 0
                  ? FINANCIAL_STATUS.PAID
                  : 'PENDING'
                : 'NOT_APPLICABLE',
            paidAt: event.status === 'APPROVED' ? (currentOrder.paidAt ?? paidAt) : currentOrder.paidAt,
            paymentExternalId: event.externalId,
          },
        });

        const invoice = await tx.invoice.upsert({
          where: { orderId: currentOrder.id },
          update: { status: orderPaymentStatus },
          create: {
            tenantId: currentOrder.tenantId,
            orderId: currentOrder.id,
            totalAmount: currentOrder.total,
            status: orderPaymentStatus,
          },
          include: { payments: true },
        });

        if (shouldCreateFinancialPayment(event.status) && !alreadyPaid) {
          const totalPaid = invoice.payments.reduce(
            (sum, payment) => sum + Number(payment.amount),
            0,
          );
          const remaining = Math.min(
            centsToMoney(currentApprovedAmountCents),
            Number(currentOrder.total) - totalPaid,
          );
          if (remaining > 0.009) {
            await tx.payment.create({
              data: {
                invoiceId: invoice.id,
                amount: remaining.toFixed(2),
                method,
                status: 'COMPLETED',
                paymentDate: paidAt,
              },
            });
          }
        }

        await tx.paymentWebhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            tenantId: currentOrder.tenantId,
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
      });

      const newOrderStatus =
        event.status === 'APPROVED' && order.status === 'PENDING' ? 'PREPARING' : order.status;
      const emittedPaymentStatus =
        event.status === 'APPROVED' && transactionType === 'DEPOSIT_PAYMENT'
          ? FINANCIAL_STATUS.PARTIALLY_PAID
          : nextPaymentStatus;
      emitOrderEvent(order.tenantId, 'order-updated', {
        id: order.id,
        status: newOrderStatus,
        paymentStatus: emittedPaymentStatus,
      } as any);
      if (newOrderStatus !== order.status) {
        emitOrderEvent(order.tenantId, 'order-status-changed', {
          orderId: order.id,
          status: newOrderStatus,
          oldStatus: order.status,
        } as any);
      }

      res.status(200).json({ message: 'Webhook processado com sucesso.' });
    } catch (error) {
      logger.error('[Webhook] Erro ao processar pagamento:', error);
      res.status(400).json({ message: 'Webhook invalido ou nao processado.' });
    }
  },
};
