import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  normalizeWebhook: vi.fn(),
  webhookCreate: vi.fn(),
  webhookUpdate: vi.fn(),
  orderFindFirst: vi.fn(),
  paymentTransactionFindFirst: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  txOrderFindFirst: vi.fn(),
  paymentTransactionFindUnique: vi.fn(),
  paymentTransactionUpsert: vi.fn(),
  orderUpdate: vi.fn(),
  invoiceUpsert: vi.fn(),
  paymentCreate: vi.fn(),
  emitOrderEvent: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  basePrisma: {
    paymentWebhookEvent: {
      create: mocks.webhookCreate,
      update: mocks.webhookUpdate,
    },
    order: {
      findFirst: mocks.orderFindFirst,
    },
    paymentTransaction: {
      findFirst: mocks.paymentTransactionFindFirst,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock('../services/PaymentGatewayService.js', () => ({
  PaymentGatewayService: {
    normalizeWebhook: mocks.normalizeWebhook,
  },
}));

vi.mock('../services/orderEvents.service.js', () => ({
  emitOrderEvent: mocks.emitOrderEvent,
}));

const { WebhookController } = await import('./webhook.controller.js');

function mockResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as any;
}

describe('WebhookController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.normalizeWebhook.mockResolvedValue({
      provider: 'MERCADOPAGO',
      eventId: 'evt-new',
      externalId: 'payment-1',
      orderId: 'order-1',
      status: 'APPROVED',
      rawStatus: 'approved',
      amount: 50,
      transactionType: 'DEPOSIT_PAYMENT',
      paymentMode: 'DEPOSIT',
      payload: { id: 'evt-new' },
    });
    mocks.webhookCreate.mockResolvedValue({ id: 'webhook-1' });
    mocks.paymentTransactionFindFirst.mockResolvedValue({ tenantId: 'tenant-1', orderId: 'order-1' });
    mocks.orderFindFirst.mockResolvedValue({
      id: 'order-1',
      tenantId: 'tenant-1',
      status: 'PREPARING',
      total: '100.00',
      amountPaid: '50.00',
      amountDue: '50.00',
      paymentMode: 'DEPOSIT',
      paymentMethod: 'PIX',
      paidAt: new Date('2026-07-09T12:00:00.000Z'),
      paymentTransactions: [],
      invoice: { id: 'invoice-1', payments: [{ amount: '50.00', status: 'COMPLETED' }] },
    });
    mocks.txOrderFindFirst.mockResolvedValue({
      id: 'order-1',
      tenantId: 'tenant-1',
      status: 'PREPARING',
      total: '100.00',
      amountPaid: '50.00',
      amountDue: '50.00',
      paymentMode: 'DEPOSIT',
      paymentMethod: 'PIX',
      paidAt: new Date('2026-07-09T12:00:00.000Z'),
      invoice: { id: 'invoice-1', payments: [{ amount: '50.00', status: 'COMPLETED' }] },
    });
    mocks.paymentTransactionFindUnique.mockResolvedValue({
      id: 'tx-1',
      tenantId: 'tenant-1',
      orderId: 'order-1',
      provider: 'MERCADOPAGO',
      externalId: 'payment-1',
      type: 'DEPOSIT_PAYMENT',
      amount: '50.00',
      status: 'PAID',
      paidAt: new Date('2026-07-09T12:00:00.000Z'),
    });
    mocks.invoiceUpsert.mockResolvedValue({
      id: 'invoice-1',
      payments: [{ amount: '50.00', status: 'COMPLETED' }],
    });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        $queryRaw: mocks.queryRaw,
        paymentWebhookEvent: { update: mocks.webhookUpdate },
        order: { findFirst: mocks.txOrderFindFirst, update: mocks.orderUpdate },
        paymentTransaction: {
          findUnique: mocks.paymentTransactionFindUnique,
          upsert: mocks.paymentTransactionUpsert,
        },
        invoice: { upsert: mocks.invoiceUpsert },
        payment: { create: mocks.paymentCreate },
      }),
    );
  });

  it('does not create another financial payment when a different webhook event repeats the same approved transaction', async () => {
    const res = mockResponse();

    await WebhookController.handlePaymentWebhook({ query: {}, headers: {}, body: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mocks.orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1', tenantId: 'tenant-1' },
      }),
    );
    expect(mocks.paymentTransactionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_provider_externalId: {
            tenantId: 'tenant-1',
            provider: 'MERCADOPAGO',
            externalId: 'payment-1',
          },
        },
      }),
    );
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
    expect(mocks.orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountPaid: '50.00',
          amountDue: '50.00',
          paymentStatus: 'PARTIALLY_PAID',
        }),
      }),
    );
  });

  it('does not trust payload orderId when resolving a payment webhook', async () => {
    mocks.normalizeWebhook.mockResolvedValueOnce({
      provider: 'MERCADOPAGO',
      eventId: 'evt-malicious-order-id',
      externalId: 'payment-1',
      orderId: 'order-from-other-tenant',
      status: 'APPROVED',
      rawStatus: 'approved',
      amount: 50,
      transactionType: 'DEPOSIT_PAYMENT',
      paymentMode: 'DEPOSIT',
      payload: { external_reference: 'order-from-other-tenant' },
    });
    const res = mockResponse();

    await WebhookController.handlePaymentWebhook({ query: {}, headers: {}, body: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mocks.paymentTransactionFindFirst).toHaveBeenCalledWith({
      where: { provider: 'MERCADOPAGO', externalId: 'payment-1' },
      select: { tenantId: true, orderId: true },
    });
    expect(mocks.orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1', tenantId: 'tenant-1' },
      }),
    );
    expect(mocks.orderFindFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-from-other-tenant' } }),
    );
  });
});
