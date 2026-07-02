import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

import { logger } from '../utils/logger.js';

export type PaymentProvider = 'MOCK' | 'MERCADOPAGO';

export interface PaymentIntent {
  provider: PaymentProvider;
  externalId: string;
  paymentUrl: string;
  rawStatus?: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedPaymentWebhook {
  provider: PaymentProvider;
  eventId: string;
  externalId: string;
  orderId?: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'CANCELED' | 'REFUNDED' | 'CHARGED_BACK';
  rawStatus: string;
  amount?: number;
  payload: Record<string, unknown>;
}

type MercadoPagoPreferenceResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
  status?: string;
};

type MercadoPagoPaymentResponse = {
  id?: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  metadata?: Record<string, unknown>;
};

function getConfiguredProvider(): PaymentProvider {
  const provider = String(process.env.PAYMENT_GATEWAY ?? 'MOCK').trim().toUpperCase();
  if (provider === 'MERCADOPAGO') return 'MERCADOPAGO';
  return 'MOCK';
}

function getPublicUrl() {
  return String(process.env.PUBLIC_URL ?? process.env.APP_PUBLIC_URL ?? 'http://localhost:5173')
    .trim()
    .replace(/\/+$/, '');
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return value;
}

function safeJson(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseMercadoPagoSignature(header: string) {
  return Object.fromEntries(
    header
      .split(',')
      .map((part) => part.trim().split('='))
      .filter(([key, value]) => key && value),
  );
}

function safeCompareHex(a: string, b: string) {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

function getQueryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function mapMercadoPagoStatus(status: string): NormalizedPaymentWebhook['status'] {
  const normalized = status.toLowerCase();
  if (normalized === 'approved' || normalized === 'accredited') return 'APPROVED';
  if (['pending', 'in_process', 'authorized', 'in_mediation'].includes(normalized)) {
    return 'PENDING';
  }
  if (['cancelled', 'canceled', 'expired'].includes(normalized)) return 'CANCELED';
  if (normalized === 'refunded' || normalized === 'partially_refunded') return 'REFUNDED';
  if (normalized === 'charged_back') return 'CHARGED_BACK';
  return 'REJECTED';
}

function mapMockStatus(status: unknown): NormalizedPaymentWebhook['status'] {
  const normalized = String(status ?? 'APPROVED').toUpperCase();
  if (['PAID', 'APPROVED', 'COMPLETED'].includes(normalized)) return 'APPROVED';
  if (['PENDING', 'IN_PROCESS'].includes(normalized)) return 'PENDING';
  if (['CANCELED', 'CANCELLED', 'EXPIRED'].includes(normalized)) return 'CANCELED';
  if (normalized === 'REFUNDED') return 'REFUNDED';
  if (normalized === 'CHARGED_BACK' || normalized === 'CHARGEBACK') return 'CHARGED_BACK';
  return 'REJECTED';
}

export class PaymentGatewayService {
  static getProvider() {
    return getConfiguredProvider();
  }

  static async createPaymentLink(
    orderId: string,
    amount: number,
    tenantId: string,
    customerName: string,
    customerEmail?: string,
  ): Promise<PaymentIntent> {
    const provider = getConfiguredProvider();

    if (provider === 'MERCADOPAGO') {
      return this.createMercadoPagoPreference(orderId, amount, tenantId, customerName, customerEmail);
    }

    return this.createMockPaymentLink(orderId, amount, tenantId);
  }

  static async normalizeWebhook(req: Request): Promise<NormalizedPaymentWebhook> {
    const body = safeJson(req.body);
    const provider = String(req.query.provider ?? body.provider ?? getConfiguredProvider()).toUpperCase();

    if (provider === 'MERCADOPAGO') {
      return this.normalizeMercadoPagoWebhook(req, body);
    }

    return this.normalizeMockWebhook(body);
  }

  private static createMockPaymentLink(
    orderId: string,
    amount: number,
    tenantId: string,
  ): PaymentIntent {
    if (process.env.NODE_ENV === 'production' && process.env.PAYMENT_ALLOW_MOCK !== 'true') {
      throw new Error('Gateway MOCK bloqueado em producao. Configure PAYMENT_GATEWAY=MERCADOPAGO.');
    }

    const externalId = `mock_${randomUUID().replace(/-/g, '')}`;
    const paymentUrl = `${getPublicUrl()}/mock-payment?orderId=${encodeURIComponent(
      orderId,
    )}&externalId=${encodeURIComponent(externalId)}&amount=${encodeURIComponent(amount)}`;

    return {
      provider: 'MOCK',
      externalId,
      paymentUrl,
      rawStatus: 'PENDING',
      metadata: { tenantId, mode: 'demo' },
    };
  }

  private static async createMercadoPagoPreference(
    orderId: string,
    amount: number,
    tenantId: string,
    customerName: string,
    customerEmail?: string,
  ): Promise<PaymentIntent> {
    const accessToken = requireEnv('MERCADOPAGO_ACCESS_TOKEN');
    const publicUrl = getPublicUrl();
    const notificationUrl =
      process.env.MERCADOPAGO_WEBHOOK_URL?.trim() ||
      `${publicUrl}/api/webhooks/payments/callback?provider=MERCADOPAGO`;

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        external_reference: orderId,
        notification_url: notificationUrl,
        items: [
          {
            id: orderId,
            title: `Pedido ${orderId.slice(0, 8)}`,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: Number(amount.toFixed(2)),
          },
        ],
        payer: {
          name: customerName,
          email: customerEmail,
        },
        metadata: {
          order_id: orderId,
          tenant_id: tenantId,
        },
        back_urls: {
          success: `${publicUrl}/#/order/${orderId}`,
          pending: `${publicUrl}/#/order/${orderId}`,
          failure: `${publicUrl}/#/checkout`,
        },
      }),
    });

    const data = (await response.json().catch(() => ({}))) as MercadoPagoPreferenceResponse;
    if (!response.ok || !data.id) {
      logger.error('[Payment] Mercado Pago preference failed', {
        status: response.status,
        message: JSON.stringify(data).slice(0, 500),
      });
      throw new Error('Nao foi possivel criar pagamento no Mercado Pago.');
    }

    const useProductionUrl = process.env.MERCADOPAGO_ENVIRONMENT === 'production';
    const paymentUrl = useProductionUrl ? data.init_point : data.sandbox_init_point || data.init_point;
    if (!paymentUrl) {
      throw new Error('Mercado Pago nao retornou URL de checkout.');
    }

    return {
      provider: 'MERCADOPAGO',
      externalId: data.id,
      paymentUrl,
      rawStatus: data.status ?? 'PENDING',
      metadata: { tenantId, orderId },
    };
  }

  private static normalizeMockWebhook(body: Record<string, unknown>): NormalizedPaymentWebhook {
    if (process.env.NODE_ENV === 'production' && process.env.PAYMENT_ALLOW_MOCK_WEBHOOKS !== 'true') {
      throw new Error('Webhook MOCK bloqueado em producao.');
    }

    const bodyData = safeJson(body.data);
    const externalId = String(body.externalId ?? body.id ?? bodyData.id ?? '').trim();
    if (!externalId) {
      throw new Error('Payload de pagamento sem externalId.');
    }

    const orderId = String(body.orderId ?? body.external_reference ?? '').trim() || undefined;
    const rawStatus = String(body.status ?? 'APPROVED');

    return {
      provider: 'MOCK',
      eventId: String(body.eventId ?? `${externalId}:${rawStatus}`),
      externalId,
      orderId,
      status: mapMockStatus(rawStatus),
      rawStatus,
      amount: Number(body.amount ?? 0) || undefined,
      payload: body,
    };
  }

  private static async normalizeMercadoPagoWebhook(
    req: Request,
    body: Record<string, unknown>,
  ): Promise<NormalizedPaymentWebhook> {
    const paymentId =
      String(getQueryValue(req.query['data.id']) ?? safeJson(body.data).id ?? body.id ?? '').trim();
    if (!paymentId) {
      throw new Error('Webhook Mercado Pago sem data.id.');
    }

    this.verifyMercadoPagoSignature(req, paymentId);

    const payment = await this.fetchMercadoPagoPayment(paymentId);
    const externalId = String(payment.id ?? paymentId);
    const rawStatus = String(payment.status ?? body.status ?? 'pending');
    const metadata = safeJson(payment.metadata);
    const orderId =
      String(payment.external_reference ?? metadata.order_id ?? metadata.orderId ?? '').trim() ||
      undefined;
    const eventId = String(body.id ?? req.headers['x-request-id'] ?? `${externalId}:${rawStatus}`);

    return {
      provider: 'MERCADOPAGO',
      eventId,
      externalId,
      orderId,
      status: mapMercadoPagoStatus(rawStatus),
      rawStatus,
      amount: Number(payment.transaction_amount ?? 0) || undefined,
      payload: {
        notification: body,
        payment: {
          id: payment.id,
          status: payment.status,
          status_detail: payment.status_detail,
          external_reference: payment.external_reference,
          transaction_amount: payment.transaction_amount,
          metadata: payment.metadata,
        },
      },
    };
  }

  private static verifyMercadoPagoSignature(req: Request, paymentId: string) {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('MERCADOPAGO_WEBHOOK_SECRET ausente em producao.');
      }
      logger.warn('[Payment] Mercado Pago webhook sem secret; permitido apenas fora de producao.');
      return;
    }

    const signatureHeader = String(req.headers['x-signature'] ?? '');
    const requestId = String(req.headers['x-request-id'] ?? '');
    const parts = parseMercadoPagoSignature(signatureHeader);
    const ts = parts.ts;
    const v1 = parts.v1;

    if (!requestId || !ts || !v1) {
      throw new Error('Assinatura Mercado Pago incompleta.');
    }

    const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');
    if (!safeCompareHex(expected, v1)) {
      throw new Error('Assinatura Mercado Pago invalida.');
    }
  }

  private static async fetchMercadoPagoPayment(paymentId: string) {
    const accessToken = requireEnv('MERCADOPAGO_ACCESS_TOKEN');
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await response.json().catch(() => ({}))) as MercadoPagoPaymentResponse;
    if (!response.ok || !data.id) {
      logger.error('[Payment] Mercado Pago payment lookup failed', {
        status: response.status,
        paymentId,
      });
      throw new Error('Nao foi possivel consultar pagamento no Mercado Pago.');
    }
    return data;
  }
}
