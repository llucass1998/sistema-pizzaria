import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShiftAuditService } from './shiftAudit.service.js';

const TENANT = 'tenant-audit-1';
const SHIFT_ID = 'shift-100';

function makeMockDb(shiftData = {}) {
  const defaultShift = {
    id: SHIFT_ID,
    tenantId: TENANT,
    cashRegisterId: 'reg-1',
    adminId: 'admin-1',
    openingCash: '100.00',
    status: 'OPEN',
    startTime: new Date(),
    endTime: null,
    actualClosingCash: null,
    cashRegister: { name: 'Caixa Principal' },
    admin: { name: 'João Operador', email: 'joao@pizza.com' },
    transactions: [
      { id: 'tx-1', type: 'SALE', amount: '50.00', paymentMethodId: 'CASH', createdAt: new Date() },
      { id: 'tx-2', type: 'SALE', amount: '80.00', paymentMethodId: 'PIX', createdAt: new Date() },
      { id: 'tx-3', type: 'SUPRIMENTO', amount: '20.00', createdAt: new Date() },
      { id: 'tx-4', type: 'SANGRIA', amount: '30.00', createdAt: new Date() },
    ],
    ...shiftData,
  };

  const shifts: any[] = [defaultShift];

  const db = {
    shift: {
      findFirst: vi.fn(async ({ where }: any) => {
        return shifts.find((s) => s.id === where.id && s.tenantId === where.tenantId) || null;
      }),
      findMany: vi.fn(async () => shifts),
    },
  };

  return { db, shifts };
}

describe('ShiftAuditService', () => {
  let db: any;

  beforeEach(() => {
    vi.clearAllMocks();
    const mock = makeMockDb();
    db = mock.db;
  });

  describe('getShiftSummary', () => {
    it('deve calcular corretamente saldo esperado e totais por forma de pagamento', async () => {
      const summary = await ShiftAuditService.getShiftSummary(TENANT, SHIFT_ID, db);

      expect(summary.openingCash).toBe(100);
      expect(summary.totalSales).toBe(130);
      expect(summary.salesByMethod['CASH']).toBe(50);
      expect(summary.salesByMethod['PIX']).toBe(80);
      expect(summary.suprimento).toBe(20);
      expect(summary.sangria).toBe(30);
      // Expected = 100 + 50 (CASH) + 20 - 30 = 140
      expect(summary.expectedClosingCash).toBe(140);
      expect(summary.auditStatus).toBe('IN_PROGRESS');
    });

    it('deve apontar falta de caixa (DEFICIT) quando o saldo real for menor que o esperado', async () => {
      const mock = makeMockDb({
        status: 'CLOSED',
        endTime: new Date(),
        actualClosingCash: '130.00', // Esperado era 140
      });

      const summary = await ShiftAuditService.getShiftSummary(TENANT, SHIFT_ID, mock.db);

      expect(summary.actualClosingCash).toBe(130);
      expect(summary.difference).toBe(-10);
      expect(summary.auditStatus).toBe('DEFICIT');
    });

    it('deve apontar sobra de caixa (SURPLUS) quando o saldo real for maior que o esperado', async () => {
      const mock = makeMockDb({
        status: 'CLOSED',
        endTime: new Date(),
        actualClosingCash: '150.00', // Esperado era 140
      });

      const summary = await ShiftAuditService.getShiftSummary(TENANT, SHIFT_ID, mock.db);

      expect(summary.actualClosingCash).toBe(150);
      expect(summary.difference).toBe(10);
      expect(summary.auditStatus).toBe('SURPLUS');
    });
  });

  describe('validateSangria', () => {
    it('deve aprovar sangria dentro do limite de saldo em dinheiro da gaveta', async () => {
      // Saldo em dinheiro = 140
      await expect(ShiftAuditService.validateSangria(TENANT, SHIFT_ID, 100, db)).resolves.not.toThrow();
    });

    it('deve bloquear sangria superior ao dinheiro disponível na gaveta (anti-fraude)', async () => {
      // Saldo em dinheiro = 140
      await expect(ShiftAuditService.validateSangria(TENANT, SHIFT_ID, 200, db)).rejects.toThrow(
        /Saldo em caixa insuficiente para esta sangria/
      );
    });

    it('não deve permitir sangria em caixa fechado', async () => {
      const mock = makeMockDb({ status: 'CLOSED' });
      await expect(ShiftAuditService.validateSangria(TENANT, SHIFT_ID, 10, mock.db)).rejects.toThrow(
        'Não é possível realizar sangria em um caixa fechado.'
      );
    });
  });

  describe('getAuditReport', () => {
    it('deve consolidar os KPIs de auditoria de múltiplos turnos', async () => {
      const report = await ShiftAuditService.getAuditReport(TENANT, {}, db);

      expect(report.kpis.totalShifts).toBe(1);
      expect(report.kpis.totalSales).toBe(130);
      expect(report.kpis.totalSangria).toBe(30);
    });
  });
});
