import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  allowRole: true,
  shiftFindFirst: vi.fn(),
  shiftFindMany: vi.fn(),
  shiftCreate: vi.fn(),
  shiftUpdate: vi.fn(),
  transactionCreate: vi.fn(),
  registerFindMany: vi.fn(),
  registerCreate: vi.fn(),
  baseTransaction: vi.fn(),
  productFindMany: vi.fn(),
  variantFindMany: vi.fn(),
  optionFindMany: vi.fn(),
  optionItemFindMany: vi.fn(),
  customerUpsert: vi.fn(),
  orderCreate: vi.fn(),
  invoiceCreate: vi.fn(),
  eventCreate: vi.fn(),
  deductStock: vi.fn(),
  summaryMock: null as any,
  reportMock: null as any,
}));

vi.mock('../core/context/TenantContext.js', () => ({
  getTenantId: () => 'tenant-1',
}));

vi.mock('../middlewares/requireAdmin.js', () => ({
  requireAdmin: (req: any, _res: any, next: any) => {
    req.adminId = 'admin-1';
    req.adminRole = 'CASHIER';
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

vi.mock('../services/shiftAudit.service.js', () => ({
  ShiftAuditService: {
    getShiftSummary: vi.fn(async () => mocks.summaryMock),
    validateSangria: vi.fn(async (_t: string, _s: string, amount: number) => {
      if (amount > 500) {
        throw Object.assign(new Error('Saldo em caixa insuficiente para esta sangria.'), {
          statusCode: 422,
        });
      }
    }),
    getAuditReport: vi.fn(async () => mocks.reportMock),
  },
}));

vi.mock('../services/inventory.service.js', () => ({
  InventoryService: {
    deductStockForOrderOrThrow: mocks.deductStock,
  },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    shift: {
      findFirst: mocks.shiftFindFirst,
      findMany: mocks.shiftFindMany,
      create: mocks.shiftCreate,
      update: mocks.shiftUpdate,
    },
    cashTransaction: {
      create: mocks.transactionCreate,
    },
    cashRegister: {
      findMany: mocks.registerFindMany,
      create: mocks.registerCreate,
    },
  },
  basePrisma: {
    $transaction: mocks.baseTransaction,
  },
}));

import { posRouter } from './pos.routes.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/pos', posRouter);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode || 500).json({ message: err.message });
  });
  return app;
}

