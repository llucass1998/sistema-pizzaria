import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  driverFindFirst: vi.fn(),
  orderFindMany: vi.fn(),
  orderFindFirst: vi.fn(),
  orderUpdateMany: vi.fn(),
  orderStatusEventCreate: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock('../core/context/TenantContext.js', () => ({
  getTenantId: () => 'tenant-dispatch',
}));

vi.mock('../middlewares/requireRole.js', () => ({
  requireRole: (_roles: string[]) => (req: any, _res: any, next: () => void) => {
    req.adminId = 'admin-driver';
    req.adminRole = req.header('x-test-role') || 'DRIVER';
    next();
  },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    driver: {
      findFirst: mocks.driverFindFirst,
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    admin: {
      findFirst: vi.fn(),
    },
    order: {
      findMany: mocks.orderFindMany,
      findFirst: mocks.orderFindFirst,
      updateMany: mocks.orderUpdateMany,
    },
    orderStatusEvent: {
      create: mocks.orderStatusEventCreate,
    },
    $transaction: async (callback: any) =>
      callback({
        $queryRaw: (...args: any[]) => mocks.queryRaw(...args),
        order: {
          updateMany: mocks.orderUpdateMany,
          findFirst: mocks.orderFindFirst,
        },
        orderStatusEvent: {
          create: mocks.orderStatusEventCreate,
        },
      }),
  },
}));

const { default: dispatchRoutes } = await import('./dispatch.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/dispatch', dispatchRoutes);
  return app;
}

describe('dispatch driver permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.driverFindFirst.mockResolvedValue({ id: 'driver-1' });
  });

  it('filters ready orders to the linked driver profile', async () => {
    mocks.orderFindMany.mockResolvedValue([]);

    const response = await request(createApp())
      .get('/api/admin/dispatch/ready-orders')
      .set('x-test-role', 'DRIVER');

    expect(response.status).toBe(200);
    expect(mocks.orderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-dispatch',
          driverId: 'driver-1',
          status: { in: ['OUT_FOR_DELIVERY'] },
        }),
      }),
    );
  });

  it('rejects delivery completion when driver role has no active linked profile', async () => {
    mocks.driverFindFirst.mockResolvedValue(null);

    const response = await request(createApp())
      .patch('/api/admin/dispatch/orders/order-1/status')
      .set('x-test-role', 'DRIVER')
      .send({ status: 'DELIVERED' });

    expect(response.status).toBe(403);
    expect(mocks.orderFindFirst).not.toHaveBeenCalled();
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
  });

  it('allows the linked driver to mark an assigned delivery as delivered', async () => {
    mocks.queryRaw.mockResolvedValue([]);
    mocks.orderFindFirst
      .mockResolvedValueOnce({ id: 'order-1' })
      .mockResolvedValueOnce({ id: 'order-1', status: 'DELIVERED' });
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 });

    const response = await request(createApp())
      .patch('/api/admin/dispatch/orders/order-1/status')
      .set('x-test-role', 'DRIVER')
      .send({ status: 'DELIVERED' });

    expect(response.status).toBe(200);
    expect(mocks.orderFindFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-dispatch',
          driverId: 'driver-1',
          status: 'OUT_FOR_DELIVERY',
        }),
      }),
    );
    expect(mocks.queryRaw).toHaveBeenCalled();
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-dispatch',
          driverId: 'driver-1',
          status: 'OUT_FOR_DELIVERY',
        }),
      }),
    );
    expect(mocks.orderStatusEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-dispatch',
          orderId: 'order-1',
          actorId: 'admin-driver',
          newStatus: 'DELIVERED',
        }),
      }),
    );
  });
});
