import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { InventoryService } from '../services/inventory.service.js';
import { PurchasingService } from '../services/purchasing.service.js';

// ─── Schemas de validação ─────────────────────────────────────────────────────

const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do fornecedor.'),
  cnpj: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
});

const createInboundInvoiceSchema = z.object({
  supplierId: z.string(),
  number: z.string().optional(),
  issueDate: z.string().optional(),
  totalAmount: z.number().min(0),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        ingredientId: z.string(),
        quantity: z.number().positive(),
        unitCost: z.number().min(0),
        totalCost: z.number().min(0),
      }),
    )
    .min(1, 'Adicione pelo menos um item a nota.'),
});

const rfqItemSchema = z.object({
  ingredientId: z.string().uuid('ID de insumo inválido.'),
  quantityRequested: z.number().positive('Quantidade deve ser maior que zero.'),
  unitCostEstimate: z.number().min(0).optional(),
});

const createRFQSchema = z.object({
  supplierId: z.string().uuid().optional(),
  notes: z.string().optional(),
  expectedDate: z.string().optional(),
  items: z.array(rfqItemSchema).min(1, 'Adicione pelo menos um item ao RFQ.'),
});

const updateRFQStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'REJECTED'] as const, {
    message: 'Status inválido. Use DRAFT, SENT, APPROVED ou REJECTED.',
  }),
  notes: z.string().optional(),
});

const poItemSchema = z.object({
  ingredientId: z.string().uuid('ID de insumo inválido.'),
  quantityOrdered: z.number().positive('Quantidade deve ser maior que zero.'),
  unitCost: z.number().min(0),
});

const createPOSchema = z.object({
  supplierId: z.string().uuid('ID de fornecedor inválido.'),
  notes: z.string().optional(),
  expectedDate: z.string().optional(),
  items: z.array(poItemSchema).min(1, 'Adicione pelo menos um item ao pedido de compra.'),
});

const receiveLineSchema = z.object({
  ingredientId: z.string().uuid('ID de insumo inválido.'),
  quantityReceived: z.number().positive('Quantidade deve ser maior que zero.'),
  unitCost: z.number().min(0),
});

