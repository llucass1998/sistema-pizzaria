import {
  IntegrationProvider,
  type IntegrationCredential,
} from '../../../generated/prisma/index.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../utils/logger.js';

const TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000;

function baseUrl() {
  return process.env.IFOOD_BASE_URL ?? 'https://merchant-api.ifood.com.br';
}

function authPath() {
  return process.env.IFOOD_AUTH_PATH ?? '/authentication/v1.0/oauth/token';
}

function pollingPath() {
  return process.env.IFOOD_EVENTS_POLLING_PATH ?? '/events/v1.0/events:polling';
}

function ackPath() {
  return process.env.IFOOD_EVENTS_ACK_PATH ?? '/events/v1.0/events/acknowledgment';
}

function orderDetailPath(orderId: string) {
  const template = process.env.IFOOD_ORDER_DETAIL_PATH ?? '/order/v1.0/orders/:orderId';
  return template.replace(':orderId', encodeURIComponent(orderId));
}

function statusPath(orderId: string, action: string) {
  const template =
    process.env[`IFOOD_STATUS_${action.toUpperCase()}_PATH`] ??
    `/order/v1.0/orders/:orderId/${action}`;
  return template.replace(':orderId', encodeURIComponent(orderId));
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function assertOk(response: Response, operation: string) {
  if (response.ok) {
    return parseJsonResponse(response);
  }

  const body = await parseJsonResponse(response);
  throw new Error(`${operation} falhou (${response.status}): ${JSON.stringify(body)}`);
}

export type IfoodPollingEvent = {
  id: string;
  code?: string;
  fullCode?: string;
  orderId?: string;
  merchantId?: string;
  [key: string]: unknown;
};

export class IfoodClient {
  static async getAccessToken(credential: IntegrationCredential) {
    const hasValidToken =
      credential.accessToken &&
      credential.expiresAt &&
      credential.expiresAt.getTime() > Date.now() + TOKEN_REFRESH_WINDOW_MS;

    if (hasValidToken) {
      return credential.accessToken!;
    }

    const body = new URLSearchParams();
    body.set('grantType', 'client_credentials');
    body.set('clientId', credential.clientId);
    body.set('clientSecret', credential.clientSecret);

    const response = await fetch(`${baseUrl()}${authPath()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await assertOk(response, 'Autenticacao iFood');

    const accessToken = data?.accessToken ?? data?.access_token;
    if (!accessToken) {
      throw new Error('Resposta OAuth do iFood nao retornou access_token.');
    }

    const expiresIn = Number(data?.expiresIn ?? data?.expires_in ?? 3600);
    const tokenType = data?.type ?? data?.tokenType ?? data?.token_type ?? 'Bearer';
    const expiresAt = new Date(Date.now() + Math.max(60, expiresIn - 60) * 1000);

    await prisma.integrationCredential.update({
      where: { id: credential.id },
      data: {
        accessToken,
        tokenType,
        refreshToken: data?.refreshToken ?? data?.refresh_token ?? credential.refreshToken,
        scopes: data?.scope ?? data?.scopes ?? credential.scopes,
        expiresAt,
      },
    });

    return accessToken;
  }

  static async pollEvents(credential: IntegrationCredential): Promise<IfoodPollingEvent[]> {
    const token = await IfoodClient.getAccessToken(credential);
    const method = (process.env.IFOOD_EVENTS_POLLING_METHOD ?? 'GET').toUpperCase();
    const response = await fetch(`${baseUrl()}${pollingPath()}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    const data = await assertOk(response, 'Polling de eventos iFood');

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.events)) {
      return data.events;
    }

    logger.warn('[iFood] Polling retornou payload sem lista de eventos.');
    return [];
  }

  static async acknowledgeEvents(credential: IntegrationCredential, events: IfoodPollingEvent[]) {
    if (events.length === 0) return;

    const token = await IfoodClient.getAccessToken(credential);
    const payload = events.map((event) => ({ id: event.id }));
    const response = await fetch(`${baseUrl()}${ackPath()}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    await assertOk(response, 'ACK de eventos iFood');
  }

  static async getOrderDetail(credential: IntegrationCredential, orderId: string) {
    const token = await IfoodClient.getAccessToken(credential);
    const response = await fetch(`${baseUrl()}${orderDetailPath(orderId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    return assertOk(response, 'Detalhe do pedido iFood');
  }

  static async syncStatus(
    credential: IntegrationCredential,
    externalOrderId: string,
    status: string,
  ) {
    const actionByStatus: Record<string, string> = {
      PREPARING: process.env.IFOOD_STATUS_PREPARING_ACTION ?? 'confirm',
      READY: process.env.IFOOD_STATUS_READY_ACTION ?? 'readyToPickup',
      OUT_FOR_DELIVERY: process.env.IFOOD_STATUS_OUT_FOR_DELIVERY_ACTION ?? 'dispatch',
      CANCELED: process.env.IFOOD_STATUS_CANCELED_ACTION ?? 'cancellationRequested',
    };
    const action = actionByStatus[status];

    if (!action) {
      return;
    }

    const token = await IfoodClient.getAccessToken(credential);
    const response = await fetch(`${baseUrl()}${statusPath(externalOrderId, action)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    await assertOk(response, `Sincronizacao de status iFood ${status}`);
  }

  static provider() {
    return IntegrationProvider.IFOOD;
  }
}
