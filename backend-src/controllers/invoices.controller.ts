import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { InventoryService } from '../services/inventory.service.js';

function createBusinessError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

const createInvoiceSchema = z.object({
  supplierId: z.string().uuid('ID de fornecedor inválido.'),
  number: z.string().optional(),
  issueDate: z.string().optional(),
  totalAmount: z.number().min(0, 'Valor total não pode ser negativo.'),
  notes: z.string().optional(),
  status: z.enum(['RECEIVED', 'PENDING', 'PENDING_REVIEW', 'LINKED', 'COMPLETED', 'CANCELED']).optional().default('RECEIVED'),
  items: z
    .array(
      z.object({
        ingredientId: z.string().uuid('ID de insumo inválido.'),
        quantity: z.number().positive('Quantidade deve ser maior que zero.'),
        unitCost: z.number().min(0, 'Custo unitário não pode ser negativo.'),
        totalCost: z.number().min(0, 'Custo total não pode ser negativo.'),
      }),
    )
    .optional()
    .default([]),
});

const updateInvoiceSchema = z.object({
  number: z.string().optional(),
  issueDate: z.string().optional(),
  totalAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
  status: z.enum(['RECEIVED', 'PENDING', 'PENDING_REVIEW', 'LINKED', 'COMPLETED', 'CANCELED']).optional(),
});

const linkPurchaseSchema = z.object({
  purchaseReceiptId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  status: z.enum(['LINKED', 'COMPLETED', 'PENDING_REVIEW', 'RECEIVED']).optional().default('LINKED'),
  notes: z.string().optional(),
});

export const InvoicesController = {
  async getInvoices(req: Request, res: Response) {
    const tenantId = getTenantId();
    const { status, supplierId } = req.query as Record<string, string | undefined>;

    const invoices = await prisma.inboundInvoice.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(supplierId ? { supplierId } : {}),
      },
      include: {
        supplier: true,
        items: { include: { ingredient: { select: { id: true, name: true, unit: true } } } },
        purchaseReceipts: {
          include: {
            purchaseOrder: { select: { id: true, status: true, expectedDate: true } },
          },
        },
      },
      orderBy: { issueDate: 'desc' },
    });

    res.json(invoices);
  },

  async getInvoiceById(req: Request, res: Response) {
    const tenantId = getTenantId();
    const id = String(req.params['id']);

    const invoice = await prisma.inboundInvoice.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        items: { include: { ingredient: true } },
        purchaseReceipts: {
          include: {
            purchaseOrder: true,
            lines: { include: { ingredient: true } },
          },
        },
      },
    });

    if (!invoice) {
      throw createBusinessError('Nota fiscal não encontrada para esta loja.', 404);
    }

    res.json(invoice);
  },

  async createInvoice(req: Request, res: Response) {
    const tenantId = getTenantId();
    const payload = createInvoiceSchema.parse(req.body);

    const invoice = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id: payload.supplierId, tenantId, isActive: true },
        select: { id: true },
      });

      if (!supplier) {
        throw createBusinessError('Fornecedor não encontrado ou inativo nesta loja.', 404);
      }

      if (payload.items.length > 0) {
        const ingredientIds = [...new Set(payload.items.map((item) => item.ingredientId))];
        const ingredients = await tx.ingredient.findMany({
          where: { id: { in: ingredientIds }, tenantId },
          select: { id: true },
        });
        if (ingredients.length !== ingredientIds.length) {
          throw createBusinessError('Um ou mais insumos não pertencem a esta loja.', 400);
        }
      }

      const inv = await tx.inboundInvoice.create({
        data: {
          tenantId,
          supplierId: payload.supplierId,
          number: payload.number ?? null,
          issueDate: payload.issueDate ? new Date(payload.issueDate) : new Date(),
          totalAmount: payload.totalAmount,
          notes: payload.notes ?? null,
          status: payload.status,
          items: {
            create: payload.items.map((i) => ({
              ingredientId: i.ingredientId,
              quantity: i.quantity,
              unitCost: i.unitCost,
              totalCost: i.totalCost,
            })),
          },
        },
        include: { supplier: true, items: { include: { ingredient: true } } },
      });

      // Se houver itens na nota, movimentar o estoque automaticamente
      for (const item of payload.items) {
        await InventoryService.moveStock(
          {
            tenantId,
            ingredientId: item.ingredientId,
            type: 'INBOUND_INVOICE',
            quantity: item.quantity,
            cost: item.unitCost,
            notes: `Entrada direta NF ${payload.number ?? 'S/N'}`,
            referenceType: 'INBOUND_INVOICE',
            referenceId: inv.id,
            idempotencyKey: `INBOUND_INVOICE:${inv.id}:INGREDIENT:${item.ingredientId}`,
          },
          tx,
        );
      }

      return inv;
    });

    res.status(201).json(invoice);
  },

  async updateInvoice(req: Request, res: Response) {
    const tenantId = getTenantId();
    const id = String(req.params['id']);
    const payload = updateInvoiceSchema.parse(req.body);

    const existing = await prisma.inboundInvoice.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw createBusinessError('Nota fiscal não encontrada para esta loja.', 404);
    }

    const updated = await prisma.inboundInvoice.update({
      where: { id },
      data: {
        ...(payload.number !== undefined ? { number: payload.number } : {}),
        ...(payload.issueDate ? { issueDate: new Date(payload.issueDate) } : {}),
        ...(payload.totalAmount !== undefined ? { totalAmount: payload.totalAmount } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
        ...(payload.status ? { status: payload.status } : {}),
      },
      include: { supplier: true, items: { include: { ingredient: true } } },
    });

    res.json(updated);
  },

  async linkPurchase(req: Request, res: Response) {
    const tenantId = getTenantId();
    const id = String(req.params['id']);
    const payload = linkPurchaseSchema.parse(req.body);

    const invoice = await prisma.inboundInvoice.findFirst({
      where: { id, tenantId },
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
        data: { inboundInvoiceId: id },
      });
    }

    const newNotes = payload.notes
      ? `${invoice.notes ? invoice.notes + ' | ' : ''}${payload.notes}`
      : invoice.notes;

    const updated = await prisma.inboundInvoice.update({
      where: { id },
      data: {
        status: payload.status,
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
