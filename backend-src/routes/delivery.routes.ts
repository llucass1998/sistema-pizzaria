import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { requireRole } from '../middlewares/requireRole.js';
import { validateSchema } from '../middlewares/validateZod.js';
import { getTenantId } from '../core/context/TenantContext.js';

export const deliveryRoutes = Router();

// ─── VALIDATION SCHEMAS ────────────────────────────────────────────────────────

const zoneSchema = z.object({
  name: z.string().min(1, 'Nome do bairro é obrigatório.'),
  fee: z.coerce.number().min(0, 'Taxa não pode ser negativa.'),
  minOrderValue: z.coerce.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
});

const radiusSchema = z.object({
  maxKm: z.coerce.number().min(0.1, 'Distância máxima deve ser maior que zero.'),
  fee: z.coerce.number().min(0, 'Taxa não pode ser negativa.'),
  minOrderValue: z.coerce.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
});

// ─── ZONES (BAIRROS) ────────────────────────────────────────────────────────

deliveryRoutes.get(
  '/admin/delivery-zones',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const tenantId = getTenantId();
    const zones = await prisma.deliveryZone.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    res.json(zones);
  }),
);

deliveryRoutes.post(
  '/admin/delivery-zones',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  validateSchema(zoneSchema),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const { name, fee, minOrderValue, isActive } = req.body;

    const existing = await prisma.deliveryZone.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    });

    if (existing) {
      res.status(400).json({ message: 'Já existe um bairro com este nome.' });
      return;
    }

    const zone = await prisma.deliveryZone.create({
      data: {
        tenantId,
        name,
        fee,
        minOrderValue,
        isActive: isActive ?? true,
      },
    });

    res.status(201).json(zone);
  }),
);

deliveryRoutes.put(
  '/admin/delivery-zones/:id',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  validateSchema(zoneSchema),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const id = req.params.id as string;
    const { name, fee, minOrderValue, isActive } = req.body;

    const existing = await prisma.deliveryZone.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' }, id: { not: id } },
    });

    if (existing) {
      res.status(400).json({ message: 'Já existe outro bairro com este nome.' });
      return;
    }

    const zoneTarget = await prisma.deliveryZone.findFirst({ where: { id, tenantId } });
    if (!zoneTarget) {
      res.status(404).json({ message: 'Bairro não encontrado.' });
      return;
    }

    const updated = await prisma.deliveryZone.update({
      where: { id },
      data: { name, fee, minOrderValue, isActive },
    });

    res.json(updated);
  }),
);

deliveryRoutes.delete(
  '/admin/delivery-zones/:id',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const id = req.params.id as string;

    const zone = await prisma.deliveryZone.findFirst({ where: { id, tenantId } });
    if (!zone) {
      res.status(404).json({ message: 'Bairro não encontrado.' });
      return;
    }

    await prisma.deliveryZone.delete({ where: { id } });
    res.json({ message: 'Bairro removido com sucesso.' });
  }),
);

// ─── RADIUS (DISTÂNCIA) ────────────────────────────────────────────────────────

deliveryRoutes.get(
  '/admin/delivery-radius-rules',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const tenantId = getTenantId();
    const rules = await prisma.deliveryRadiusRule.findMany({
      where: { tenantId },
      orderBy: { maxKm: 'asc' },
    });
    res.json(rules);
  }),
);

deliveryRoutes.post(
  '/admin/delivery-radius-rules',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  validateSchema(radiusSchema),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const { maxKm, fee, minOrderValue, isActive } = req.body;

    const existing = await prisma.deliveryRadiusRule.findFirst({
      where: { tenantId, maxKm },
    });

    if (existing) {
      res.status(400).json({ message: `Já existe uma regra para até ${maxKm}km.` });
      return;
    }

    const rule = await prisma.deliveryRadiusRule.create({
      data: {
        tenantId,
        maxKm,
        fee,
        minOrderValue,
        isActive: isActive ?? true,
      },
    });

    res.status(201).json(rule);
  }),
);

