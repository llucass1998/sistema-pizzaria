import { prisma } from '../lib/prisma.js';
import { emitOrderEvent } from './orderEvents.service.js';

export class DriverDeliveryError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

type LocationPayload = {
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
};

type DeliveryMetadata = Record<string, unknown>;

const DRIVER_ORDER_INCLUDE = {
  customer: true,
  driver: true,
  items: { include: { product: true, variant: true } },
  driverDeliveryEvents: { orderBy: { createdAt: 'desc' as const }, take: 20 },
};

export async function getActiveDriverProfile(tenantId: string, adminId: string) {
  const driver = await prisma.driver.findFirst({
    where: { tenantId, adminId, isActive: true },
    include: { admin: { select: { id: true, name: true, email: true, role: true } } },
  });

  if (!driver) {
    throw new DriverDeliveryError(403, 'Entregador ativo nao vinculado a este usuario.');
  }

  return driver;
}

export async function listDriverOrders(tenantId: string, driverId: string) {
  return prisma.order.findMany({
    where: {
      tenantId,
      driverId,
      fulfillmentType: 'DELIVERY',
      status: { in: ['OUT_FOR_DELIVERY', 'DELIVERED'] },
    },
    include: DRIVER_ORDER_INCLUDE,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 50,
  });
}

export async function getDriverOrder(tenantId: string, driverId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId, driverId, fulfillmentType: 'DELIVERY' },
    include: DRIVER_ORDER_INCLUDE,
  });

  if (!order) {
    throw new DriverDeliveryError(404, 'Pedido de entrega nao encontrado para este entregador.');
  }

  return order;
}

function parseLocation(input: LocationPayload) {
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  const accuracy =
    input.accuracy === undefined || input.accuracy === null ? null : Number(input.accuracy);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new DriverDeliveryError(400, 'Latitude invalida.');
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new DriverDeliveryError(400, 'Longitude invalida.');
  }

  if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) {
    throw new DriverDeliveryError(400, 'Precisao da localizacao invalida.');
  }

  return { latitude, longitude, accuracy };
}

function buildMetadata(base: DeliveryMetadata, location?: LocationPayload) {
  const metadata: DeliveryMetadata = { ...base };

  if (location?.latitude !== undefined || location?.longitude !== undefined) {
    metadata.location = parseLocation(location);
  }

  return metadata;
}

export async function reportDriverLocation(
  tenantId: string,
  driverId: string,
  adminId: string,
  orderId: string,
  location: LocationPayload,
) {
  await getDriverOrder(tenantId, driverId, orderId);
  const metadata = buildMetadata({}, location);

  const event = await prisma.driverDeliveryEvent.create({
    data: {
      tenantId,
      orderId,
      driverId,
      actorId: adminId,
      type: 'LOCATION_REPORTED',
      metadata: metadata as any,
    },
  });

  emitOrderEvent(tenantId, 'order-updated', { id: orderId, driverDeliveryEvent: event } as any);
  return event;
}

export async function recordDeliveryProof(
  tenantId: string,
  driverId: string,
  adminId: string,
  orderId: string,
  proofUrl: string,
) {
  await getDriverOrder(tenantId, driverId, orderId);

  const event = await prisma.driverDeliveryEvent.create({
    data: {
      tenantId,
      orderId,
      driverId,
      actorId: adminId,
      type: 'PROOF_UPLOADED',
      metadata: { proofUrl } as any,
    },
  });

  emitOrderEvent(tenantId, 'order-updated', { id: orderId, driverDeliveryEvent: event } as any);
  return event;
}

export async function confirmDriverDelivery(
  tenantId: string,
  driverId: string,
  adminId: string,
  orderId: string,
  input: { receivedBy?: unknown; note?: unknown; proofUrl?: unknown; location?: LocationPayload },
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId, driverId, fulfillmentType: 'DELIVERY' },
    select: { id: true, status: true },
  });

  if (!order) {
    throw new DriverDeliveryError(404, 'Pedido de entrega nao encontrado para este entregador.');
  }

  if (order.status === 'DELIVERED') {
    throw new DriverDeliveryError(409, 'Entrega ja confirmada.');
  }

  if (order.status !== 'OUT_FOR_DELIVERY') {
    throw new DriverDeliveryError(409, 'Pedido ainda nao esta em rota de entrega.');
  }

  const note = typeof input.note === 'string' ? input.note.trim() || null : null;
  const receivedBy = typeof input.receivedBy === 'string' ? input.receivedBy.trim() || null : null;
  const proofUrl = typeof input.proofUrl === 'string' ? input.proofUrl.trim() || null : null;
  const metadata = buildMetadata({ receivedBy, proofUrl }, input.location);

  const updated = await prisma.$transaction(async (tx) => {
    const update = await tx.order.updateMany({
      where: {
        id: orderId,
        tenantId,
        driverId,
        fulfillmentType: 'DELIVERY',
        status: 'OUT_FOR_DELIVERY',
      },
      data: { status: 'DELIVERED' },
    });

    if (update.count !== 1) {
      throw new DriverDeliveryError(409, 'Entrega ja foi atualizada por outro usuario.');
    }

    await tx.orderStatusEvent.create({
      data: {
        tenantId,
        orderId,
        actorId: adminId,
        source: 'DRIVER_DELIVERY_CONFIRMATION',
        previousStatus: 'OUT_FOR_DELIVERY',
        newStatus: 'DELIVERED',
        note: note ?? 'Entrega confirmada pelo entregador.',
      },
    });

    await tx.driverDeliveryEvent.create({
      data: {
        tenantId,
        orderId,
        driverId,
        actorId: adminId,
        type: 'DELIVERY_CONFIRMED',
        status: 'DELIVERED',
        note,
        metadata: metadata as any,
      },
    });

    return tx.order.findFirst({
      where: { id: orderId, tenantId },
      include: DRIVER_ORDER_INCLUDE,
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

  return updated;
}

export async function recordDeliveryFailure(
  tenantId: string,
  driverId: string,
  adminId: string,
  orderId: string,
  input: { reason?: unknown; note?: unknown; location?: LocationPayload },
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId, driverId, fulfillmentType: 'DELIVERY' },
    select: { id: true, status: true },
  });

  if (!order) {
    throw new DriverDeliveryError(404, 'Pedido de entrega nao encontrado para este entregador.');
  }

  if (order.status !== 'OUT_FOR_DELIVERY') {
    throw new DriverDeliveryError(409, 'Falha so pode ser registrada para pedido em rota.');
  }

  const reason =
    typeof input.reason === 'string' ? input.reason.trim() || 'Nao informado' : 'Nao informado';
  const note = typeof input.note === 'string' ? input.note.trim() || null : null;
  const metadata = buildMetadata({ reason }, input.location);

  const event = await prisma.driverDeliveryEvent.create({
    data: {
      tenantId,
      orderId,
      driverId,
      actorId: adminId,
      type: 'DELIVERY_FAILED',
      status: order.status,
      note,
      metadata: metadata as any,
    },
  });

  emitOrderEvent(tenantId, 'order-updated', { id: orderId, driverDeliveryEvent: event } as any);
  return event;
}
