import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  allowRole: true,
  deduct: vi.fn(),
  orderFindMany: vi.fn(),
  orderFindFirst: vi.fn(),
  orderUpdate: vi.fn(),
  orderUpdateMany: vi.fn(),
  orderItemFindFirst: vi.fn(),
  orderItemUpdate: vi.fn(),
  orderItemUpdateMany: vi.fn(),
  eventCreate: vi.fn(),
  lastFindManyWhere: null as any,
}));

vi.mock('../core/context/TenantContext.js', () => ({
  getTenantId: () => 'tenant-1',
}));

vi.mock('../middlewares/requireAdmin.js', () => ({
  requireAdmin: (req: any, _res: any, next: any) => {
    req.adminId = 'admin-1';
    next();
  },
}));

vi.mock('../middlewares/requireRole.js', () => ({
  requireRole: () => (_req: any, res: any, next: any) => {
    if (!mocks.allowRole) {
      res.status(403).json({ message: 'Acesso negado para o seu perfil.' });
      return;
    }
    next();
  },
}));

vi.mock('../services/inventory.service.js', () => ({
  InventoryService: {
    deductStockForOrderOrThrow: mocks.deduct,
  },
}));

vi.mock('../lib/prisma.js', () => {
  const tx = {
    order: {
      update: mocks.orderUpdate,
      updateMany: mocks.orderUpdateMany,
      findFirst: mocks.orderFindFirst,
    },
    orderItem: {
      update: mocks.orderItemUpdate,
      updateMany: mocks.orderItemUpdateMany,
    },
    orderStatusEvent: {
      create: mocks.eventCreate,
    },
  };

  return {
    basePrisma: {
      order: {
        findMany: (args: any) => {
          mocks.lastFindManyWhere = args.where;
          return mocks.orderFindMany(args);
        },
        findFirst: mocks.orderFindFirst,
        update: mocks.orderUpdate,
        updateMany: mocks.orderUpdateMany,
      },
      orderItem: {
        findFirst: mocks.orderItemFindFirst,
        update: mocks.orderItemUpdate,
        updateMany: mocks.orderItemUpdateMany,
      },
      orderStatusEvent: {
        create: mocks.eventCreate,
      },
      $transaction: async (callback: any) => callback(tx),
    },
  };
});

const { kdsRouter } = await import('./kds.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/kds', kdsRouter);
  return app;
}

function createOrder(overrides: any = {}) {
  return {
    id: 'order-1',
    tenantId: 'tenant-1',
    status: 'PENDING',
    origin: 'SITE_PROPRIO',
    fulfillmentType: 'PICKUP',
    notes: null,
    createdAt: new Date(),
    customer: { id: 'customer-1', name: 'Cliente', phone: '11999999999' },
    items: [
      {
        id: 'item-1',
        orderId: 'order-1',
        productId: 'product-1',
        displayName: 'Pizza',
        quantity: 1,
        customizations: null,
        optionsSnapshot: null,
        halfAndHalfData: null,
        kdsStatus: 'READY',
        product: { name: 'Pizza' },
      },
    ],
    ...overrides,
  };
}

