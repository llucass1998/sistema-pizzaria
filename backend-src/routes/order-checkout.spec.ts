import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  adminFindFirst: vi.fn(),
  customerFindFirst: vi.fn(),
  customerFindUnique: vi.fn(),
  getStoreSettings: vi.fn(),
  productFindMany: vi.fn(),
  productVariantFindMany: vi.fn(),
  productOptionFindMany: vi.fn(),
  productOptionItemFindMany: vi.fn(),
  deliveryZoneFindFirst: vi.fn(),
  orderCreate: vi.fn(),
  invoiceCreate: vi.fn(),
  transaction: vi.fn(),
  baseTransaction: vi.fn(),
}));

vi.mock('../core/context/TenantContext.js', () => ({
  getTenantId: () => 'tenant-checkout',
}));

vi.mock('../lib/prisma.js', () => ({
  basePrisma: {
    $transaction: mocks.baseTransaction,
  },
  prisma: {
    admin: {
      findFirst: mocks.adminFindFirst,
    },
    customer: {
      findFirst: mocks.customerFindFirst,
      findUnique: mocks.customerFindUnique,
    },
    product: {
      findMany: mocks.productFindMany,
    },
    productVariant: {
      findMany: mocks.productVariantFindMany,
    },
    productOption: {
      findMany: mocks.productOptionFindMany,
    },
    productOptionItem: {
      findMany: mocks.productOptionItemFindMany,
    },
    deliveryZone: {
      findFirst: mocks.deliveryZoneFindFirst,
    },
    order: {
      create: mocks.orderCreate,
    },
    invoice: {
      create: mocks.invoiceCreate,
    },
    coupon: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    paymentTransaction: {
      upsert: vi.fn(),
    },
    $transaction: mocks.transaction,
  },
  rlsContext: {
    run: (_context: unknown, callback: () => void) => callback(),
  },
}));

vi.mock('../services/storeSettings.service.js', () => ({
  getStoreSettings: mocks.getStoreSettings,
}));

vi.mock('../utils/waha.js', () => ({
  sendWhatsAppMessage: vi.fn(),
}));

vi.mock('../services/PaymentGatewayService.js', () => ({
  PaymentGatewayService: {
    createPaymentLink: vi.fn(),
  },
}));

vi.mock('../services/ProductAvailabilityService.js', () => ({
  ProductAvailabilityService: {
    assertSelectionsAvailable: vi.fn(),
  },
}));

vi.mock('../services/inventory.service.js', () => ({
  InventoryService: {
    deductStockForOrderOrThrow: vi.fn(),
  },
}));

const { createToken } = await import('../utils/auth.js');
const { orderRoutes } = await import('./order.routes.js');

function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api', orderRoutes);
  return app;
}

function createCustomerToken() {
  return createToken({
    id: 'customer-1',
    sub: 'customer-1',
    customerId: 'customer-1',
    email: 'cliente@teste.com',
    role: 'CUSTOMER',
    type: 'CUSTOMER',
    tenantId: 'tenant-checkout',
  });
}

function createAdminToken() {
  return createToken({
    id: 'admin-1',
    sub: 'admin-1',
    userId: 'admin-1',
    email: 'admin@teste.com',
    role: 'CASHIER',
    type: 'STAFF',
    tenantId: 'tenant-checkout',
  });
}

function checkoutPayload(overrides: Record<string, unknown> = {}) {
  return {
    fulfillmentType: 'DELIVERY',
    paymentMethod: 'CASH',
    address: {
      street: 'Rua Teste',
      number: '123',
      neighborhood: 'Centro',
    },
    items: [{ productId: 'product-1', quantity: 1 }],
    ...overrides,
  };
}

