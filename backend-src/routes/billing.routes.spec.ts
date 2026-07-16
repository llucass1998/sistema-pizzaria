import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
}));

vi.mock('../core/context/TenantContext.js', () => ({
  getTenantId: () => 'tenant-billing',
}));

vi.mock('../middlewares/requireAdmin.js', () => ({
  requireAdmin: (req: any, _res: any, next: any) => {
    req.adminId = 'admin-1';
    req.adminRole = 'OWNER';
    next();
  },
}));

vi.mock('../middlewares/requireRole.js', () => ({
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    order: {
      findMany: mocks.orderFindMany,
    },
  },
}));

const { billingRoutes } = await import('./billing.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/billing', billingRoutes);
  return app;
}

describe('billing routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts only paid amounts in revenue and payment mix', async () => {
    const now = new Date('2026-07-09T15:00:00.000Z');
    mocks.orderFindMany.mockResolvedValueOnce([
      {
        id: 'order-paid',
        total: '100.00',
        amountPaid: '100.00',
        paymentStatus: 'PAID',
        paymentMethod: 'PIX',
        status: 'DELIVERED',
        createdAt: now,
        customer: { name: 'Cliente Pago' },
        items: [{ quantity: 2 }],
        invoice: { id: 'invoice-paid', status: 'PAID', payments: [] },
      },
      {
        id: 'order-partial',
        total: '100.00',
        amountPaid: '50.00',
        amountDue: '50.00',
        paymentStatus: 'PARTIALLY_PAID',
        paymentMethod: 'PIX',
        status: 'CONFIRMED',
        createdAt: now,
        customer: { name: 'Cliente Parcial' },
        items: [{ quantity: 1 }],
        invoice: { id: 'invoice-partial', status: 'PARTIAL', payments: [] },
      },
      {
        id: 'order-pending',
        total: '80.00',
        amountPaid: '0.00',
        amountDue: '80.00',
        paymentStatus: 'PENDING',
        paymentMethod: 'CASH',
        status: 'PENDING',
        createdAt: now,
        customer: { name: 'Cliente Pendente' },
        items: [{ quantity: 1 }],
        invoice: { id: 'invoice-pending', status: 'PENDING', payments: [] },
      },
    ]);

    const response = await request(createApp()).get('/api/billing/summary');

    expect(response.status).toBe(200);
    expect(response.body.todayRevenue).toBe(150);
    expect(response.body.pendingAmount).toBe(130);
    expect(response.body.paymentMix).toEqual([{ method: 'PIX', total: 150 }]);
    expect(response.body.pendingCount).toBe(2);
  });
});
