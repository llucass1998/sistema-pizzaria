import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinancialAnalyticsService } from './financialAnalytics.service.js';
import { basePrisma } from '../lib/prisma.js';

// Mock do prisma base
vi.mock('../lib/prisma.js', () => ({
  basePrisma: {
    order: { findMany: vi.fn() },
    accountPayable: { findMany: vi.fn() },
    payablePayment: { findMany: vi.fn() },
    shift: { findMany: vi.fn() },
    cashTransaction: { findMany: vi.fn() },
    ingredient: { findMany: vi.fn() },
  },
}));

describe('FinancialAnalyticsService — Sprint 3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Deve isolar queries obrigatoriamente por tenantId e separar faturamento realizado do previsto', async () => {
    const tenantId = 'tenant-123';

    // Mock retornando 1 pedido pago (100) e 1 pendente/a receber (50)
    vi.mocked(basePrisma.order.findMany).mockResolvedValueOnce([
      {
        id: 'ord-1',
        total: 100,
        status: 'DELIVERED',
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        createdAt: new Date(),
        orderItems: [],
      },
      {
        id: 'ord-2',
        total: 50,
        status: 'DELIVERED',
        paymentStatus: 'PENDING',
        paymentMethod: 'ONLINE',
        createdAt: new Date(),
        orderItems: [],
      },
    ] as any);

    vi.mocked(basePrisma.accountPayable.findMany).mockResolvedValue([]);
    vi.mocked(basePrisma.payablePayment.findMany).mockResolvedValue([]);
    vi.mocked(basePrisma.shift.findMany).mockResolvedValue([]);
    vi.mocked(basePrisma.order.findMany).mockResolvedValueOnce([]); // prevOrders
    vi.mocked(basePrisma.payablePayment.findMany).mockResolvedValueOnce([]); // prevPayments

    const summary = await FinancialAnalyticsService.getFinancialSummary(tenantId, 'TODAY');

    // Verifica se tenantId foi passado no where da query
    expect(basePrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-123' }),
      }),
    );

    // Regra anti-duplicidade: Apenas o pedido PAID (100) deve entrar na receita realizada
    expect(summary.kpis.grossRevenue).toBe(100);
    expect(summary.kpis.totalReceived).toBe(100);
    // O pedido PENDING (50) entra apenas como previsão a receber
    expect(summary.kpis.totalReceivable).toBe(50);
  });

  it('2. Deve apurar CMV seguro e marcar status como PARTIAL quando houver itens sem ficha técnica ou com custo zero', async () => {
    const tenantId = 'tenant-456';

    vi.mocked(basePrisma.order.findMany).mockResolvedValueOnce([
      {
        id: 'ord-10',
        total: 80,
        status: 'DELIVERED',
        paymentStatus: 'PAID',
        createdAt: new Date(),
        orderItems: [
          {
            id: 'item-1',
            quantity: 1,
            productId: 'prod-1',
            product: {
              id: 'prod-1',
              name: 'Pizza Calabresa',
              recipes: [
                {
                  quantity: 0.5,
                  ingredient: { id: 'ing-1', name: 'Queijo', cost: 40 }, // Custo: 20
                },
              ],
            },
          },
          {
            id: 'item-2',
            quantity: 1,
            productId: 'prod-2',
            product: {
              id: 'prod-2',
              name: 'Refrigerante 2L',
              recipes: [], // Sem ficha técnica!
            },
          },
        ],
      },
    ] as any);

    vi.mocked(basePrisma.accountPayable.findMany).mockResolvedValue([]);
    vi.mocked(basePrisma.payablePayment.findMany).mockResolvedValue([]);
    vi.mocked(basePrisma.shift.findMany).mockResolvedValue([]);
    vi.mocked(basePrisma.order.findMany).mockResolvedValueOnce([]);
    vi.mocked(basePrisma.payablePayment.findMany).mockResolvedValueOnce([]);

    const summary = await FinancialAnalyticsService.getFinancialSummary(tenantId, 'TODAY');

    // CMV calculado para o item 1: 0.5 * 40 = 20
    expect(summary.cmv.cmvTotal).toBe(20);
    // Como o Refrigerante 2L não tem ficha, status deve ser PARTIAL
    expect(summary.cmv.cmvStatus).toBe('PARTIAL');
    expect(summary.cmv.productsWithoutCost.length).toBe(1);
    expect(summary.cmv.productsWithoutCost[0].name).toBe('Refrigerante 2L');
  });

  it('3. Deve tratar pagamento parcial como entrada realizada apenas pelo valor pago', async () => {
    const tenantId = 'tenant-partial';

    vi.mocked(basePrisma.order.findMany).mockResolvedValueOnce([
      {
        id: 'ord-partial',
        total: 100,
        amountPaid: 50,
        amountDue: 50,
        status: 'DELIVERED',
        paymentStatus: 'PARTIALLY_PAID',
        paymentMethod: 'PIX',
        createdAt: new Date(),
        orderItems: [],
      },
    ] as any);

    vi.mocked(basePrisma.accountPayable.findMany).mockResolvedValue([]);
    vi.mocked(basePrisma.payablePayment.findMany).mockResolvedValue([]);
    vi.mocked(basePrisma.shift.findMany).mockResolvedValue([]);
    vi.mocked(basePrisma.order.findMany).mockResolvedValueOnce([]);
    vi.mocked(basePrisma.payablePayment.findMany).mockResolvedValueOnce([]);

    const summary = await FinancialAnalyticsService.getFinancialSummary(tenantId, 'TODAY');

    expect(summary.kpis.grossRevenue).toBe(50);
    expect(summary.kpis.totalReceived).toBe(50);
    expect(summary.kpis.totalReceivable).toBe(50);
    expect(summary.paymentMethods.PIX).toBe(50);
  });

  it('4. Deve separar fluxo realizado vs previsto e não somar CashTransaction como receita duplicada em getCashFlow', async () => {
    const tenantId = 'tenant-789';

    vi.mocked(basePrisma.order.findMany).mockResolvedValueOnce([
      { id: 'o-1', total: 200, paymentStatus: 'PAID', createdAt: new Date() },
    ] as any);

    vi.mocked(basePrisma.accountPayable.findMany).mockResolvedValueOnce([
      { id: 'ap-1', remainingAmount: 120, status: 'PENDING', dueDate: new Date(), payments: [] },
    ] as any);

    vi.mocked(basePrisma.cashTransaction.findMany).mockResolvedValueOnce([
      { id: 'ct-1', type: 'SANGRIA', amount: 30, createdAt: new Date() },
      { id: 'ct-2', type: 'SUPRIMENTO', amount: 50, createdAt: new Date() },
    ] as any);

    const flow = await FinancialAnalyticsService.getCashFlow(tenantId, 'TODAY');

    expect(flow.summary.realizedInflow).toBe(200);
    expect(flow.summary.predictedOutflow).toBe(120);
    expect(flow.summary.physicalSangria).toBe(30);
    expect(flow.summary.physicalSuprimento).toBe(50);
    // Saldo realizado não é afetado por sangria/suprimento de gaveta
    expect(flow.summary.realizedBalance).toBe(200);
  });
});
