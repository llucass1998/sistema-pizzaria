import { afterEach, describe, expect, it } from 'vitest';

import { PaymentGatewayService } from './PaymentGatewayService.js';

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
}

describe('PaymentGatewayService', () => {
  afterEach(() => {
    resetEnv();
  });

  it('blocks mock checkout links in production unless explicitly allowed', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PAYMENT_GATEWAY = 'MOCK';
    delete process.env.PAYMENT_ALLOW_MOCK;

    await expect(
      PaymentGatewayService.createPaymentLink('order-1', 25, 'tenant-1', 'Cliente'),
    ).rejects.toThrow('Gateway MOCK bloqueado em producao');
  });

  it('normalizes a local mock webhook outside production', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PAYMENT_GATEWAY = 'MOCK';

    const event = await PaymentGatewayService.normalizeWebhook({
      query: {},
      headers: {},
      body: {
        eventId: 'evt-1',
        externalId: 'mock-1',
        orderId: 'order-1',
        status: 'APPROVED',
        amount: 42.5,
      },
    } as any);

    expect(event).toMatchObject({
      provider: 'MOCK',
      eventId: 'evt-1',
      externalId: 'mock-1',
      orderId: 'order-1',
      status: 'APPROVED',
      amount: 42.5,
    });
  });

  it('requires Mercado Pago webhook secret in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PAYMENT_GATEWAY = 'MERCADOPAGO';
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'token';
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;

    await expect(
      PaymentGatewayService.normalizeWebhook({
        query: { provider: 'MERCADOPAGO', 'data.id': '123' },
        headers: {},
        body: { data: { id: '123' } },
      } as any),
    ).rejects.toThrow('MERCADOPAGO_WEBHOOK_SECRET ausente em producao');
  });
});