const receivePOSchema = z.object({
  lines: z.array(receiveLineSchema).min(1, 'Informe pelo menos uma linha de recebimento.'),
  notes: z.string().optional(),
  receivedAt: z.string().optional(),
  inboundInvoiceId: z.string().uuid().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createBusinessError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

const RFQ_VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SENT', 'REJECTED'],
  SENT: ['APPROVED', 'REJECTED'],
  APPROVED: [], // transição para CONVERTED é feita pela rota de conversão
  REJECTED: [],
  CONVERTED: [],
};

// ─── Controller ───────────────────────────────────────────────────────────────

export const PurchasesController = {
  // ── Fornecedores ────────────────────────────────────────────────────────────
  async getSuppliers(_req: Request, res: Response) {
    const tenantId = getTenantId();
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json(suppliers);
  },

  async createSupplier(req: Request, res: Response) {
    const tenantId = getTenantId();
    const payload = createSupplierSchema.parse(req.body);

    const supplier = await prisma.supplier.create({
      data: {
        tenantId,
        ...payload,
      },
    });
    res.status(201).json(supplier);
  },

  // ── NF de Entrada direta ─────────────────────────────────────────────────────
  async getInboundInvoices(_req: Request, res: Response) {
    const tenantId = getTenantId();
    const invoices = await prisma.inboundInvoice.findMany({
      where: { tenantId },
      include: { supplier: true, items: true },
      orderBy: { issueDate: 'desc' },
    });
    res.json(invoices);
  },

  async createInboundInvoice(req: Request, res: Response) {
    const tenantId = getTenantId();
    const payload = createInboundInvoiceSchema.parse(req.body);

    const invoice = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id: payload.supplierId, tenantId, isActive: true },
        select: { id: true },
      });

      if (!supplier) {
        throw createBusinessError('Fornecedor nao encontrado para esta loja.');
      }

      const ingredientIds = [...new Set(payload.items.map((item) => item.ingredientId))];
      const ingredients = await tx.ingredient.findMany({
        where: { id: { in: ingredientIds }, tenantId },
        select: { id: true },
      });
      const validIngredientIds = new Set(ingredients.map((ingredient) => ingredient.id));

      if (validIngredientIds.size !== ingredientIds.length) {
        throw createBusinessError('Um ou mais insumos nao pertencem a esta loja.');
      }

      const inv = await tx.inboundInvoice.create({
        data: {
          tenantId,
          supplierId: payload.supplierId,
          number: payload.number,
          issueDate: payload.issueDate ? new Date(payload.issueDate) : undefined,
          totalAmount: payload.totalAmount,
          notes: payload.notes,
          items: {
            create: payload.items.map((i) => ({
              ingredientId: i.ingredientId,
              quantity: i.quantity,
              unitCost: i.unitCost,
              totalCost: i.totalCost,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of payload.items) {
        await InventoryService.moveStock(
          {
            tenantId,
            ingredientId: item.ingredientId,
            type: 'INBOUND_INVOICE',
            quantity: item.quantity,
            cost: item.unitCost,
            notes: `Entrada direta NF ${payload.number ?? 'S/N'} fornecedor ${payload.supplierId}`,
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

  // ── RFQ / Cotação de Compra ──────────────────────────────────────────────────
  async getRFQs(req: Request, res: Response) {
    const tenantId = getTenantId();
    const { status, supplierId } = req.query as Record<string, string | undefined>;

    const rfqs = await prisma.purchaseRequest.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(supplierId ? { supplierId } : {}),
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { ingredient: { select: { id: true, name: true, unit: true } } } },
        purchaseOrders: { select: { id: true, status: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(rfqs);
  },

  async createRFQ(req: Request, res: Response) {
    const tenantId = getTenantId();
    const payload = createRFQSchema.parse(req.body);

    // Verificar fornecedor se fornecido
    if (payload.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: payload.supplierId, tenantId, isActive: true },
        select: { id: true },
      });
      if (!supplier) {
        throw createBusinessError('Fornecedor nao encontrado para esta loja.', 404);
      }
    }

    // Verificar insumos
    const ingredientIds = [...new Set(payload.items.map((i) => i.ingredientId))];
    const ingredients = await prisma.ingredient.findMany({
      where: { id: { in: ingredientIds }, tenantId },
      select: { id: true },
    });
    if (ingredients.length !== ingredientIds.length) {
      throw createBusinessError('Um ou mais insumos nao pertencem a esta loja.', 404);
    }

    const rfq = await prisma.purchaseRequest.create({
      data: {
        tenantId,
        supplierId: payload.supplierId ?? null,
        notes: payload.notes ?? null,
        expectedDate: payload.expectedDate ? new Date(payload.expectedDate) : null,
        status: 'DRAFT',
        items: {
          create: payload.items.map((item) => ({
            ingredientId: item.ingredientId,
            quantityRequested: item.quantityRequested.toFixed(4),
            unitCostEstimate: item.unitCostEstimate != null ? item.unitCostEstimate.toFixed(2) : null,
          })),
        },
      },
      include: { items: true },
    });

    res.status(201).json(rfq);
  },

  async updateRFQStatus(req: Request, res: Response) {
    const tenantId = getTenantId();
    const rfqId = String(req.params['id']);
    const payload = updateRFQStatusSchema.parse(req.body);

    const rfq = await prisma.purchaseRequest.findFirst({
      where: { id: rfqId, tenantId },
      select: { id: true, status: true },
    });

    if (!rfq) {
      throw createBusinessError('RFQ nao encontrado para esta loja.', 404);
    }

    const allowed = RFQ_VALID_TRANSITIONS[rfq.status] ?? [];
    if (!allowed.includes(payload.status)) {
      throw createBusinessError(
        `Transicao de "${rfq.status}" para "${payload.status}" nao e permitida.`,
        422,
      );
    }

    const updated = await prisma.purchaseRequest.update({
      where: { id: rfqId },
      data: {
        status: payload.status,
        ...(payload.notes ? { notes: payload.notes } : {}),
      },
      include: { items: true },
    });

    res.json(updated);
  },

  async convertRFQtoPO(req: Request, res: Response) {
    const tenantId = getTenantId();
    const rfqId = String(req.params['id']);
    const schema = z.object({
      supplierId: z.string().uuid().optional(),
      notes: z.string().optional(),
      expectedDate: z.string().optional(),
      items: z.array(poItemSchema).min(1, 'Informe os itens do pedido de compra.'),
    });

    const payload = schema.parse(req.body);

    const po = await PurchasingService.convertRFQtoPO({
      tenantId,
      purchaseRequestId: rfqId,
      supplierId: payload.supplierId,
      notes: payload.notes,
      expectedDate: payload.expectedDate,
      items: payload.items,
    });

    res.status(201).json(po);
  },

  // ── Pedidos de Compra (PO) ──────────────────────────────────────────────────
  async getPurchaseOrders(req: Request, res: Response) {
    const tenantId = getTenantId();
    const { status, supplierId } = req.query as Record<string, string | undefined>;

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(supplierId ? { supplierId } : {}),
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { ingredient: { select: { id: true, name: true, unit: true } } } },
        receipts: {
          select: {
            id: true,
            receivedAt: true,
            createdAt: true,
            lines: { select: { ingredientId: true, quantityReceived: true } },
          },
        },
        purchaseRequest: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  },

  async createPurchaseOrder(req: Request, res: Response) {
    const tenantId = getTenantId();
    const payload = createPOSchema.parse(req.body);

    // Verificar fornecedor
    const supplier = await prisma.supplier.findFirst({
      where: { id: payload.supplierId, tenantId, isActive: true },
      select: { id: true },
    });
    if (!supplier) {
      throw createBusinessError('Fornecedor nao encontrado para esta loja.', 404);
    }

    // Verificar insumos
    const ingredientIds = [...new Set(payload.items.map((i) => i.ingredientId))];
    const ingredients = await prisma.ingredient.findMany({
      where: { id: { in: ingredientIds }, tenantId },
      select: { id: true },
    });
    if (ingredients.length !== ingredientIds.length) {
      throw createBusinessError('Um ou mais insumos nao pertencem a esta loja.', 404);
    }

    const totalAmount = payload.items.reduce(
      (sum, item) => sum + item.quantityOrdered * item.unitCost,
      0,
    );

    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: payload.supplierId,
        status: 'APPROVED',
        notes: payload.notes ?? null,
        expectedDate: payload.expectedDate ? new Date(payload.expectedDate) : null,
        totalAmount: totalAmount.toFixed(2),
        items: {
          create: payload.items.map((item) => ({
            ingredientId: item.ingredientId,
            quantityOrdered: item.quantityOrdered.toFixed(4),
            unitCost: item.unitCost.toFixed(2),
            totalCost: (item.quantityOrdered * item.unitCost).toFixed(2),
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { ingredient: { select: { id: true, name: true, unit: true } } } },
      },
    });

    res.status(201).json(po);
  },

  async getPurchaseOrderById(req: Request, res: Response) {
    const tenantId = getTenantId();
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: String(req.params['id']), tenantId },
      include: {
        supplier: true,
        purchaseRequest: true,
        items: { include: { ingredient: true } },
        receipts: {
          include: {
            lines: { include: { ingredient: { select: { id: true, name: true, unit: true } } } },
            inboundInvoice: { select: { id: true, number: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!po) {
      throw createBusinessError('Pedido de compra nao encontrado para esta loja.', 404);
    }

    res.json(po);
  },

  async receivePurchaseOrder(req: Request, res: Response) {
    const tenantId = getTenantId();
    const purchaseOrderId = String(req.params['id']);
    const payload = receivePOSchema.parse(req.body);

    const result = await PurchasingService.receivePartialPO({
      tenantId,
      purchaseOrderId,
      lines: payload.lines,
      notes: payload.notes,
      receivedAt: payload.receivedAt,
      inboundInvoiceId: payload.inboundInvoiceId,
    });

    res.status(201).json(result);
  },

  async updatePurchaseOrder(req: Request, res: Response) {
    const tenantId = getTenantId();
    const id = String(req.params['id']);
    const { status, notes, expectedDate } = req.body;

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw createBusinessError('Pedido de compra nao encontrado para esta loja.', 404);
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(expectedDate ? { expectedDate: new Date(expectedDate) } : {}),
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { ingredient: { select: { id: true, name: true, unit: true } } } },
      },
    });

    res.json(updated);
  },

  async cancelPurchaseOrder(req: Request, res: Response) {
    const tenantId = getTenantId();
    const id = String(req.params['id']);

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw createBusinessError('Pedido de compra nao encontrado para esta loja.', 404);
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELED' },
      include: {
        supplier: { select: { id: true, name: true } },
      },
    });

    res.json(updated);
  },
};

