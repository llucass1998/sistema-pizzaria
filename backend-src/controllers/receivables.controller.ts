import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '../../generated/prisma/index.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { calculatePaymentState } from '../services/orderFinancial.service.js';

const recordPaymentSchema = z.object({
  amount: z.number().min(0.01),
  method: z.string().min(1),
});

const updateInvoiceSchema = z.object({
  dueDate: z.string().optional().nullable(),
  totalAmount: z.number().min(0.01).optional(),
  status: z.string().optional(),
});

function createBusinessError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

export const ReceivablesController = {
  async getInvoices(req: Request, res: Response) {
    const tenantId = getTenantId();
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      tenantId,
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(startDate || endDate
        ? {
            issueDate: {
              ...(startDate ? { gte: new Date(`${startDate}T00:00:00.000Z`) } : {}),
              ...(endDate ? { lte: new Date(`${endDate}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { id: { contains: search } },
              { orderId: { contains: search } },
              { order: { customer: { name: { contains: search, mode: 'insensitive' } } } },
              { order: { customer: { phone: { contains: search } } } },
            ],
          }
        : {}),
    };

    const wantsPagination =
      req.query.paginated === 'true' || req.query.page !== undefined || req.query.limit !== undefined;

    if (!wantsPagination) {
      const allInvoices = await prisma.invoice.findMany({
        where,
        include: {
          order: {
            include: { customer: true },
          },
          payments: true,
        },
        orderBy: { issueDate: 'desc' },
      });
      return res.json(allInvoices);
    }

    const [total, data] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        include: {
          order: {
            include: { customer: true },
          },
          payments: true,
        },
        orderBy: { issueDate: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },

  async getSummary(_req: Request, res: Response) {
    const tenantId = getTenantId();
    const invoices = await prisma.invoice.findMany({
      where: { tenantId },
      include: { payments: true },
    });

    const now = new Date();
    let totalPending = 0;
    let totalPaid = 0;
    let totalOverdue = 0;
    let countPending = 0;
    let countPaid = 0;
    let countOverdue = 0;

    for (const inv of invoices) {
      const invTotal = Number(inv.totalAmount);
      const paid = inv.payments
        .filter((p) => p.status === 'COMPLETED' || p.status === 'PAID')
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const remaining = Math.max(0, invTotal - paid);

      if (inv.status === 'PAID' || inv.status === 'COMPLETED' || remaining <= 0.009) {
        totalPaid += invTotal;
        countPaid++;
      } else if (inv.status !== 'CANCELED') {
        totalPending += remaining;
        countPending++;
        if (inv.dueDate && new Date(inv.dueDate) < now) {
          totalOverdue += remaining;
          countOverdue++;
        }
      }
    }

    res.json({
      totalPending: Number(totalPending.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      totalOverdue: Number(totalOverdue.toFixed(2)),
      countPending,
      countPaid,
      countOverdue,
      totalInvoices: invoices.length,
    });
  },

  async recordPayment(req: Request, res: Response) {
    const tenantId = getTenantId();
    const invoiceId = req.params.invoiceId as string;
    const payload = recordPaymentSchema.parse(req.body);

    const invoice = await prisma.$transaction(async (tx) => {
      const currentInvoice = await tx.invoice.findFirstOrThrow({
        where: { id: invoiceId, tenantId },
        include: { payments: true },
      });

      const totalPaidBefore = currentInvoice.payments.reduce(
        (acc: number, p: { amount: unknown }) => acc + Number(p.amount),
        0,
      );
      const totalAmount = Number(currentInvoice.totalAmount);
      const remaining = Math.max(0, totalAmount - totalPaidBefore);

      if (remaining <= 0 || ['PAID', 'COMPLETED'].includes(currentInvoice.status)) {
        throw createBusinessError('Esta fatura ja esta paga.');
      }

      if (Number(payload.amount) > remaining) {
        throw createBusinessError('O pagamento nao pode exceder o saldo restante.');
      }

      await tx.payment.create({
        data: {
          invoiceId,
          amount: payload.amount,
          method: payload.method,
        },
      });

      const totalPaid = totalPaidBefore + Number(payload.amount);
      const paymentState = calculatePaymentState(totalAmount, totalPaid);
      const paidAt = paymentState.orderPaymentStatus === 'PAID' ? new Date() : null;

      await tx.invoice.updateMany({
        where: { id: invoiceId, tenantId },
        data: { status: paymentState.invoiceStatus },
      });

      if (currentInvoice.orderId) {
        await tx.order.updateMany({
          where: { id: currentInvoice.orderId, tenantId },
          data: {
            paymentMethod: payload.method,
            paymentStatus: paymentState.orderPaymentStatus,
            ...(paidAt ? { paidAt } : {}),
          },
        });
      }

      return tx.invoice.findFirstOrThrow({
        where: { id: invoiceId, tenantId },
        include: { payments: true, order: { include: { customer: true } } },
      });
    });

    res.json(invoice);
  },

  async updateInvoice(req: Request, res: Response) {
    const tenantId = getTenantId();
    const id = req.params.id as string;
    const payload = updateInvoiceSchema.parse(req.body);

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoice.findFirstOrThrow({
        where: { id, tenantId },
      });

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          ...(payload.dueDate !== undefined
            ? { dueDate: payload.dueDate ? new Date(payload.dueDate) : null }
            : {}),
          ...(payload.totalAmount !== undefined ? { totalAmount: payload.totalAmount } : {}),
          ...(payload.status ? { status: payload.status } : {}),
        },
        include: { payments: true, order: { include: { customer: true } } },
      });

      const totalPaid = updated.payments.reduce((acc, p) => acc + Number(p.amount), 0);
      const paymentState = calculatePaymentState(Number(updated.totalAmount), totalPaid);

      if (!payload.status) {
        await tx.invoice.update({
          where: { id },
          data: { status: paymentState.invoiceStatus },
        });
        updated.status = paymentState.invoiceStatus;
      }

      if (updated.orderId) {
        await tx.order.updateMany({
          where: { id: updated.orderId, tenantId },
          data: {
            paymentStatus: paymentState.orderPaymentStatus,
          },
        });
      }

      return updated;
    });

    res.json(invoice);
  },

  async reversePayment(req: Request, res: Response) {
    const tenantId = getTenantId();
    const invoiceId = req.params.invoiceId as string;
    const paymentId = req.params.paymentId as string;

    const invoice = await prisma.$transaction(async (tx) => {
      const currentInvoice = await tx.invoice.findFirstOrThrow({
        where: { id: invoiceId, tenantId },
        include: { payments: true },
      });

      const payment = currentInvoice.payments.find((p) => p.id === paymentId);
      if (!payment) {
        throw createBusinessError('Pagamento nao encontrado para esta fatura.', 404);
      }

      await tx.payment.delete({
        where: { id: paymentId },
      });

      const remainingPayments = currentInvoice.payments.filter((p) => p.id !== paymentId);
      const totalPaid = remainingPayments.reduce((acc, p) => acc + Number(p.amount), 0);
      const totalAmount = Number(currentInvoice.totalAmount);
      const paymentState = calculatePaymentState(totalAmount, totalPaid);

      await tx.invoice.updateMany({
        where: { id: invoiceId, tenantId },
        data: { status: paymentState.invoiceStatus },
      });

      if (currentInvoice.orderId) {
        await tx.order.updateMany({
          where: { id: currentInvoice.orderId, tenantId },
          data: {
            paymentStatus: paymentState.orderPaymentStatus,
          },
        });
      }

      return tx.invoice.findFirstOrThrow({
        where: { id: invoiceId, tenantId },
        include: { payments: true, order: { include: { customer: true } } },
      });
    });

    res.json(invoice);
  },
};
