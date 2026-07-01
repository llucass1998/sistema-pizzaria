import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireCustomer } from '../middlewares/requireCustomer.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { normalizeText } from '../utils/normalize.js';

export const cartRoutes = Router();

// POST /api/carrinho/sync
// Recebe o snapshot do carrinho atual e atualiza/cria no AbandonedCart
cartRoutes.post(
  ['/carrinho/sync', '/sync'],
  requireCustomer,
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const customerId = (req as any).customerId as string;
    const { items, total } = req.body;

    if (!items || !Array.isArray(items)) {
      res.status(400).json({ message: 'Itens do carrinho inválidos.' });
      return;
    }

    const cart = await prisma.abandonedCart.upsert({
      where: {
        tenantId_customerId: {
          tenantId,
          customerId,
        },
      },
      create: {
        tenantId,
        customerId,
        items,
        total: Number(total) || 0,
        status: 'PENDING',
        lastActiveAt: new Date(),
      },
      update: {
        items,
        total: Number(total) || 0,
        status: 'PENDING',
        lastActiveAt: new Date(),
      },
    });

    res.json(cart);
  }),
);

// POST /api/carrinho/validate-coupon
cartRoutes.post(
  ['/carrinho/validate-coupon', '/validate-coupon'],
  requireCustomer,
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const code = normalizeText(req.body.code).toUpperCase();
    const cartTotal = Number(req.body.cartTotal ?? 0);

    if (!code) {
      res.status(400).json({ message: 'Código do cupom é obrigatório.' });
      return;
    }

    const coupon = await prisma.coupon.findFirst({
      where: {
        tenantId,
        code,
        isActive: true,
      },
    });

    if (!coupon) {
      res.status(404).json({ message: 'Cupom inválido ou expirado.' });
      return;
    }

    if (coupon.expirationDate && coupon.expirationDate < new Date()) {
      res.status(400).json({ message: 'Este cupom já expirou.' });
      return;
    }

    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      res.status(400).json({ message: 'Limite de usos deste cupom foi atingido.' });
      return;
    }

    if (coupon.minOrderValue && Number(cartTotal) < Number(coupon.minOrderValue)) {
      res.status(400).json({
        message: `Este cupom exige um pedido mínimo de R$ ${Number(coupon.minOrderValue).toFixed(2)}`,
      });
      return;
    }

    res.json({
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
    });
  }),
);
