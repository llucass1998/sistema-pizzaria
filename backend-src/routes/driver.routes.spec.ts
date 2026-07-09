import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  driverFindFirst: vi.fn(),
  orderFindMany: vi.fn(),
  orderFindFirst: vi.fn(),
  orderUpdateMany: vi.fn(),
  orderStatusEventCreate: vi.fn(),
  driverDeliveryEventCreate: vi.fn(),
  emitOrderEvent: vi.fn(),
}));

vi.mock('../core/context/TenantContext.js', () => ({
  getTenantId: () => 'tenant-driver',
}));

vi.mock('../middlewares/requireRole.js', () => ({
  requireRole: (_roles: string[]) => (req: any, _res: any, next: () => void) => {
    req.adminId = 'admin-driver';
    req.adminRole = req.header('x-test-role') || 'DRIVER';
    next();
  },
}));

vi.mock('../services/orderEvents.service.js', () => ({
  emitOrderEvent: mocks.emitOrderEvent,
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    driver: {
      findFirst: mocks.driverFindFirst,
    },
    order: {
      findMany: mocks.orderFindMany,
      findFirst: mocks.orderFindFirst,
      updateMany: mocks.orderUpdateMany,
    },
    orderStatusEvent: {
      create: mocks.orderStatusEventCreate,
    },
    driverDeliveryEvent: {
      create: mocks.driverDeliveryEventCreate,
    },
    $transaction: async (callback: any) =>
      callback({
        order: {
          updateMany: mocks.orderUpdateMany,
          findFirst: mocks.orderFindFirst,
        },
        orderStatusEvent: {
          create: mocks.orderStatusEventCreate,
        },
        driverDeliveryEvent: {
          create: mocks.driverDeliveryEventCreate,
        },
      }),
  },
}));

const { default: driverRoutes } = await import('./driver.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/driver', driverRoutes);
  return app;
}

describe('driver routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.driverFindFirst.mockResolvedValue({
      id: 'driver-1',
      name: 'Entregador',
      phone: '11999999999',
      vehicle: 'Moto',
      isActive: true,
      admin: { id: 'admin-driver', name: 'Entregador', email: 'driver@test.local', role: 'DRIVER' },
    });
  });

  it('returns only orders assigned to the authenticated driver', async () => {
    mocks.orderFindMany.mockResolvedValue([]);

    const response = await request(createApp()).get('/api/driver/orders');

    expect(response.status).toBe(200);
    expect(mocks.orderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-driver',
          driverId: 'driver-1',
          fulfillmentType: 'DELIVERY',
          status: { in: ['OUT_FOR_DELIVERY', 'DELIVERED'] },
        }),
      }),
    );
  });

  it('rejects access when the user has no active linked driver profile', async () => {
    mocks.driverFindFirst.mockResolvedValue(null);

    const response = await request(createApp()).get('/api/driver/me');

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('Entregador ativo');
  });

  it('does not confirm an order that is not assigned to the authenticated driver', async () => {
    mocks.orderFindFirst.mockResolvedValue(null);

    const response = await request(createApp())
      .post('/api/driver/orders/order-other/confirm-delivery')
      .send({ receivedBy: 'Cliente' });

    expect(response.status).toBe(404);
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
  });

  it('confirms assigned delivery with status and delivery audit events', async () => {
    mocks.orderFindFirst
      .mockResolvedValueOnce({ id: 'order-1', status: 'OUT_FOR_DELIVERY' })
      .mockResolvedValueOnce({
        id: 'order-1',
        status: 'DELIVERED',
        updatedAt: new Date('2026-07-09T00:00:00.000Z'),
      });
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 });
    mocks.driverDeliveryEventCreate.mockResolvedValue({
      id: 'event-1',
      type: 'DELIVERY_CONFIRMED',
    });

    const response = await request(createApp())
      .post('/api/driver/orders/order-1/confirm-delivery')
      .send({ receivedBy: 'Cliente', note: 'Ok' });

    expect(response.status).toBe(200);
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-driver',
          driverId: 'driver-1',
          status: 'OUT_FOR_DELIVERY',
        }),
        data: { status: 'DELIVERED' },
      }),
    );
    expect(mocks.orderStatusEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-driver',
          orderId: 'order-1',
          actorId: 'admin-driver',
          source: 'DRIVER_DELIVERY_CONFIRMATION',
          newStatus: 'DELIVERED',
        }),
      }),
    );
    expect(mocks.driverDeliveryEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-driver',
          orderId: 'order-1',
          driverId: 'driver-1',
          type: 'DELIVERY_CONFIRMED',
        }),
      }),
    );
    expect(mocks.emitOrderEvent).toHaveBeenCalledWith(
      'tenant-driver',
      'order-status-changed',
      expect.objectContaining({ id: 'order-1', status: 'DELIVERED' }),
    );
  });

  it('prevents confirming the same delivery twice', async () => {
    mocks.orderFindFirst.mockResolvedValue({ id: 'order-1', status: 'DELIVERED' });

    const response = await request(createApp())
      .post('/api/driver/orders/order-1/confirm-delivery')
      .send({ receivedBy: 'Cliente' });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('ja confirmada');
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
  });

  it('records delivery failure without changing order status', async () => {
    mocks.orderFindFirst.mockResolvedValue({ id: 'order-1', status: 'OUT_FOR_DELIVERY' });
    mocks.driverDeliveryEventCreate.mockResolvedValue({ id: 'event-1', type: 'DELIVERY_FAILED' });

    const response = await request(createApp())
      .post('/api/driver/orders/order-1/delivery-failed')
      .send({ reason: 'Cliente ausente', note: 'Sem resposta' });

    expect(response.status).toBe(201);
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
    expect(mocks.driverDeliveryEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'DELIVERY_FAILED',
          status: 'OUT_FOR_DELIVERY',
        }),
      }),
    );
  });
});
