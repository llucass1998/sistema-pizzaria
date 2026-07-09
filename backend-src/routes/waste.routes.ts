import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { requireRole } from '../middlewares/requireRole.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { WasteService } from '../services/waste.service.js';

export const wasteRouter = Router();

wasteRouter.use(requireAdmin);
wasteRouter.use(requireRole(['OWNER', 'ADMIN', 'MANAGER']));

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createWasteSchema = z.object({
  ingredientId: z.string().uuid('ID de ingrediente inválido.'),
  quantity: z.number().positive('Quantidade deve ser maior que zero.'),
  reason: z.enum(['EXPIRED', 'DAMAGED', 'MISTAKE', 'QUALITY_REJECT', 'OTHER']),
  registeredBy: z.string().min(2, 'Nome do funcionário é obrigatório.'),
  notes: z.string().optional(),
});

// ─── Rotas ───────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/inventory/waste
 * Lista os registros de perda.
 */
wasteRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const tenantId = getTenantId();
    const records = await prisma.wasteRecord.findMany({
      where: { tenantId },
      include: {
        ingredient: { select: { id: true, name: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limite para paginação simples
    });

    res.json(
      records.map((r) => ({
        ...r,
        quantity: Number(r.quantity),
      })),
    );
  }),
);

/**
 * POST /api/admin/inventory/waste
 * Registra uma nova perda.
 */
wasteRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const payload = createWasteSchema.parse(req.body);

    const record = await WasteService.registerWaste({
      tenantId,
      ...payload,
    });

    res.status(201).json({
      ...record,
      quantity: Number(record.quantity),
    });
  }),
);

/**
 * GET /api/admin/inventory/waste/report
 * Relatório consolidado por motivo e ingrediente.
 */
wasteRouter.get(
  '/report',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();

    // Suporte para filtros de data simples (opcional)
    const { start, end } = req.query as Record<string, string | undefined>;
    const startDate = start ? new Date(start) : undefined;
    const endDate = end ? new Date(end) : undefined;

    const report = await WasteService.getWasteReport(tenantId, startDate, endDate);
    res.json(report);
  }),
);
