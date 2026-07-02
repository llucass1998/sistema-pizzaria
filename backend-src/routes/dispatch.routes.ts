import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { requireRole } from '../middlewares/requireRole.js';
import { normalizeText } from '../utils/normalize.js';
import { emitOrderEvent } from '../services/orderEvents.service.js';

const router = Router();

router.use(requireRole(['OWNER', 'ADMIN', 'MANAGER', 'DRIVER']));

function isDriverRole(req: Request) {
  return (req as any).adminRole === 'DRIVER';
}

async function getLinkedDriverId(req: Request, tenantId: string) {
  if (!isDriverRole(req)) return null;
  const driver = await prisma.driver.findFirst({
    where: { tenantId, adminId: (req as any).adminId, isActive: true },
    select: { id: true },
  });
  return driver?.id ?? null;
}

router.get('/drivers', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId();
    const driverId = await getLinkedDriverId(req, tenantId);
    if (isDriverRole(req) && !driverId) {
      res.json([]);
      return;
    }

    const drivers = await prisma.driver.findMany({
      where: { tenantId, ...(driverId ? { id: driverId } : {}) },
      orderBy: { name: 'asc' },
    });
    res.json(drivers);
  } catch (error) {
    console.error('Erro ao buscar entregadores:', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

router.post(
  '/drivers',
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId();
      const { name, phone, vehicle, isActive, adminId } = req.body;

      if (!normalizeText(name)) {
        res.status(400).json({ error: 'Nome e obrigatorio.' });
        return;
      }

      if (adminId) {
        const admin = await prisma.admin.findFirst({
          where: { id: String(adminId), tenantId, role: 'DRIVER' },
          select: { id: true },
        });
        if (!admin) {
          res.status(400).json({ error: 'Login de entregador invalido para esta loja.' });
          return;
        }
      }

      const driver = await prisma.driver.create({
        data: {
          tenantId,
          name: normalizeText(name),
          phone: normalizeText(phone) || null,
          vehicle: normalizeText(vehicle) || null,
          adminId: adminId ? String(adminId) : null,
          isActive: isActive !== undefined ? Boolean(isActive) : true,
        },
      });
      res.status(201).json(driver);
    } catch (error: any) {
      console.error('Erro ao criar entregador:', error);
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'Telefone ou login ja cadastrado.' });
        return;
      }
      res.status(500).json({ error: 'Erro interno.' });
    }
  },
);

router.put(
  '/drivers/:id',
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId();
      const id = String(req.params.id ?? '');
      const { name, phone, vehicle, isActive, adminId } = req.body;

      if (adminId) {
        const admin = await prisma.admin.findFirst({
          where: { id: String(adminId), tenantId, role: 'DRIVER' },
          select: { id: true },
        });
        if (!admin) {
          res.status(400).json({ error: 'Login de entregador invalido para esta loja.' });
          return;
        }
      }

      const driver = await prisma.driver.updateMany({
        where: { id, tenantId },
        data: {
          ...(name !== undefined ? { name: normalizeText(name) } : {}),
          ...(phone !== undefined ? { phone: normalizeText(phone) || null } : {}),
          ...(vehicle !== undefined ? { vehicle: normalizeText(vehicle) || null } : {}),
          ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
          ...(adminId !== undefined ? { adminId: adminId ? String(adminId) : null } : {}),
        },
      });

      res.json({ success: true, count: driver.count });
    } catch (error) {
      console.error('Erro ao atualizar entregador:', error);
      res.status(500).json({ error: 'Erro interno.' });
    }
  },
);

router.get('/ready-orders', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId();
    const driverId = await getLinkedDriverId(req, tenantId);
    if (isDriverRole(req) && !driverId) {
      res.json([]);
      return;
    }

    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        fulfillmentType: 'DELIVERY',
        status: { in: isDriverRole(req) ? ['OUT_FOR_DELIVERY'] : ['READY', 'PREPARING', 'OUT_FOR_DELIVERY'] },
        ...(driverId ? { driverId } : {}),
      },
      include: {
        customer: true,
        driver: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (error) {
    console.error('Erro ao buscar pedidos para despacho:', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

router.post(
  '/assign',
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId();
      const { orderId, driverId } = req.body;

      if (!orderId || !driverId) {
        res.status(400).json({ error: 'orderId e driverId sao obrigatorios.' });
        return;
      }

      const driver = await prisma.driver.findFirst({
        where: { id: String(driverId), tenantId, isActive: true },
        select: { id: true },
      });
      if (!driver) {
        res.status(404).json({ error: 'Entregador nao encontrado.' });
        return;
      }

      const order = await prisma.order.updateMany({
        where: { id: String(orderId), tenantId, fulfillmentType: 'DELIVERY' },
        data: {
          driverId: String(driverId),
          status: 'OUT_FOR_DELIVERY',
        },
      });

      const updatedOrder =
        order.count === 1
          ? await prisma.order.findFirst({
              where: { id: String(orderId), tenantId },
              include: { customer: true, driver: true, items: { include: { product: true } } },
            })
          : null;

      if (updatedOrder) {
        emitOrderEvent(tenantId, 'order-assigned', updatedOrder as any);
        emitOrderEvent(tenantId, 'order-status-changed', {
          id: updatedOrder.id,
          status: updatedOrder.status,
          previousStatus: null,
          updatedAt: updatedOrder.updatedAt,
        });
        emitOrderEvent(tenantId, 'order-updated', updatedOrder as any);
      }

      res.json({ success: true, count: order.count });
    } catch (error) {
      console.error('Erro ao despachar pedido:', error);
      res.status(500).json({ error: 'Erro interno.' });
    }
  },
);

router.patch('/orders/:orderId/status', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId();
    const orderId = String(req.params.orderId ?? '');
    const status = normalizeText(req.body.status).toUpperCase();

    if (status !== 'DELIVERED') {
      res.status(400).json({ message: 'Entregador so pode finalizar a entrega.' });
      return;
    }

    const driverId = await getLinkedDriverId(req, tenantId);
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
        fulfillmentType: 'DELIVERY',
        status: 'OUT_FOR_DELIVERY',
        ...(driverId ? { driverId } : {}),
      },
      select: { id: true },
    });

    if (!order) {
      res.status(404).json({ message: 'Pedido de entrega nao encontrado para este perfil.' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: { id: orderId, tenantId, status: 'OUT_FOR_DELIVERY' },
        data: { status: 'DELIVERED' },
      });

      await tx.orderStatusEvent.create({
        data: {
          tenantId,
          orderId,
          actorId: (req as any).adminId ?? null,
          source: 'DRIVER_DELIVERY_STATUS',
          previousStatus: 'OUT_FOR_DELIVERY',
          newStatus: 'DELIVERED',
          note: 'Entrega finalizada pelo entregador.',
        },
      });

      return tx.order.findFirst({
        where: { id: orderId, tenantId },
        include: { customer: true, driver: true },
      });
    });

    if (updated) {
      emitOrderEvent(tenantId, 'order-status-changed', {
        id: updated.id,
        status: 'DELIVERED',
        previousStatus: 'OUT_FOR_DELIVERY',
        updatedAt: (updated as any).updatedAt,
      });
      emitOrderEvent(tenantId, 'order-updated', updated as any);
    }

    res.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar entrega:', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

export default router;
