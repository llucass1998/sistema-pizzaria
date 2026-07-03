import { Request, Response } from 'express';
import { basePrisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';
import { FINANCIAL_STATUS, normalizePaymentMethod } from '../services/orderFinancial.service.js';
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

      const order = await basePrisma.order.findFirst({
        where: event.orderId
          ? { id: event.orderId }
          : {
              OR: [
                { paymentExternalId: event.externalId },
                {
                  paymentTransactions: {
                    some: {
                      provider: event.provider,
                      externalId: event.externalId,
                    },
                  },
                },
              ],
            },
        include: { invoice: { include: { payments: true } } },
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
      const nextPaymentStatus = getPaymentStatusForOrder(event.status);

      await basePrisma.$transaction(async (tx) => {
        await tx.paymentWebhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            tenantId: order.tenantId,
            status: 'PROCESSING',
          },
        });

        await tx.paymentTransaction.upsert({
          where: {
            tenantId_provider_externalId: {
              tenantId: order.tenantId,
              provider: event.provider,
              externalId: event.externalId,
            },
          },
          update: {
            status: nextPaymentStatus,
            rawStatus: event.rawStatus,
            amount: Number(event.amount ?? order.total).toFixed(2),
            metadata: event.payload as any,
          },
          create: {
            tenantId: order.tenantId,
            orderId: order.id,
            provider: event.provider,
            externalId: event.externalId,
            amount: Number(event.amount ?? order.total).toFixed(2),
            status: nextPaymentStatus,
            rawStatus: event.rawStatus,
            metadata: event.payload as any,
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            status:
              event.status === 'APPROVED' && order.status === 'PENDING'
                ? 'PREPARING'
                : order.status,
            paymentMethod: method,
            paymentStatus: nextPaymentStatus,
            paidAt: event.status === 'APPROVED' ? paidAt : order.paidAt,
            paymentExternalId: event.externalId,
          },
        });

        const invoice = await tx.invoice.upsert({
          where: { orderId: order.id },
          update: { status: nextPaymentStatus },
          create: {
            tenantId: order.tenantId,
            orderId: order.id,
            totalAmount: order.total,
            status: nextPaymentStatus,
          },
          include: { payments: true },
        });

        if (shouldCreateFinancialPayment(event.status)) {
          const totalPaid = invoice.payments.reduce(
            (sum, payment) => sum + Number(payment.amount),
            0,
          );
          const remaining = Number(order.total) - totalPaid;
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
            tenantId: order.tenantId,
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
      });

      const newOrderStatus = event.status === 'APPROVED' && order.status === 'PENDING' ? 'PREPARING' : order.status;
      emitOrderEvent(order.tenantId, 'order-updated', { id: order.id, status: newOrderStatus, paymentStatus: nextPaymentStatus } as any);
      if (newOrderStatus !== order.status) {
        emitOrderEvent(order.tenantId, 'order-status-changed', { orderId: order.id, status: newOrderStatus, oldStatus: order.status } as any);
      }

      res.status(200).json({ message: 'Webhook processado com sucesso.' });
    } catch (error) {
      logger.error('[Webhook] Erro ao processar pagamento:', error);
      res.status(400).json({ message: 'Webhook invalido ou nao processado.' });
    }
  },
};
