import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  customerFindUnique: vi.fn(),
  getStoreSettings: vi.fn(),
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

    const token = createToken({
      id: 'customer-1',
      email: 'cliente@teste.com',
      role: 'CUSTOMER',
    });

    const response = await request(createApp())
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fulfillmentType: 'PICKUP',
        paymentMethod: 'PIX',
        customerId: 'customer-1',
        items: [{ productId: 'product-1', quantity: 1 }],
      });

    expect(response.status).toBe(423);
    expect(response.body.message).toBe(
      'A loja esta fechada no momento. Volte durante o horario de atendimento para fazer seu pedido.',
    );
  });
});