describe('POS Routes — Turnos e Auditoria de Caixa', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.allowRole = true;
    app = createTestApp();
    mocks.deductStock.mockResolvedValue({ deducted: true });
    mocks.summaryMock = {
      id: 'shift-1',
      cashRegisterName: 'Caixa 1',
      operatorName: 'Admin',
      status: 'OPEN',
      openingCash: 100,
      totalSales: 200,
      expectedClosingCash: 300,
      actualClosingCash: null,
      difference: null,
      auditStatus: 'IN_PROGRESS',
      transactions: [],
    };
    mocks.reportMock = {
      kpis: { totalShifts: 1, closedShifts: 0, totalSales: 200, netDifference: 0 },
      shifts: [mocks.summaryMock],
    };
    const tx = {
      product: { findMany: mocks.productFindMany },
      productVariant: { findMany: mocks.variantFindMany },
      productOption: { findMany: mocks.optionFindMany },
      productOptionItem: { findMany: mocks.optionItemFindMany },
      customer: { upsert: mocks.customerUpsert },
      order: { create: mocks.orderCreate },
      invoice: { create: mocks.invoiceCreate },
      shift: { findFirst: mocks.shiftFindFirst },
      cashTransaction: { create: mocks.transactionCreate },
      orderStatusEvent: { create: mocks.eventCreate },
    };
    mocks.baseTransaction.mockImplementation(async (callback) => callback(tx));
  });

  describe('GET /pos/shift/current', () => {
    it('bloqueia perfis administrativos fora do caixa', async () => {
      mocks.allowRole = false;

      const res = await request(app).get('/pos/shift/current');

      expect(res.status).toBe(403);
      expect(mocks.shiftFindFirst).not.toHaveBeenCalled();
    });

    it('deve retornar o turno aberto atual com resumo auditado', async () => {
      mocks.shiftFindFirst.mockResolvedValueOnce({
        id: 'shift-1',
        tenantId: 'tenant-1',
        status: 'OPEN',
      });

      const res = await request(app).get('/pos/shift/current');

      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.expectedClosingCash).toBe(300);
    });
  });

  describe('POST /pos/shift/open', () => {
    it('deve abrir um novo turno se não houver outro aberto no mesmo caixa', async () => {
      mocks.shiftFindFirst.mockResolvedValueOnce(null);
      mocks.shiftCreate.mockResolvedValueOnce({
        id: 'shift-2',
        cashRegisterId: 'reg-1',
        status: 'OPEN',
      });

      const res = await request(app).post('/pos/shift/open').send({
        cashRegisterId: 'reg-1',
        openingCash: 150,
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('shift-2');
    });

    it('deve falhar ao tentar abrir se já houver caixa aberto no terminal', async () => {
      mocks.shiftFindFirst.mockResolvedValueOnce({ id: 'shift-1', status: 'OPEN' });

      const res = await request(app).post('/pos/shift/open').send({
        cashRegisterId: 'reg-1',
        openingCash: 100,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Este caixa ja esta aberto/);
    });
  });

  describe('POST /pos/shift/transaction (Anti-fraude Sangria)', () => {
    it('deve registrar suprimento com sucesso', async () => {
      mocks.shiftFindFirst.mockResolvedValueOnce({ id: 'shift-1', status: 'OPEN' });
      mocks.transactionCreate.mockResolvedValueOnce({
        id: 'tx-10',
        type: 'SUPRIMENTO',
        amount: '50.00',
      });

      const res = await request(app).post('/pos/shift/transaction').send({
        shiftId: 'shift-1',
        type: 'SUPRIMENTO',
        amount: 50,
        description: 'Troco extra',
      });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('SUPRIMENTO');
    });

    it('deve bloquear sangria superior ao saldo disponível na gaveta (anti-fraude)', async () => {
      mocks.shiftFindFirst.mockResolvedValueOnce({ id: 'shift-1', status: 'OPEN' });

      const res = await request(app).post('/pos/shift/transaction').send({
        shiftId: 'shift-1',
        type: 'SANGRIA',
        amount: 600, // Maior que 500 no mock
        description: 'Retirada excessiva',
      });

      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/Saldo em caixa insuficiente para esta sangria/);
    });
  });

  describe('GET /pos/shift/audit', () => {
    it('deve retornar relatório consolidado de auditoria de turnos', async () => {
      const res = await request(app).get('/pos/shift/audit');

      expect(res.status).toBe(200);
      expect(res.body.kpis).toBeDefined();
      expect(res.body.kpis.totalSales).toBe(200);
      expect(res.body.shifts).toHaveLength(1);
    });
  });

  describe('POST /pos/orders', () => {
    it('aceita adicional de grupo de produto no pedido do POS', async () => {
      mocks.productFindMany.mockResolvedValueOnce([
        {
          id: 'product-1',
          name: 'Pizza Teste',
          price: '30.00',
          imageUrl: null,
          menuCategory: { kdsStation: 'OVEN', prepTimeMinutes: 15 },
        },
      ]);
      mocks.variantFindMany.mockResolvedValueOnce([]);
      mocks.optionFindMany.mockResolvedValueOnce([]);
      mocks.optionItemFindMany.mockResolvedValueOnce([
        { id: 'option-item-1', name: 'Borda Catupiry', price: '8.00' },
      ]);
      mocks.customerUpsert.mockResolvedValueOnce({ id: 'customer-pos' });
      mocks.orderCreate.mockImplementationOnce(async ({ data }) => ({
        id: 'order-pos',
        ...data,
        customer: { id: 'customer-pos' },
        items: [],
      }));
      mocks.invoiceCreate.mockResolvedValueOnce({ id: 'invoice-pos', payments: [] });
      mocks.shiftFindFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/pos/orders')
        .send({
          paymentMethod: 'CASH',
          items: [{ productId: 'product-1', quantity: 1, optionIds: ['option-item-1'] }],
        });

      expect(res.status).toBe(201);
      expect(mocks.optionItemFindMany).toHaveBeenCalledWith({
        where: { group: { tenantId: 'tenant-1' }, id: { in: ['option-item-1'] }, isAvailable: true },
      });
      expect(mocks.orderCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: '38.00',
            total: '38.00',
            items: {
              create: [
                expect.objectContaining({
                  optionsTotal: '8.00',
                  unitPrice: '38.00',
                  total: '38.00',
                }),
              ],
            },
          }),
        }),
      );
      expect(mocks.deductStock).toHaveBeenCalledWith('order-pos', 'tenant-1', expect.any(Object));
    });

    it('bloqueia venda do POS quando a baixa de estoque falha', async () => {
      mocks.productFindMany.mockResolvedValueOnce([
        {
          id: 'product-1',
          name: 'Pizza Teste',
          price: '30.00',
          imageUrl: null,
          menuCategory: { kdsStation: 'OVEN', prepTimeMinutes: 15 },
        },
      ]);
      mocks.variantFindMany.mockResolvedValueOnce([]);
      mocks.optionFindMany.mockResolvedValueOnce([]);
      mocks.optionItemFindMany.mockResolvedValueOnce([]);
      mocks.customerUpsert.mockResolvedValueOnce({ id: 'customer-pos' });
      mocks.orderCreate.mockImplementationOnce(async ({ data }) => ({
        id: 'order-pos-stock',
        ...data,
        customer: { id: 'customer-pos' },
        items: [],
      }));
      mocks.deductStock.mockRejectedValueOnce(
        Object.assign(new Error('Estoque insuficiente de Mussarela.'), { statusCode: 409 }),
      );

      const res = await request(app)
        .post('/pos/orders')
        .send({ paymentMethod: 'CASH', items: [{ productId: 'product-1', quantity: 1 }] });

      expect(res.status).toBe(409);
      expect(mocks.deductStock).toHaveBeenCalledWith('order-pos-stock', 'tenant-1', expect.any(Object));
      expect(mocks.invoiceCreate).not.toHaveBeenCalled();
      expect(mocks.transactionCreate).not.toHaveBeenCalled();
    });
  });
});
