import { Router } from 'express';

import { basePrisma } from '../lib/prisma.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { requireRole } from '../middlewares/requireRole.js';
import { getTenantId } from '../core/context/TenantContext.js';
import { normalizeText } from '../utils/normalize.js';
import { validateStatusTransition } from '../utils/orderStateMachine.js';
import { FulfillmentType, OrderStatus } from '../../generated/prisma/index.js';
import { InventoryService } from '../services/inventory.service.js';
import { emitOrderEvent } from '../services/orderEvents.service.js';
import { resolveKdsStation, resolvePrepTimeMinutes, isValidStation } from '../utils/kdsHelpers.js';

export const kdsRouter = Router();

kdsRouter.use(requireAdmin);
kdsRouter.use(requireRole(['OWNER', 'ADMIN', 'MANAGER', 'KITCHEN']));

function parseOptionsSnapshot(value: unknown) {
  if (!value) return { options: [], halfAndHalf: null };
  if (typeof value === 'object') return value as any;
  try {
    return JSON.parse(String(value));
  } catch {
    return { options: [], halfAndHalf: null };
  }
}

function minutesSince(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

function serializeOrder(order: any, filterStation?: string | null) {
  const elapsedMinutes = minutesSince(order.createdAt);
  const rawItems = order.items ?? [];
  const allSerializedItems = rawItems.map((item: any) => {
    const snapshot = parseOptionsSnapshot(item.optionsSnapshot);
    const station = resolveKdsStation(
      item.product as any,
      item.product?.menuCategory,
      item.displayName || item.product?.name,
    );
    const prepTimeMinutes = resolvePrepTimeMinutes(
      station,
      item.prepTimeMinutes,
      item.product?.prepTimeMinutes || item.product?.menuCategory?.prepTimeMinutes,
    );
    const refTime = item.kdsStartedAt ? new Date(item.kdsStartedAt) : new Date(order.createdAt);
    const itemElapsedMinutes = minutesSince(refTime);
    const isDelayed =
      item.kdsStatus !== 'READY' &&
      item.kdsStatus !== 'CANCELED' &&
      itemElapsedMinutes >= prepTimeMinutes;

    return {
      id: item.id,
      productId: item.productId,
      displayName: item.displayName ?? item.product?.name ?? 'Item',
      quantity: item.quantity,
      customizations: item.customizations,
      notes: item.notes ?? null,
      kdsStatus: item.kdsStatus,
      kdsStation: station,
      prepTimeMinutes,
      elapsedMinutes: itemElapsedMinutes,
      isDelayed,
      kdsStartedAt: item.kdsStartedAt,
      kdsReadyAt: item.kdsReadyAt,
      halfAndHalf: item.halfAndHalfData ?? snapshot.halfAndHalf ?? null,
      options: Array.isArray(snapshot.options) ? snapshot.options : [],
    };
  });

  const activeItems = allSerializedItems.filter((i: any) => i.kdsStatus !== 'CANCELED');
  const allItemsReady =
    activeItems.length > 0 && activeItems.every((item: any) => item.kdsStatus === 'READY');
  const readyForExpedition =
    order.fulfillmentType === FulfillmentType.PICKUP
      ? order.status === OrderStatus.READY
      : order.status === OrderStatus.PREPARING && allItemsReady;

  const filteredItems = filterStation
    ? allSerializedItems.filter((i: any) => i.kdsStation === filterStation)
    : allSerializedItems;

  return {
    id: order.id,
    number: order.id.slice(0, 8).toUpperCase(),
    status: order.status,
    origin: order.origin,
    fulfillmentType: order.fulfillmentType,
    customer: order.customer
      ? { id: order.customer.id, name: order.customer.name, phone: order.customer.phone }
      : null,
    notes: order.notes,
    createdAt: order.createdAt,
    elapsedMinutes,
    isDelayed: elapsedMinutes >= 25 || activeItems.some((i: any) => i.isDelayed),
    readyForExpedition,
    allItemsReady,
    items: filteredItems,
  };
}

async function findKdsOrder(orderId: string, tenantId: string, tx: any = basePrisma) {
  return tx.order.findFirst({
    where: { id: orderId, tenantId },
    include: {
      customer: true,
      items: {
        include: { product: { include: { menuCategory: true } } },
        orderBy: { id: 'asc' },
      },
    },
  });
}

kdsRouter.get(
  '/queue',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const filterStationRaw = req.query.station
      ? normalizeText(String(req.query.station))?.toUpperCase()
      : null;
    const stationParam = isValidStation(filterStationRaw) ? filterStationRaw : null;

    const orders = await basePrisma.order.findMany({
      where: {
        tenantId,
        status: { in: [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY] },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        customer: true,
        items: {
          include: { product: { include: { menuCategory: true } } },
          orderBy: { id: 'asc' },
        },
      },
    });

    let serialized = orders.map((order) => serializeOrder(order, stationParam));
    if (stationParam) {
      serialized = serialized.filter((order) => order.items.length > 0);
    }

    const kitchenStatuses = [OrderStatus.PENDING, OrderStatus.PREPARING].map(String);
    res.json({
      serverNow: new Date().toISOString(),
      orders: serialized,
      kitchenQueue: serialized.filter((order) => kitchenStatuses.includes(String(order.status))),
      expeditionQueue: serialized.filter((order) => order.readyForExpedition),
    });
  }),
);