describe('checkout order creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const customer = {
      id: 'customer-1',
      tenantId: 'tenant-checkout',
      name: 'Cliente Teste',
      email: 'cliente@teste.com',
      phone: '21999999999',
    };
    mocks.adminFindFirst.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@teste.com',
      role: 'CASHIER',
    });
    mocks.customerFindFirst.mockResolvedValue({ id: customer.id });
    mocks.customerFindUnique.mockResolvedValue(customer);
  });

  it('blocks customer tokens from another tenant before creating an order', async () => {
    mocks.customerFindFirst.mockResolvedValue(null);

    const response = await request(createApp())
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${createCustomerToken()}`)
      .send(checkoutPayload({ fulfillmentType: 'PICKUP', paymentMethod: 'PIX' }));

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Sessao de cliente invalida para esta loja.');
    expect(mocks.getStoreSettings).not.toHaveBeenCalled();
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it('blocks order creation when the store is closed', async () => {
    mocks.getStoreSettings.mockResolvedValue({
      isOpen: false,
      deliveryFee: '5.00',
      serviceFee: '2.00',
    });

    const response = await request(createApp())
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${createCustomerToken()}`)
      .send(checkoutPayload({ fulfillmentType: 'PICKUP', paymentMethod: 'PIX' }));

    expect(response.status).toBe(423);
    expect(response.body.message).toBe(
      'A loja esta fechada no momento. Volte durante o horario de atendimento para fazer seu pedido.',
    );
  });

  it('uses the active neighborhood fee without mixing the service fee into deliveryFee', async () => {
    mocks.getStoreSettings.mockResolvedValue({
      isOpen: true,
      deliveryFeeMode: 'NEIGHBORHOOD',
      deliveryFee: '5.00',
      serviceFee: '2.00',
    });
    mocks.productFindMany.mockResolvedValue([
      {
        id: 'product-1',
        name: 'Pizza Teste',
        price: '30.00',
        category: 'pizzas',
        menuCategory: { allowSizes: false, allowHalfAndHalf: false, slug: 'pizzas' },
        variants: [],
      },
    ]);
    mocks.productVariantFindMany.mockResolvedValue([]);
    mocks.productOptionFindMany.mockResolvedValue([]);
    mocks.productOptionItemFindMany.mockResolvedValue([]);
    mocks.deliveryZoneFindFirst.mockResolvedValue({
      id: 'zone-1',
      tenantId: 'tenant-checkout',
      name: 'Centro',
      fee: '8.00',
      minOrderValue: '20.00',
      isActive: true,
    });
    mocks.invoiceCreate.mockResolvedValue({ id: 'invoice-1', payments: [] });
    mocks.orderCreate.mockImplementation(async ({ data, include }) => ({
      id: 'order-1',
      createdAt: new Date('2026-07-08T12:00:00.000Z'),
      status: 'PENDING',
      ...data,
      customer: { id: 'customer-1', name: 'Cliente Teste' },
      items: [],
      invoice: include?.invoice ? { payments: [] } : undefined,
    }));
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        order: { create: mocks.orderCreate },
        invoice: { create: mocks.invoiceCreate },
        coupon: { update: vi.fn() },
        customer: { update: vi.fn() },
      }),
    );

    const response = await request(createApp())
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${createCustomerToken()}`)
      .send(checkoutPayload());

    expect(response.status).toBe(201);
    expect(mocks.orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryFee: '8.00',
          subtotal: '30.00',
          total: '40.00',
        }),
      }),
    );
  });

  it('blocks delivery checkout when the neighborhood is not active', async () => {
    mocks.getStoreSettings.mockResolvedValue({
      isOpen: true,
      deliveryFeeMode: 'NEIGHBORHOOD',
      deliveryFee: '5.00',
      serviceFee: '2.00',
    });
    mocks.productFindMany.mockResolvedValue([
      {
        id: 'product-1',
        name: 'Pizza Teste',
        price: '30.00',
        category: 'pizzas',
        menuCategory: { allowSizes: false, allowHalfAndHalf: false, slug: 'pizzas' },
        variants: [],
      },
    ]);
    mocks.productVariantFindMany.mockResolvedValue([]);
    mocks.productOptionFindMany.mockResolvedValue([]);
    mocks.productOptionItemFindMany.mockResolvedValue([]);
    mocks.deliveryZoneFindFirst.mockResolvedValue(null);

    const response = await request(createApp())
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${createCustomerToken()}`)
      .send(checkoutPayload());

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Ainda não entregamos neste bairro.');
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it('scopes product option items through their tenant-owned group', async () => {
    mocks.getStoreSettings.mockResolvedValue({
      isOpen: true,
      deliveryFeeMode: 'FIXED',
      deliveryFee: '0.00',
      serviceFee: '2.00',
    });
    mocks.productFindMany.mockResolvedValue([
      {
        id: 'product-1',
        name: 'Pizza Teste',
        price: '30.00',
        category: 'pizzas',
        menuCategory: { allowSizes: false, allowHalfAndHalf: false, slug: 'pizzas' },
        variants: [],
      },
    ]);
    mocks.productOptionFindMany.mockResolvedValue([]);
    mocks.productOptionItemFindMany.mockResolvedValue([]);

    await request(createApp())
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${createCustomerToken()}`)
      .send(checkoutPayload({ items: [{ productId: 'product-1', optionIds: ['option-1'] }] }));

    expect(mocks.productOptionItemFindMany).toHaveBeenCalledWith({
      where: {
        group: { tenantId: 'tenant-checkout' },
        id: { in: ['option-1'] },
        isAvailable: true,
      },
    });
  });

  it('allows partial remaining-balance payments while the order still has amountDue', async () => {
    const order = {
      id: 'order-partial-rest',
      tenantId: 'tenant-checkout',
      total: '100.00',
      amountPaid: '50.00',
      amountDue: '50.00',
      paymentStatus: 'PARTIALLY_PAID',
      paidAt: null,
      invoice: {
        id: 'invoice-1',
        payments: [{ id: 'payment-deposit', amount: '50.00', status: 'COMPLETED' }],
      },
    };
    const updatedOrder = {
      ...order,
      amountPaid: '75.00',
      amountDue: '25.00',
      paymentStatus: 'PARTIALLY_PAID',
      invoice: {
        ...order.invoice,
        payments: [
          ...order.invoice.payments,
          { id: 'payment-rest-1', amount: '25.00', status: 'COMPLETED' },
        ],
      },
    };
    const tx = {
      $queryRaw: vi.fn(async () => []),
      order: {
        findFirst: vi.fn().mockResolvedValueOnce(order).mockResolvedValueOnce(updatedOrder),
        update: vi.fn(),
      },
      paymentTransaction: { create: vi.fn() },
      invoice: { update: vi.fn() },
      payment: { create: vi.fn() },
      shift: { findFirst: vi.fn().mockResolvedValue(null) },
      cashTransaction: { create: vi.fn() },
    };
    mocks.baseTransaction.mockImplementation(async (callback) => callback(tx));

    const response = await request(createApp())
      .post('/api/admin/orders/order-partial-rest/pay-remaining')
      .set('Authorization', `Bearer ${createAdminToken()}`)
      .send({ method: 'PIX', amount: 25 });

    expect(response.status).toBe(200);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'REMAINING_PAYMENT',
        amount: '25.00',
        status: 'PAID',
        idempotencyKey: expect.stringMatching(/^order-partial-rest:REMAINING_PAYMENT:/),
      }),
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-partial-rest' },
      data: expect.objectContaining({
        paymentStatus: 'PARTIALLY_PAID',
        amountPaid: '75.00',
        amountDue: '25.00',
        remainingPaymentStatus: 'PARTIAL',
      }),
    });
  });
});