describe('kdsRouter', () => {
  beforeEach(() => {
    mocks.allowRole = true;
    mocks.deduct.mockReset().mockResolvedValue({ deducted: true });
    mocks.orderFindMany.mockReset().mockResolvedValue([createOrder()]);
    mocks.orderFindFirst.mockReset().mockResolvedValue(createOrder());
    mocks.orderUpdate.mockReset().mockResolvedValue({});
    mocks.orderUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    mocks.orderItemFindFirst.mockReset().mockResolvedValue({
      id: 'item-1',
      orderId: 'order-1',
      order: createOrder({ status: 'PREPARING' }),
    });
    mocks.orderItemUpdate.mockReset().mockResolvedValue({});
    mocks.orderItemUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    mocks.eventCreate.mockReset().mockResolvedValue({});
    mocks.lastFindManyWhere = null;
  });

  it('lists queue and respects tenant filter', async () => {
    const response = await request(createApp()).get('/api/admin/kds/queue');

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.kitchenQueue).toHaveLength(1);
    expect(mocks.lastFindManyWhere.tenantId).toBe('tenant-1');
  });

  it('starts preparation and deducts stock', async () => {
    const response = await request(createApp()).post('/api/admin/kds/orders/order-1/start');

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(mocks.deduct).toHaveBeenCalledWith('order-1', 'tenant-1', expect.anything());
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', tenantId: 'tenant-1', status: 'PENDING' },
      data: { status: 'PREPARING' },
    });
  });

  it('blocks start when stock is missing', async () => {
    mocks.deduct.mockRejectedValueOnce(
      Object.assign(new Error('Estoque insuficiente de Massa.'), { statusCode: 409 }),
    );

    const response = await request(createApp()).post('/api/admin/kds/orders/order-1/start');

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('Estoque insuficiente');
  });

  it('does not deduct again when preparation was already started', async () => {
    mocks.orderFindFirst.mockResolvedValue(createOrder({ status: 'PREPARING' }));

    const response = await request(createApp()).post('/api/admin/kds/orders/order-1/start');

    expect(response.status).toBe(200);
    expect(mocks.deduct).not.toHaveBeenCalled();
  });

  it('does not start an order outside the current tenant', async () => {
    mocks.orderFindFirst.mockResolvedValue(null);

    const response = await request(createApp()).post('/api/admin/kds/orders/order-2/start');

    expect(response.status).toBe(404);
    expect(mocks.deduct).not.toHaveBeenCalled();
  });

  it('marks an item ready', async () => {
    const response = await request(createApp()).post('/api/admin/kds/items/item-1/ready');

    expect(response.status).toBe(200);
    expect(mocks.orderItemUpdateMany).toHaveBeenCalledWith({
      where: { id: 'item-1', order: { tenantId: 'tenant-1' } },
      data: { kdsStatus: 'READY', kdsReadyAt: expect.any(Date) },
    });
  });

  it('marks pickup order ready', async () => {
    mocks.orderFindFirst.mockResolvedValue(createOrder({ status: 'PREPARING' }));

    const response = await request(createApp()).post('/api/admin/kds/orders/order-1/ready');

    expect(response.status).toBe(200);
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', tenantId: 'tenant-1', status: 'PREPARING' },
      data: { status: 'READY' },
    });
  });

  it('dispatches delivery order', async () => {
    mocks.orderFindFirst.mockResolvedValue(
      createOrder({ status: 'PREPARING', fulfillmentType: 'DELIVERY' }),
    );

    const response = await request(createApp()).post('/api/admin/kds/orders/order-1/dispatch');

    expect(response.status).toBe(200);
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', tenantId: 'tenant-1', status: 'PREPARING' },
      data: { status: 'OUT_FOR_DELIVERY' },
    });
  });

  it('rejects invalid transition', async () => {
    mocks.orderFindFirst.mockResolvedValue(createOrder({ status: 'READY' }));

    const response = await request(createApp()).post('/api/admin/kds/orders/order-1/start');

    expect(response.status).toBe(422);
  });

  it('blocks unauthorized role', async () => {
    mocks.allowRole = false;

    const response = await request(createApp()).get('/api/admin/kds/queue');

    expect(response.status).toBe(403);
  });

  it('returns serverNow and filters queue by station', async () => {
    mocks.allowRole = true;
    const pizzaOrder = createOrder({
      id: 'order-pizza',
      items: [
        {
          id: 'item-pizza',
          orderId: 'order-pizza',
          productId: 'prod-1',
          displayName: 'Pizza Calabresa',
          quantity: 1,
          kdsStatus: 'PREPARING',
          product: {
            name: 'Pizza Calabresa',
            menuCategory: { kdsStation: 'OVEN', prepTimeMinutes: 15 },
          },
        },
        {
          id: 'item-coca',
          orderId: 'order-pizza',
          productId: 'prod-2',
          displayName: 'Coca Cola',
          quantity: 1,
          kdsStatus: 'PREPARING',
          product: {
            name: 'Coca Cola',
            menuCategory: { kdsStation: 'BEVERAGE', prepTimeMinutes: 2 },
          },
        },
      ],
    });
    mocks.orderFindMany.mockResolvedValue([pizzaOrder]);

    const resAll = await request(createApp()).get('/api/admin/kds/queue');
    expect(resAll.status).toBe(200);
    expect(resAll.body.serverNow).toBeDefined();
    expect(resAll.body.orders[0].items.length).toBe(2);

    const resOven = await request(createApp()).get('/api/admin/kds/queue?station=OVEN');
    expect(resOven.status).toBe(200);
    expect(resOven.body.orders[0].items.length).toBe(1);
    expect(resOven.body.orders[0].items[0].kdsStation).toBe('OVEN');
    expect(resOven.body.orders[0].items[0].prepTimeMinutes).toBe(15);
  });
});