kdsRouter.post(
  '/orders/:orderId/start',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const orderId = normalizeText(req.params.orderId);
    if (!orderId) {
      res.status(400).json({ message: 'Informe o pedido.' });
      return;
    }

    const existing = await findKdsOrder(orderId, tenantId);
    if (!existing) {
      res.status(404).json({ message: 'Pedido nao encontrado.' });
      return;
    }

    if (existing.status === OrderStatus.PREPARING) {
      res.json(serializeOrder(existing));
      return;
    }

    const transition = validateStatusTransition(
      existing.fulfillmentType as FulfillmentType,
      existing.status as OrderStatus,
      OrderStatus.PREPARING,
    );
    if (!transition.ok) {
      res.status(422).json({ message: transition.message, allowedNext: transition.allowedNext });
      return;
    }

    try {
      const order = await basePrisma.$transaction(async (tx) => {
        const current = await findKdsOrder(orderId, tenantId, tx);
        if (!current) {
          throw Object.assign(new Error('Pedido nao encontrado.'), { statusCode: 404 });
        }

        if (current.status === OrderStatus.PREPARING) {
          return current;
        }

        const currentTransition = validateStatusTransition(
          current.fulfillmentType as FulfillmentType,
          current.status as OrderStatus,
          OrderStatus.PREPARING,
        );
        if (!currentTransition.ok) {
          throw Object.assign(new Error(currentTransition.message), {
            statusCode: 422,
            allowedNext: currentTransition.allowedNext,
          });
        }

        await InventoryService.deductStockForOrderOrThrow(orderId, tenantId, tx);
        const updated = await tx.order.updateMany({
          where: { id: orderId, tenantId, status: current.status },
          data: { status: OrderStatus.PREPARING },
        });
        if (updated.count !== 1) {
          throw Object.assign(
            new Error('Pedido foi alterado por outra operacao. Tente novamente.'),
            {
              statusCode: 409,
            },
          );
        }
        await tx.orderItem.updateMany({
          where: { orderId, order: { tenantId } },
          data: { kdsStatus: 'PREPARING', kdsStartedAt: new Date() },
        });
        await tx.orderStatusEvent.create({
          data: {
            tenantId,
            orderId,
            actorId: (req as any).adminId ?? null,
            source: 'KDS',
            previousStatus: current.status,
            newStatus: OrderStatus.PREPARING,
            note: normalizeText(req.body?.note) || 'Preparo iniciado no KDS.',
          },
        });
        return findKdsOrder(orderId, tenantId, tx);
      });
      res.json(serializeOrder(order));
    } catch (error: any) {
      res.status(error.statusCode ?? 409).json({
        message: error.message || 'Nao foi possivel iniciar o preparo.',
        availability: error.availability,
      });
    }
  }),
);

kdsRouter.post(
  '/items/:orderItemId/ready',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const orderItemId = normalizeText(req.params.orderItemId);
    if (!orderItemId) {
      res.status(400).json({ message: 'Informe o item do pedido.' });
      return;
    }

    const item = await basePrisma.orderItem.findFirst({
      where: { id: orderItemId, order: { tenantId } },
      include: { order: true },
    });

    if (!item) {
      res.status(404).json({ message: 'Item do pedido nao encontrado.' });
      return;
    }

    const order = await basePrisma.$transaction(async (tx) => {
      const updated = await tx.orderItem.updateMany({
        where: { id: orderItemId, order: { tenantId } },
        data: { kdsStatus: 'READY', kdsReadyAt: new Date() },
      });
      if (updated.count !== 1) {
        throw Object.assign(new Error('Item do pedido nao encontrado.'), { statusCode: 404 });
      }
      await tx.orderStatusEvent.create({
        data: {
          tenantId,
          orderId: item.orderId,
          actorId: (req as any).adminId ?? null,
          source: 'KDS_ITEM',
          previousStatus: item.order.status,
          newStatus: item.order.status,
          note: `Item ${orderItemId} pronto.`,
        },
      });
      return findKdsOrder(item.orderId, tenantId, tx);
    });

    emitOrderEvent(tenantId, 'order-updated', order as any);

    res.json(serializeOrder(order));
  }),
);

