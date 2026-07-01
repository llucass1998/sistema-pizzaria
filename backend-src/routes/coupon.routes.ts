import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { getIdParam } from '../utils/request.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { normalizeText, parseMoney } from '../utils/normalize.js';

export const couponRoutes = Router();

function couponDto(coupon: any) {
  return {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: Number(coupon.value),
    minOrderValue: coupon.minOrderValue ? Number(coupon.minOrderValue) : null,
    expirationDate: coupon.expirationDate ? coupon.expirationDate.toISOString() : null,
    maxUses: coupon.maxUses,
    currentUses: coupon.currentUses,
    triggerEvent: coupon.triggerEvent,
    isActive: coupon.isActive,
    createdAt: coupon.createdAt.toISOString(),
  };
}

couponRoutes.get(
  '/admin/coupons',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const includeInactive = req.query.includeInactive === 'true';

    const coupons = await prisma.coupon.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(coupons.map(couponDto));
  }),
);

couponRoutes.post(
  '/admin/coupons',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const code = normalizeText(req.body.code)?.toUpperCase();
    const type = normalizeText(req.body.type);
    const value = parseMoney(req.body.value);
    const minOrderValue = req.body.minOrderValue ? parseMoney(req.body.minOrderValue) : null;
    const expirationDate = req.body.expirationDate ? new Date(req.body.expirationDate) : null;
    const maxUses = req.body.maxUses ? parseInt(String(req.body.maxUses), 10) : null;
    const isActive = typeof req.body.isActive === 'boolean' ? req.body.isActive : true;

    if (!code) {
      res.status(400).json({ message: 'O código do cupom é obrigatório.' });
      return;
    }

    if (!['PERCENTAGE', 'FIXED', 'FREE_DELIVERY'].includes(type)) {
      res.status(400).json({ message: 'Tipo de cupom inválido.' });
      return;
    }

    if (!value || Number(value) <= 0) {
      res.status(400).json({ message: 'Valor do cupom deve ser maior que zero.' });
      return;
    }

    if (type === 'PERCENTAGE' && Number(value) > 100) {
      res.status(400).json({ message: 'Cupons de porcentagem não podem passar de 100%.' });
      return;
    }

    const existing = await prisma.coupon.findFirst({
      where: { tenantId, code },
    });

    if (existing) {
      res.status(409).json({ message: 'Já existe um cupom com este código.' });
      return;
    }

    const coupon = await prisma.coupon.create({
      data: {
        tenantId,
        code,
        type,
        value,
        minOrderValue,
        expirationDate,
        maxUses,
        isActive,
      },
    });

    res.status(201).json(couponDto(coupon));
  }),
);

couponRoutes.put(
  '/admin/coupons/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const id = getIdParam(req, res);
    if (!id) return;

    const coupon = await prisma.coupon.findFirst({
      where: { id, tenantId },
    });

    if (!coupon) {
      res.status(404).json({ message: 'Cupom não encontrado.' });
      return;
    }

    const data: any = {};

    if (req.body.code !== undefined) {
      const code = normalizeText(req.body.code)?.toUpperCase();
      if (!code) {
        res.status(400).json({ message: 'O código do cupom é obrigatório.' });
        return;
      }
      const existing = await prisma.coupon.findFirst({ where: { tenantId, code } });
      if (existing && existing.id !== id) {
        res.status(409).json({ message: 'Já existe um cupom com este código.' });
        return;
      }
      data.code = code;
    }

    if (req.body.type !== undefined) {
      if (!['PERCENTAGE', 'FIXED', 'FREE_DELIVERY'].includes(req.body.type)) {
        res.status(400).json({ message: 'Tipo de cupom inválido.' });
        return;
      }
      data.type = req.body.type;
    }

    if (req.body.value !== undefined) {
      const value = parseMoney(req.body.value);
      if (!value || Number(value) <= 0) {
        res.status(400).json({ message: 'Valor do cupom deve ser maior que zero.' });
        return;
      }
      const checkType = data.type || coupon.type;
      if (checkType === 'PERCENTAGE' && Number(value) > 100) {
        res.status(400).json({ message: 'Cupons de porcentagem não podem passar de 100%.' });
        return;
      }
      data.value = value;
    }

    if (req.body.minOrderValue !== undefined) {
      data.minOrderValue = req.body.minOrderValue ? parseMoney(req.body.minOrderValue) : null;
    }

    if (req.body.expirationDate !== undefined) {
      data.expirationDate = req.body.expirationDate ? new Date(req.body.expirationDate) : null;
    }

    if (req.body.maxUses !== undefined) {
      data.maxUses = req.body.maxUses ? parseInt(String(req.body.maxUses), 10) : null;
    }

    if (typeof req.body.isActive === 'boolean') {
      data.isActive = req.body.isActive;
    }

    const updated = await prisma.coupon.update({
      where: { id },
      data,
    });

    res.json(couponDto(updated));
  }),
);

couponRoutes.delete(
  '/admin/coupons/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const id = getIdParam(req, res);
    if (!id) return;

    const coupon = await prisma.coupon.findFirst({
      where: { id, tenantId },
    });

    if (!coupon) {
      res.status(404).json({ message: 'Cupom não encontrado.' });
      return;
    }

    await prisma.coupon.update({
      where: { id },
      data: { isActive: false },
    });

    res.status(204).send();
  }),
);
