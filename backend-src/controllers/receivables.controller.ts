import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getTenantId } from '../core/context/TenantContext.js';

const recordPaymentSchema = z.object({
  amount: z.number().min(0.01),
  method: z.string().min(1),
});

function createBusinessError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

export const ReceivablesController = {
  async getInvoices(req: Request, res: Response) {
    const tenantId = getTenantId();
    const { status } = req.query;

    const invoices = await prisma.invoice.findMany({
      where: { 
        tenantId,
        ...(status ? { status: status as string } : {})
      },
      include: { 
        order: {
          include: { customer: true }
        },
        payments: true 
      },
      orderBy: { dueDate: 'asc' }
    });
    res.json(invoices);
  },

  async recordPayment(req: Request, res: Response) {
    const tenantId = getTenantId();
    const invoiceId = req.params.invoiceId as string;
    const payload = recordPaymentSchema.parse(req.body);

    const invoice = await prisma.$transaction(async (tx) => {
      const currentInvoice = await tx.invoice.findFirstOrThrow({
        where: { id: invoiceId, tenantId },
        include: { payments: true }
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
          method: payload.method
        }
      });

      const totalPaid = totalPaidBefore + Number(payload.amount);
      const newStatus = totalPaid >= totalAmount ? 'PAID' : 'PARTIAL';

      await tx.invoice.updateMany({
        where: { id: invoiceId, tenantId },
        data: { status: newStatus }
      });

      return tx.invoice.findFirstOrThrow({
        where: { id: invoiceId, tenantId },
        include: { payments: true }
      });
    });

    res.json(invoice);
  }
};
