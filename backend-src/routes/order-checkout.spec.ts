import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
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
}));

vi.mock('../core/context/TenantContext.js', () => ({
  getTenantId: () => 'tenant-checkout',
}));

vi.mock('../lib/prisma.js', () => ({
  basePrisma: {},
  prisma: {
    customer: {
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
    email: 'cliente@teste.com',
    role: 'CUSTOMER',
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
    mocks.customerFindUnique.mockResolvedValue({
      id: 'customer-1',
      tenantId: 'tenant-checkout',
      name: 'Cliente Teste',
      email: 'cliente@teste.com',
      phone: '21999999999',
    });
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
});