deliveryRoutes.put(
  '/admin/delivery-radius-rules/:id',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  validateSchema(radiusSchema),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const id = req.params.id as string;
    const { maxKm, fee, minOrderValue, isActive } = req.body;

    const ruleTarget = await prisma.deliveryRadiusRule.findFirst({ where: { id, tenantId } });
    if (!ruleTarget) {
      res.status(404).json({ message: 'Regra não encontrada.' });
      return;
    }

    const existing = await prisma.deliveryRadiusRule.findFirst({
      where: { tenantId, maxKm, id: { not: id } },
    });

    if (existing) {
      res.status(400).json({ message: `Já existe outra regra para até ${maxKm}km.` });
      return;
    }

    const updated = await prisma.deliveryRadiusRule.update({
      where: { id },
      data: { maxKm, fee, minOrderValue, isActive },
    });

    res.json(updated);
  }),
);

deliveryRoutes.delete(
  '/admin/delivery-radius-rules/:id',
  requireAdmin,
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const id = req.params.id as string;

    const rule = await prisma.deliveryRadiusRule.findFirst({ where: { id, tenantId } });
    if (!rule) {
      res.status(404).json({ message: 'Regra não encontrada.' });
      return;
    }

    await prisma.deliveryRadiusRule.delete({ where: { id } });
    res.json({ message: 'Regra removida com sucesso.' });
  }),
);

// ─── PUBLIC CHECKOUT CALCULATOR ────────────────────────────────────────────────

// Rota pública para consultar bairros ativos (usado pelo checkout)
deliveryRoutes.get(
  '/public/delivery-zones',
  asyncHandler(async (_req, res) => {
    const tenantId = getTenantId();
    const zones = await prisma.deliveryZone.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json(zones);
  }),
);

const calcFeeSchema = z.object({
  neighborhood: z.string().optional().nullable(),
  distanceKm: z.number().optional().nullable(),
  subtotal: z.number().min(0),
});

deliveryRoutes.post(
  '/checkout/calculate-delivery-fee',
  validateSchema(calcFeeSchema),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const { neighborhood, distanceKm, subtotal } = req.body;

    const settings = await prisma.storeSetting.findUnique({ where: { tenantId } });
    if (!settings) {
      res.status(400).json({ message: 'Configurações da loja não encontradas.' });
      return;
    }

    const mode = settings.deliveryFeeMode || 'FIXED';
    let deliveryFee = Number(settings.deliveryFee);
    let available = true;
    let message = 'Taxa de entrega calculada.';

    if (mode === 'NEIGHBORHOOD') {
      if (!neighborhood) {
        res.status(400).json({
          available: false,
          message: 'Bairro é obrigatório para cálculo da taxa.',
          deliveryFee: 0,
        });
        return;
      }

      const zone = await prisma.deliveryZone.findFirst({
        where: { tenantId, name: { equals: neighborhood, mode: 'insensitive' }, isActive: true },
      });

      if (!zone) {
        available = false;
        message = 'Ainda não entregamos neste bairro.';
        deliveryFee = 0;
      } else {
        if (zone.minOrderValue && subtotal < Number(zone.minOrderValue)) {
          available = false;
          message = `O pedido mínimo para este bairro é R$ ${Number(zone.minOrderValue).toFixed(2)}`;
          deliveryFee = Number(zone.fee);
        } else {
          deliveryFee = Number(zone.fee);
        }
      }
    } else if (mode === 'DISTANCE') {
      if (distanceKm === undefined || distanceKm === null) {
        res.status(400).json({
          available: false,
          message: 'Distância é obrigatória para cálculo da taxa.',
          deliveryFee: 0,
        });
        return;
      }

      // Procura a menor regra onde maxKm >= distanceKm
      const rule = await prisma.deliveryRadiusRule.findFirst({
        where: { tenantId, isActive: true, maxKm: { gte: distanceKm } },
        orderBy: { maxKm: 'asc' },
      });

      if (!rule) {
        available = false;
        message = 'A distância excede nosso raio de entrega atual.';
        deliveryFee = 0;
      } else {
        if (rule.minOrderValue && subtotal < Number(rule.minOrderValue)) {
          available = false;
          message = `O pedido mínimo para esta distância é R$ ${Number(rule.minOrderValue).toFixed(2)}`;
          deliveryFee = Number(rule.fee);
        } else {
          deliveryFee = Number(rule.fee);
        }
      }
    }

    res.json({
      deliveryFee,
      available,
      message,
      mode,
    });
  }),
);
