import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { requireRole } from '../middlewares/requireRole.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { ManufacturingService } from '../services/manufacturing.service.js';

export const manufacturingRouter = Router();

manufacturingRouter.use(requireAdmin);
manufacturingRouter.use(requireRole(['OWNER', 'ADMIN', 'MANAGER']));

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createOrderSchema = z.object({
  productId: z.string().uuid('ID de produto inválido.'),
  quantity: z.number().positive('Quantidade deve ser maior que zero.'),
  notes: z.string().optional(),
  outputIngredientId: z.string().uuid().optional(),
  outputQuantityPerUnit: z.number().positive().optional(),
});

// ─── Rotas ───────────────────────────────────────────────────────────────────

/**
 * GET /api/manufacturing/orders
 * Lista ordens de produção com filtros opcionais de status e produto.
 */
manufacturingRouter.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const { status, productId } = req.query as Record<string, string | undefined>;

    const orders = await prisma.manufacturingOrder.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(productId ? { productId } : {}),
      },
      include: {
        product: { select: { id: true, name: true } },
        outputIngredient: { select: { id: true, name: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      orders.map((o) => ({
        ...o,
        quantity: Number(o.quantity),
        outputQuantityPerUnit: o.outputQuantityPerUnit ? Number(o.outputQuantityPerUnit) : null,
      })),
    );
  }),
);

/**
 * POST /api/manufacturing/orders
 * Cria nova ordem de produção em status DRAFT.
 */
manufacturingRouter.post(
  '/orders',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const payload = createOrderSchema.parse(req.body);

    const order = await ManufacturingService.createOrder({
      tenantId,
      ...payload,
    });

    res.status(201).json({
      ...order,
      quantity: Number(order.quantity),
      outputQuantityPerUnit: order.outputQuantityPerUnit
        ? Number(order.outputQuantityPerUnit)
        : null,
    });
  }),
);

/**
 * GET /api/manufacturing/orders/:id
 * Detalhe de uma ordem com produto, outputIngredient e histórico de transações.
 */
manufacturingRouter.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const order = await prisma.manufacturingOrder.findFirst({
      where: { id: String(req.params['id']), tenantId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            recipes: { include: { ingredient: { select: { id: true, name: true, unit: true } } } },
          },
        },
        outputIngredient: { select: { id: true, name: true, unit: true } },
      },
    });

    if (!order) {
      res.status(404).json({ message: 'Ordem de producao nao encontrada.' });
      return;
    }

    res.json({
      ...order,
      quantity: Number(order.quantity),
      outputQuantityPerUnit: order.outputQuantityPerUnit
        ? Number(order.outputQuantityPerUnit)
        : null,
    });
  }),
);

/**
 * PATCH /api/manufacturing/orders/:id/start
 * Move ordem de DRAFT para IN_PROGRESS.
 */
manufacturingRouter.patch(
  '/orders/:id/start',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const result = await ManufacturingService.startOrder(
      String(req.params['id']),
      tenantId,
    );
    res.json(result);
  }),
);

/**
 * PATCH /api/manufacturing/orders/:id/complete
 * Conclui ordem IN_PROGRESS:
 *   - Baixa insumos da ficha técnica
 *   - Registra entrada do outputIngredient (se configurado)
 *   - Bloqueia conclusão dupla (idempotente se já DONE)
 */
manufacturingRouter.patch(
  '/orders/:id/complete',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const result = await ManufacturingService.completeOrder(
      String(req.params['id']),
      tenantId,
    );
    res.json(result);
  }),
);

/**
 * PATCH /api/manufacturing/orders/:id/cancel
 * Cancela ordem em DRAFT ou IN_PROGRESS.
 */
manufacturingRouter.patch(
  '/orders/:id/cancel',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const result = await ManufacturingService.cancelOrder(
      String(req.params['id']),
      tenantId,
    );
    res.json(result);
  }),
);
