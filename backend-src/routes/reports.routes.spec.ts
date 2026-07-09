import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  orderItemFindMany: vi.fn(),
  adminFindUnique: vi.fn(),
}));

vi.mock('../core/context/TenantContext.js', () => ({
  getTenantId: () => 'tenant-test',
}));

vi.mock('../middlewares/requireRole.js', () => ({
  requireRole: (_roles: string[]) => (req: any, res: any, next: () => void) => {
    const role = req.header('x-test-role') || 'ADMIN';
    if (!['OWNER', 'ADMIN', 'MANAGER'].includes(role)) {
      res.status(403).json({ message: 'Acesso negado.' });
      return;
    }
    req.adminId = 'admin-test-id';
    next();
  },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    order: {
      findMany: mocks.orderFindMany,
    },
    orderItem: {
      findMany: mocks.orderItemFindMany,
    },
    admin: {
      findUnique: mocks.adminFindUnique,
    },
  },
}));

import { reportsRoutes } from './reports.routes.js';

const app = express();
app.use(express.json());
app.use('/api/admin/reports', reportsRoutes);

describe('Reports Routes & BI Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminFindUnique.mockResolvedValue({ tenantId: 'tenant-test' });
  });

  it('deve bloquear acesso com role não permitida (ex: CASHIER)', async () => {
    const res = await request(app).get('/api/admin/reports/summary').set('x-test-role', 'CASHIER');
    expect(res.status).toBe(403);
  });

  it('GET /api/admin/reports/summary — deve retornar faturamento separado e sem NaN, ignorando cancelados no líquido', async () => {
    mocks.orderFindMany.mockResolvedValue([
      { id: '1', status: 'DELIVERED', paymentStatus: 'PAID', total: 100 },
      { id: '2', status: 'COMPLETED', paymentStatus: 'PAID', total: 150 },
      { id: '3', status: 'CANCELED', paymentStatus: 'REFUNDED', total: 80 },
      { id: '4', status: 'PENDING', paymentStatus: 'PENDING', total: 50 },
    ]);

    const res = await request(app)
      .get('/api/admin/reports/summary?quickRange=TODAY')
      .set('x-test-role', 'ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.revenueRealized).toBe(250); // 100 + 150
    expect(res.body.revenuePending).toBe(50); // apenas o PENDING
    expect(res.body.canceledAmount).toBe(80);
    expect(res.body.totalOrders).toBe(4);
    expect(res.body.completedOrders).toBe(2);
    expect(res.body.cancellationRate).toBe(25); // 1 em 4 = 25%
    expect(res.body.averageTicket).toBe(125); // 250 / 2
    expect(Number.isNaN(res.body.revenueRealized)).toBe(false);
  });

  it('GET /api/admin/reports/summary — deve retornar erro 400 se data for inválida', async () => {
    const res = await request(app)
      .get('/api/admin/reports/summary?startDate=invalida-data')
      .set('x-test-role', 'ADMIN');
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Data inicial');
  });

  it('GET /api/admin/reports/abc-products — deve calcular curva ABC corretamente', async () => {
    mocks.orderItemFindMany.mockResolvedValue([
      {
        productId: 'p1',
        displayName: 'Pizza A',
        quantity: 10,
        total: 850,
        product: { name: 'Pizza A' },
      },
      {
        productId: 'p2',
        displayName: 'Pizza B',
        quantity: 2,
        total: 100,
        product: { name: 'Pizza B' },
      },
      {
        productId: 'p3',
        displayName: 'Refri C',
        quantity: 5,
        total: 50,
        product: { name: 'Refri C' },
      },
    ]);

    const res = await request(app)
      .get('/api/admin/reports/abc-products?quickRange=LAST_30_DAYS')
      .set('x-test-role', 'MANAGER');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);
    expect(res.body[0].productName).toBe('Pizza A');
    expect(res.body[0].abcClass).toBe('A'); // 85% do total
    expect(res.body[2].abcClass).toBe('C'); // >95%
  });

  it('GET /api/admin/reports/sales-heatmap — deve retornar matriz 7x24 de vendas', async () => {
    mocks.orderFindMany.mockResolvedValue([
      { createdAt: new Date(), total: 100 },
      { createdAt: new Date(), total: 150 },
    ]);

    const res = await request(app)
      .get('/api/admin/reports/sales-heatmap?quickRange=TODAY')
      .set('x-test-role', 'OWNER');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(168); // 7 * 24
    const nonZeroCell = res.body.find((c: any) => c.ordersCount > 0);
    expect(nonZeroCell).toBeDefined();
    expect(nonZeroCell.revenue).toBe(250);
  });

  it('GET /api/admin/reports/driver-ranking — deve agrupar ranking de entregadores corretamente', async () => {
    mocks.orderFindMany.mockResolvedValue([
      {
        status: 'DELIVERED',
        total: 100,
        deliveryFee: 10,
        driverId: 'd1',
        driver: { id: 'd1', name: 'Motoboy João' },
      },
      {
        status: 'DELIVERED',
        total: 120,
        deliveryFee: 12,
        driverId: 'd1',
        driver: { id: 'd1', name: 'Motoboy João' },
      },
      { status: 'DELIVERED', total: 80, deliveryFee: 8, driverId: null, driver: null },
    ]);

    const res = await request(app)
      .get('/api/admin/reports/driver-ranking?quickRange=TODAY')
      .set('x-test-role', 'ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].driverName).toBe('Motoboy João');
    expect(res.body[0].deliveriesCompleted).toBe(2);
    expect(res.body[1].driverName).toBe('Sem entregador');
    expect(res.body[1].deliveriesCompleted).toBe(1);
  });

  it('GET /api/admin/reports/payment-methods — deve agrupar métodos de pagamento', async () => {
    mocks.orderFindMany.mockResolvedValue([
      { status: 'COMPLETED', paymentMethod: 'PIX', total: 100 },
      { status: 'COMPLETED', paymentMethod: 'CREDIT_CARD', total: 200 },
      { status: 'COMPLETED', paymentMethod: 'CASH', total: 100 },
    ]);

    const res = await request(app)
      .get('/api/admin/reports/payment-methods?quickRange=THIS_MONTH')
      .set('x-test-role', 'ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    const credit = res.body.find((p: any) => p.paymentMethod === 'CREDIT_CARD');
    expect(credit.label).toBe('Cartão de Crédito');
    expect(credit.totalAmount).toBe(200);
    expect(credit.percentage).toBe(50); // 200 em 400 = 50%
  });
});