kdsRouter.post(
  '/orders/:orderId/ready',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const orderId = normalizeText(req.params.orderId);
    const existing = await findKdsOrder(orderId, tenantId);

    if (!existing) {
      res.status(404).json({ message: 'Pedido nao encontrado.' });
      return;
    }

    const activeItems = existing.items.filter((item: any) => item.kdsStatus !== 'CANCELED');
    const allItemsReady =
      activeItems.length > 0 && activeItems.every((item: any) => item.kdsStatus === 'READY');
    if (!allItemsReady) {
      res.status(422).json({ message: 'Marque todos os itens como prontos antes de finalizar.' });
      return;
    }

    const targetStatus =
      existing.fulfillmentType === FulfillmentType.PICKUP ? OrderStatus.READY : existing.status;

    if (targetStatus !== existing.status) {
      const transition = validateStatusTransition(
        existing.fulfillmentType as FulfillmentType,
        existing.status as OrderStatus,
        targetStatus,
      );
      if (!transition.ok) {
        res.status(422).json({ message: transition.message, allowedNext: transition.allowedNext });
        return;
      }
    }

    const order = await basePrisma.$transaction(async (tx) => {
      if (targetStatus !== existing.status) {
        const updated = await tx.order.updateMany({
          where: { id: orderId, tenantId, status: existing.status },
          data: { status: targetStatus },
        });
        if (updated.count !== 1) {
          throw Object.assign(
            new Error('Pedido foi alterado por outra operacao. Atualize a fila.'),
            { statusCode: 409 },
          );
        }
      }
      await tx.orderStatusEvent.create({
        data: {
          tenantId,
          orderId,
          actorId: (req as any).adminId ?? null,
          source: 'KDS',
          previousStatus: existing.status,
          newStatus: targetStatus,
          note:
            existing.fulfillmentType === FulfillmentType.DELIVERY
              ? 'Pedido pronto para expedicao.'
              : 'Pedido pronto para retirada.',
        },
      });
      return findKdsOrder(orderId, tenantId, tx);
    });

    const serializedOrder = serializeOrder(order);
    if (targetStatus !== existing.status) {
      emitOrderEvent(tenantId, 'order-status-changed', {
        id: order.id,
        status: targetStatus,
        previousStatus: existing.status,
        updatedAt: order.updatedAt,
      });
      emitOrderEvent(tenantId, 'order-updated', order as any);
    }

    res.json(serializedOrder);
  }),
);

kdsRouter.post(
  '/orders/:orderId/dispatch',
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId();
    const orderId = normalizeText(req.params.orderId);
    const existing = await findKdsOrder(orderId, tenantId);

    if (!existing) {
      res.status(404).json({ message: 'Pedido nao encontrado.' });
      return;
    }

    if (existing.fulfillmentType !== FulfillmentType.DELIVERY) {
      res.status(422).json({ message: 'Apenas pedidos delivery podem ser despachados.' });
      return;
    }

    const activeItems = existing.items.filter((item: any) => item.kdsStatus !== 'CANCELED');
    const allItemsReady =
      activeItems.length > 0 && activeItems.every((item: any) => item.kdsStatus === 'READY');
    if (!allItemsReady) {
      res.status(422).json({ message: 'Pedido ainda nao esta pronto para expedicao.' });
      return;
    }

    const transition = validateStatusTransition(
      existing.fulfillmentType as FulfillmentType,
      existing.status as OrderStatus,
      OrderStatus.OUT_FOR_DELIVERY,
    );
    if (!transition.ok) {
      res.status(422).json({ message: transition.message, allowedNext: transition.allowedNext });
      return;
    }

    const order = await basePrisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, tenantId, status: existing.status },
        data: { status: OrderStatus.OUT_FOR_DELIVERY },
      });
      if (updated.count !== 1) {
        throw Object.assign(new Error('Pedido foi alterado por outra operacao. Atualize a fila.'), {
          statusCode: 409,
        });
      }
      await tx.orderStatusEvent.create({
        data: {
          tenantId,
          orderId,
          actorId: (req as any).adminId ?? null,
          source: 'KDS_EXPEDITION',
          previousStatus: existing.status,
          newStatus: OrderStatus.OUT_FOR_DELIVERY,
          note: normalizeText(req.body?.note) || 'Pedido despachado para entrega.',
        },
      });
      return findKdsOrder(orderId, tenantId, tx);
    });

    const serializedOrder = serializeOrder(order);
    emitOrderEvent(tenantId, 'order-status-changed', {
      id: order.id,
      status: OrderStatus.OUT_FOR_DELIVERY,
      previousStatus: existing.status,
      updatedAt: order.updatedAt,
    });
    emitOrderEvent(tenantId, 'order-updated', order as any);

    res.json(serializedOrder);
  }),
);
