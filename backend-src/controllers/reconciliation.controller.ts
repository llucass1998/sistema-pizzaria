import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getTenantId } from '../core/context/TenantContext.js';

function createBusinessError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

const matchSchema = z.object({
  inboundInvoiceId: z.string().uuid('ID da nota fiscal inválido.'),
  purchaseOrderId: z.string().uuid().optional(),
  purchaseReceiptId: z.string().uuid().optional(),
  accountPayableId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const unmatchSchema = z.object({
  inboundInvoiceId: z.string().uuid('ID da nota fiscal inválido.'),
  purchaseReceiptId: z.string().uuid().optional(),
  reason: z.string().optional(),
});

export const ReconciliationController = {
  async getSummary(_req: Request, res: Response) {
    const tenantId = getTenantId();

    const [invoices, orders, payables] = await Promise.all([
      prisma.inboundInvoice.findMany({
        where: { tenantId },
        include: {
          supplier: { select: { id: true, name: true, cnpj: true } },
          purchaseReceipts: {
            include: {
              purchaseOrder: { select: { id: true, totalAmount: true, status: true, expectedDate: true } },
            },
          },
        },
        orderBy: { issueDate: 'desc' },
      }),
      prisma.purchaseOrder.findMany({
        where: { tenantId, status: { not: 'CANCELED' } },
        include: {
          supplier: { select: { id: true, name: true } },
          receipts: {
            include: {
              inboundInvoice: { select: { id: true, number: true, totalAmount: true, status: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.accountPayable.findMany({
        where: { tenantId, status: { in: ['PENDING', 'OVERDUE'] } },
        include: {
          supplier: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    const unlinkedInvoices: any[] = [];
    const linkedInvoices: any[] = [];
    const divergentIssues: any[] = [];

    let matchedAmount = 0;
    let divergentAmount = 0;

    for (const inv of invoices) {
      const invTotal = Number(inv.totalAmount || 0);
      const isLinked = inv.purchaseReceipts && inv.purchaseReceipts.length > 0;

      if (inv.status === 'LINKED' || inv.status === 'COMPLETED' || isLinked) {
        matchedAmount += invTotal;
        linkedInvoices.push(inv);

        // Verificar divergência de valores com o pedido vinculado
        for (const r of inv.purchaseReceipts) {
          if (r.purchaseOrder) {
            const poTotal = Number(r.purchaseOrder.totalAmount || 0);
            if (Math.abs(invTotal - poTotal) > 0.05) {
              const diff = Math.abs(invTotal - poTotal);
              divergentAmount += diff;
              divergentIssues.push({
                id: `div-${inv.id}-${r.purchaseOrder.id}`,
                type: 'VALUE_MISMATCH',
                title: `Divergência de Valor: NF ${inv.number || inv.id.slice(0, 8)} vs Pedido #${r.purchaseOrder.id.slice(0, 8)}`,
                description: `Valor na Nota Fiscal (R$ ${invTotal.toFixed(2)}) não bate com o Pedido de Compra (R$ ${poTotal.toFixed(2)}).`,
                invoiceId: inv.id,
                purchaseOrderId: r.purchaseOrder.id,
                supplierName: inv.supplier.name,
                differenceAmount: diff,
                status: 'DIVERGENT',
              });
            }
          }
        }
      } else {
        unlinkedInvoices.push({
          id: inv.id,
          number: inv.number || 'S/N',
          supplier: inv.supplier,
          issueDate: inv.issueDate,
          totalAmount: invTotal,
          status: inv.status,
        });
      }
    }

    const unlinkedPurchases: any[] = [];
    let pendingAmount = 0;

    for (const po of orders) {
      const poTotal = Number(po.totalAmount || 0);
      const hasInvoice = po.receipts.some((r) => r.inboundInvoiceId || r.inboundInvoice);

      if (!hasInvoice && po.status !== 'PAID') {
        pendingAmount += poTotal;
        unlinkedPurchases.push({
          id: po.id,
          supplier: po.supplier,
          totalAmount: poTotal,
          expectedDate: po.expectedDate || po.createdAt,
          status: po.status,
        });
      }
    }

    const pendingPayablesTotal = payables.reduce((sum, p) => sum + Number(p.remainingAmount || p.amount || 0), 0);
    pendingAmount += pendingPayablesTotal;

    res.json({
      summary: {
        matchedCount: linkedInvoices.length,
        matchedAmount,
        pendingCount: unlinkedPurchases.length + unlinkedInvoices.length + payables.length,
        pendingAmount,
        divergentCount: divergentIssues.length,
        divergentAmount,
      },
      unlinkedInvoices,
      unlinkedPurchases,
      pendingPayables: payables.map((p) => ({
        id: p.id,
        supplier: p.supplier,
        description: p.description,
        amount: Number(p.amount || 0),
        remainingAmount: Number(p.remainingAmount || p.amount || 0),
        dueDate: p.dueDate,
        status: p.status,
      })),
      issues: divergentIssues,
    });
  },

  async getIssues(req: Request, res: Response) {
    // Retorna apenas divergências chamando a lógica do summary
    await ReconciliationController.getSummary(req, res);
  },

  async match(req: Request, res: Response) {
    const tenantId = getTenantId();
    const payload = matchSchema.parse(req.body);

    const invoice = await prisma.inboundInvoice.findFirst({
      where: { id: payload.inboundInvoiceId, tenantId },
      select: { id: true, notes: true },
    });

    if (!invoice) {
      throw createBusinessError('Nota fiscal não encontrada para esta loja.', 404);
    }

    if (payload.purchaseReceiptId) {
      const receipt = await prisma.purchaseReceipt.findFirst({
        where: { id: payload.purchaseReceiptId, tenantId },
        select: { id: true },
      });
      if (!receipt) {
        throw createBusinessError('Recibo de compra não encontrado para esta loja.', 404);
      }
      await prisma.purchaseReceipt.update({
        where: { id: payload.purchaseReceiptId },
        data: { inboundInvoiceId: payload.inboundInvoiceId },
      });
    } else if (payload.purchaseOrderId) {
      // Se informou apenas o pedido, verificar se já tem um recibo ou criar vínculo no primeiro recibo
      const firstReceipt = await prisma.purchaseReceipt.findFirst({
        where: { purchaseOrderId: payload.purchaseOrderId, tenantId },
        orderBy: { createdAt: 'desc' },
      });
      if (firstReceipt) {
        await prisma.purchaseReceipt.update({
          where: { id: firstReceipt.id },
          data: { inboundInvoiceId: payload.inboundInvoiceId },
        });
      }
    }

    if (payload.accountPayableId) {
      const payable = await prisma.accountPayable.findFirst({
        where: { id: payload.accountPayableId, tenantId },
        select: { id: true },
      });
      if (payable) {
        await prisma.accountPayable.update({
          where: { id: payload.accountPayableId },
          data: { status: 'PAID', paidAt: new Date(), remainingAmount: 0 },
        });
      }
    }

    const newNotes = payload.notes
      ? `${invoice.notes ? invoice.notes + ' | ' : ''}Conciliado: ${payload.notes}`
      : invoice.notes;

    const updated = await prisma.inboundInvoice.update({
      where: { id: payload.inboundInvoiceId },
      data: {
        status: 'LINKED',
        ...(newNotes ? { notes: newNotes } : {}),
      },
      include: {
        supplier: true,
        purchaseReceipts: { include: { purchaseOrder: true } },
      },
    });

    res.json(updated);
  },

  async unmatch(req: Request, res: Response) {
    const tenantId = getTenantId();
    const payload = unmatchSchema.parse(req.body);

    const invoice = await prisma.inboundInvoice.findFirst({
      where: { id: payload.inboundInvoiceId, tenantId },
      select: { id: true, notes: true },
    });

    if (!invoice) {
      throw createBusinessError('Nota fiscal não encontrada para esta loja.', 404);
    }

    if (payload.purchaseReceiptId) {
      await prisma.purchaseReceipt.updateMany({
        where: { id: payload.purchaseReceiptId, tenantId },
        data: { inboundInvoiceId: null },
      });
    } else {
      // Desvincular de todos os recibos da loja
      await prisma.purchaseReceipt.updateMany({
        where: { inboundInvoiceId: payload.inboundInvoiceId, tenantId },
        data: { inboundInvoiceId: null },
      });
    }

    const newNotes = payload.reason
      ? `${invoice.notes ? invoice.notes + ' | ' : ''}Desconciliado: ${payload.reason}`
      : invoice.notes;

    const updated = await prisma.inboundInvoice.update({
      where: { id: payload.inboundInvoiceId },
      data: {
        status: 'PENDING_REVIEW',
        ...(newNotes ? { notes: newNotes } : {}),
      },
      include: {
        supplier: true,
        purchaseReceipts: { include: { purchaseOrder: true } },
      },
    });

    res.json(updated);
  },
};
