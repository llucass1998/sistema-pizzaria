import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  shiftFindFirst: vi.fn(),
  shiftFindMany: vi.fn(),
  shiftCreate: vi.fn(),
  shiftUpdate: vi.fn(),
  transactionCreate: vi.fn(),
  registerFindMany: vi.fn(),
  registerCreate: vi.fn(),
  summaryMock: null as any,
  reportMock: null as any,
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
  basePrisma: {},
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
    app = createTestApp();
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
  });

  describe('GET /pos/shift/current', () => {
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
});
