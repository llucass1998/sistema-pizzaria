import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PayablesService } from './payables.service.js';
import { Prisma } from '../../generated/prisma/index.js';

const TENANT = 'tenant-test-1';
const PAYABLE_ID = 'payable-100';

function makeMockDb() {
  const payables: any[] = [];
  const payments: any[] = [];

  const mockTx = {
    accountPayable: {
      findFirst: vi.fn(async ({ where }: any) => {
        return payables.find((p) => p.id === where.id && p.tenantId === where.tenantId) || null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const item = { id: PAYABLE_ID, ...data, createdAt: new Date(), updatedAt: new Date(), payments: [] };
        payables.push(item);
        return item;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = payables.findIndex((p) => p.id === where.id);
        if (idx > -1) {
          payables[idx] = { ...payables[idx], ...data, updatedAt: new Date() };
          return payables[idx];
        }
        return null;
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
      findMany: vi.fn(async () => payables),
      aggregate: vi.fn(async () => ({ _sum: { remainingAmount: new Prisma.Decimal(500) } })),
    },
    payablePayment: {
      create: vi.fn(async ({ data }: any) => {
        const item = { id: 'payment-1', ...data, createdAt: new Date() };
        payments.push(item);
        return item;
      }),
      aggregate: vi.fn(async () => ({ _sum: { amount: new Prisma.Decimal(200) } })),
    },
  };

  const db = {
    ...mockTx,
    $transaction: vi.fn(async (cb: any) => {
      return cb(mockTx);
    }),
  };

  return { db, payables, payments, mockTx };
}

describe('PayablesService', () => {
  let db: any;
  let payables: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    const mock = makeMockDb();
    db = mock.db;
    payables = mock.payables;
  });

  describe('createPayable', () => {
    it('deve criar uma nova conta a pagar com sucesso', async () => {
      const result = await PayablesService.createPayable(
        {
          tenantId: TENANT,
          description: 'Fornecedor Queijo',
          category: 'SUPPLIER',
          amount: 1500,
          dueDate: '2026-07-10',
        },
        db
      );

      expect(result.id).toBe(PAYABLE_ID);
      expect(result.amount).toEqual(new Prisma.Decimal(1500));
      expect(result.remainingAmount).toEqual(new Prisma.Decimal(1500));
      expect(result.status).toBe('PENDING');
      expect(db.accountPayable.create).toHaveBeenCalled();
    });

    it('deve falhar se o valor for menor ou igual a zero', async () => {
      await expect(
        PayablesService.createPayable(
          {
            tenantId: TENANT,
            description: 'Invalida',
            category: 'OTHER',
            amount: -10,
            dueDate: '2026-07-10',
          },
          db
        )
      ).rejects.toThrow('O valor da despesa deve ser maior que zero.');
    });

    it('deve falhar se a descrição for vazia', async () => {
      await expect(
        PayablesService.createPayable(
          {
            tenantId: TENANT,
            description: '',
            category: 'OTHER',
            amount: 100,
            dueDate: '2026-07-10',
          },
          db
        )
      ).rejects.toThrow('A descrição da despesa é obrigatória.');
    });
  });

  describe('recordPayment', () => {
    beforeEach(() => {
      payables.push({
        id: PAYABLE_ID,
        tenantId: TENANT,
        description: 'Aluguel',
        amount: new Prisma.Decimal(2000),
        paidAmount: new Prisma.Decimal(0),
        remainingAmount: new Prisma.Decimal(2000),
        status: 'PENDING',
      });
    });

    it('deve registrar pagamento parcial corretamente', async () => {
      const result = await PayablesService.recordPayment(
        {
          tenantId: TENANT,
          accountPayableId: PAYABLE_ID,
          amount: 500,
          paymentMethod: 'PIX',
        },
        db
      );

      expect(result.paidAmount).toEqual(new Prisma.Decimal(500));
      expect(result.remainingAmount).toEqual(new Prisma.Decimal(1500));
      expect(result.status).toBe('PARTIALLY_PAID');
    });

    it('deve registrar pagamento total alterando status para PAID', async () => {
      const result = await PayablesService.recordPayment(
        {
          tenantId: TENANT,
          accountPayableId: PAYABLE_ID,
          amount: 2000,
          paymentMethod: 'TRANSFER',
        },
        db
      );

      expect(result.paidAmount).toEqual(new Prisma.Decimal(2000));
      expect(result.remainingAmount).toEqual(new Prisma.Decimal(0));
      expect(result.status).toBe('PAID');
    });

    it('deve falhar ao tentar pagar mais que o saldo devedor', async () => {
      await expect(
        PayablesService.recordPayment(
          {
            tenantId: TENANT,
            accountPayableId: PAYABLE_ID,
            amount: 2500,
            paymentMethod: 'PIX',
          },
          db
        )
      ).rejects.toThrow(/é maior que o saldo devedor/);
    });

    it('deve falhar em despesa já cancelada', async () => {
      payables[0].status = 'CANCELED';
      await expect(
        PayablesService.recordPayment(
          {
            tenantId: TENANT,
            accountPayableId: PAYABLE_ID,
            amount: 100,
            paymentMethod: 'PIX',
          },
          db
        )
      ).rejects.toThrow('Não é possível realizar pagamentos em uma despesa cancelada.');
    });
  });

  describe('cancelPayable', () => {
    it('deve cancelar conta pendente', async () => {
      payables.push({
        id: PAYABLE_ID,
        tenantId: TENANT,
        status: 'PENDING',
      });

      const result = await PayablesService.cancelPayable(TENANT, PAYABLE_ID, db);
      expect(result.status).toBe('CANCELED');
    });

    it('não deve permitir cancelar despesa já paga', async () => {
      payables.push({
        id: PAYABLE_ID,
        tenantId: TENANT,
        status: 'PAID',
      });

      await expect(PayablesService.cancelPayable(TENANT, PAYABLE_ID, db)).rejects.toThrow(
        'Não é possível cancelar uma despesa já quitada.'
      );
    });
  });

  describe('getPayablesSummary', () => {
    it('deve retornar resumo executivo com os totais calculados', async () => {
      const summary = await PayablesService.getPayablesSummary(TENANT, db);
      expect(summary).toHaveProperty('totalOverdue', 500);
      expect(summary).toHaveProperty('dueIn7Days', 500);
      expect(summary).toHaveProperty('dueIn30Days', 500);
      expect(summary).toHaveProperty('totalPending', 500);
      expect(summary).toHaveProperty('paidThisMonth', 200);
    });
  });
});
