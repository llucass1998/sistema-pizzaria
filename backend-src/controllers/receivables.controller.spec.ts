import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReceivablesController } from './receivables.controller.js';

const mocks = vi.hoisted(() => ({
  invoices: [] as any[],
  findMany: vi.fn(),
  count: vi.fn(),
  findFirstOrThrow: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  paymentCreate: vi.fn(),
  paymentDelete: vi.fn(),
  orderUpdateMany: vi.fn(),
}));

vi.mock('../core/context/TenantContext.js', () => ({
  getTenantId: () => 'tenant-1',
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    invoice: {
      findMany: (...args: any[]) => mocks.findMany(...args),
      count: (...args: any[]) => mocks.count(...args),
      findFirstOrThrow: (...args: any[]) => mocks.findFirstOrThrow(...args),
      update: (...args: any[]) => mocks.update(...args),
      updateMany: (...args: any[]) => mocks.updateMany(...args),
    },
    payment: {
      create: (...args: any[]) => mocks.paymentCreate(...args),
      delete: (...args: any[]) => mocks.paymentDelete(...args),
    },
    order: {
      updateMany: (...args: any[]) => mocks.orderUpdateMany(...args),
    },
    $transaction: async (cb: any) => {
      return cb({
        invoice: {
          findFirstOrThrow: (...args: any[]) => mocks.findFirstOrThrow(...args),
          update: (...args: any[]) => mocks.update(...args),
          updateMany: (...args: any[]) => mocks.updateMany(...args),
        },
        payment: {
          create: (...args: any[]) => mocks.paymentCreate(...args),
          delete: (...args: any[]) => mocks.paymentDelete(...args),
        },
        order: {
          updateMany: (...args: any[]) => mocks.orderUpdateMany(...args),
        },
      });
    },
  },
}));

describe('ReceivablesController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getInvoices returns array when not paginated', async () => {
    const mockList = [{ id: 'inv-1', totalAmount: 100, status: 'PENDING', payments: [] }];
    mocks.findMany.mockResolvedValue(mockList);

    const req = { query: {} } as any;
    const res = { json: vi.fn() } as any;

    await ReceivablesController.getInvoices(req, res);
    expect(res.json).toHaveBeenCalledWith(mockList);
  });

  it('getInvoices returns paginated structure when paginated query is sent', async () => {
    const mockList = [{ id: 'inv-1', totalAmount: 100, status: 'PENDING', payments: [] }];
    mocks.count.mockResolvedValue(1);
    mocks.findMany.mockResolvedValue(mockList);

    const req = { query: { page: '1', limit: '10' } } as any;
    const res = { json: vi.fn() } as any;

    await ReceivablesController.getInvoices(req, res);
    expect(res.json).toHaveBeenCalledWith({
      data: mockList,
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it('getSummary calculates correct financial KPIs', async () => {
    const mockInvoices = [
      { id: 'inv-1', totalAmount: 100, status: 'PENDING', dueDate: new Date('2020-01-01'), payments: [] },
      { id: 'inv-2', totalAmount: 200, status: 'PAID', dueDate: new Date('2099-01-01'), payments: [{ amount: 200, status: 'COMPLETED' }] },
    ];
    mocks.findMany.mockResolvedValue(mockInvoices);

    const req = {} as any;
    const res = { json: vi.fn() } as any;

    await ReceivablesController.getSummary(req, res);
    expect(res.json).toHaveBeenCalledWith({
      totalPending: 100,
      totalPaid: 200,
      totalOverdue: 100,
      countPending: 1,
      countPaid: 1,
      countOverdue: 1,
      totalInvoices: 2,
    });
  });

  it('recordPayment registers a payment and updates invoice status', async () => {
    const mockInv = { id: 'inv-1', totalAmount: 100, status: 'PENDING', payments: [], orderId: 'ord-1' };
    mocks.findFirstOrThrow
      .mockResolvedValueOnce(mockInv)
      .mockResolvedValueOnce({ ...mockInv, status: 'PAID', payments: [{ id: 'pay-1', amount: 100, status: 'COMPLETED' }] });

    const req = { params: { invoiceId: 'inv-1' }, body: { amount: 100, method: 'PIX' } } as any;
    const res = { json: vi.fn() } as any;

    await ReceivablesController.recordPayment(req, res);
    expect(mocks.paymentCreate).toHaveBeenCalledWith({
      data: { invoiceId: 'inv-1', amount: 100, method: 'PIX' },
    });
    expect(mocks.updateMany).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'PAID' }));
  });

  it('reversePayment deletes payment and recalculates balance', async () => {
    const mockInv = {
      id: 'inv-1',
      totalAmount: 100,
      status: 'PAID',
      payments: [{ id: 'pay-1', amount: 100, method: 'PIX', status: 'COMPLETED' }],
      orderId: 'ord-1',
    };
    mocks.findFirstOrThrow
      .mockResolvedValueOnce(mockInv)
      .mockResolvedValueOnce({ ...mockInv, status: 'PENDING', payments: [] });

    const req = { params: { invoiceId: 'inv-1', paymentId: 'pay-1' } } as any;
    const res = { json: vi.fn() } as any;

    await ReceivablesController.reversePayment(req, res);
    expect(mocks.paymentDelete).toHaveBeenCalledWith({ where: { id: 'pay-1' } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING', payments: [] }));
  });
});
