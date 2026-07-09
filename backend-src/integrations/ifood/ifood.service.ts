import {
  IntegrationEventStatus,
  IntegrationProvider,
  type IntegrationCredential,
} from '../../../generated/prisma/index.js';
import { tenantContext } from '../../core/context/TenantContext.js';
import { getTenantId } from '../../core/context/TenantContext.js';
import { basePrisma, prisma } from '../../lib/prisma.js';
import { logger } from '../../utils/logger.js';
import { ExternalOrderIngestionService } from '../core/external-order-ingestion.service.js';
import { IfoodAdapter } from './ifood.adapter.js';
import { IfoodClient, type IfoodPollingEvent } from './ifood.client.js';

const IFOOD_POLL_INTERVAL_MS = 30_000;
const IFOOD_POLL_FAILURE_BACKOFF_BASE_MS = 60_000;
const IFOOD_POLL_FAILURE_BACKOFF_MAX_MS = 30 * 60_000;
const IFOOD_CLIENT_ID_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PollFailureBackoff = {
  failures: number;
  nextRetryAt: number;
};

const pollFailureBackoff = new Map<string, PollFailureBackoff>();
const invalidClientIdWarnings = new Set<string>();

function eventId(event: IfoodPollingEvent) {
  return String(event.id || `${event.orderId}-${event.code}-${Date.now()}`);
}

function eventType(event: IfoodPollingEvent) {
  return String(event.fullCode || event.code || 'UNKNOWN');
}

function externalOrderId(event: IfoodPollingEvent) {
  const order =
    event.order && typeof event.order === 'object' ? (event.order as { id?: unknown }) : null;
  return String(event.orderId || event.resourceId || order?.id || '');
}

function eventMerchantId(event: IfoodPollingEvent) {
  const merchant =
    event.merchant && typeof event.merchant === 'object'
      ? (event.merchant as { id?: unknown })
      : null;
  return String(event.merchantId || merchant?.id || '');
}

function withOperationalMetadata(event: IfoodPollingEvent, source: string): IfoodPollingEvent {
  return {
    ...event,
    __operationalSource: source,
    __receivedAt: new Date().toISOString(),
  };
}

const SENSITIVE_PAYLOAD_KEYS = [
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'token',
  'clientSecret',
  'client_secret',
  'secret',
  'authorization',
  'password',
  'certificatePassword',
];

export function sanitizeIfoodPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeIfoodPayload(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const normalizedKey = key.toLowerCase();
      const isSensitive = SENSITIVE_PAYLOAD_KEYS.some((sensitiveKey) =>
        normalizedKey.includes(sensitiveKey.toLowerCase()),
      );
      return [key, isSensitive ? '[REDACTED]' : sanitizeIfoodPayload(item)];
    }),
  );
}

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return SENSITIVE_PAYLOAD_KEYS.reduce(
    (current, key) => current.replace(new RegExp(key, 'gi'), '[REDACTED]'),
    message,
  ).slice(0, 600);
}

function minutesSince(date?: Date | null) {
  if (!date) return null;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function last24Hours() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

function isOrderEvent(event: IfoodPollingEvent) {
  const type = eventType(event).toUpperCase();
  return (
    Boolean(externalOrderId(event)) &&
    (type.includes('ORDER') ||
      type.includes('PLACED') ||
      type.includes('CONFIRMED') ||
      type.includes('CANCEL'))
  );
}

function hasValidIfoodClientId(credential: Pick<IntegrationCredential, 'clientId'>) {
  return IFOOD_CLIENT_ID_UUID_PATTERN.test(String(credential.clientId ?? '').trim());
}

function canPollCredential(credentialId: string) {
  const backoff = pollFailureBackoff.get(credentialId);
  return !backoff || backoff.nextRetryAt <= Date.now();
}

function recordPollSuccess(credentialId: string) {
  pollFailureBackoff.delete(credentialId);
}

function recordPollFailure(credentialId: string) {
  const current = pollFailureBackoff.get(credentialId);
  const failures = (current?.failures ?? 0) + 1;
  const delay = Math.min(
    IFOOD_POLL_FAILURE_BACKOFF_BASE_MS * 2 ** (failures - 1),
    IFOOD_POLL_FAILURE_BACKOFF_MAX_MS,
  );
  pollFailureBackoff.set(credentialId, {
    failures,
    nextRetryAt: Date.now() + delay,
  });
  return delay;
}

export class IfoodService {
  private static intervalId: NodeJS.Timeout | null = null;
  private static isRunning = false;

  static startPollingWorker() {
    if (IfoodService.intervalId) {
      return;
    }

    const enabled = process.env.ENABLE_IFOOD_WORKER !== 'false';
    if (!enabled) {
      logger.info('[iFood] Worker desabilitado por ENABLE_IFOOD_WORKER=false.');
      return;
    }

    logger.info('[iFood] Worker de polling iniciado.');
    IfoodService.intervalId = setInterval(
      () => {
        IfoodService.pollAllTenants().catch((error) => {
          logger.error('[iFood] Erro no worker de polling:', error);
        });
      },
      Number(process.env.IFOOD_POLL_INTERVAL_MS ?? IFOOD_POLL_INTERVAL_MS),
    );

    IfoodService.pollAllTenants().catch((error) => {
      logger.error('[iFood] Erro no primeiro polling:', error);
    });
  }

  static stopPollingWorker() {
    if (IfoodService.intervalId) {
      clearInterval(IfoodService.intervalId);
      IfoodService.intervalId = null;
    }
  }

  static async pollAllTenants() {
    if (IfoodService.isRunning) {
      return;
    }

    IfoodService.isRunning = true;

    try {
      const credentials = await basePrisma.integrationCredential.findMany({
        where: {
          provider: IntegrationProvider.IFOOD,
          isActive: true,
        },
      });

      for (const credential of credentials) {
        if (!hasValidIfoodClientId(credential)) {
          if (!invalidClientIdWarnings.has(credential.id)) {
            logger.warn(
              `[iFood] Credencial ${credential.id} ignorada no polling: clientId deve ser UUID valido.`,
            );
            invalidClientIdWarnings.add(credential.id);
          }
          continue;
        }

        if (!canPollCredential(credential.id)) {
          continue;
        }

        try {
          await tenantContext.run({ tenantId: credential.tenantId }, async () => {
            await IfoodService.pollCredential(credential as IntegrationCredential);
          });
          recordPollSuccess(credential.id);
        } catch (error) {
          const delay = recordPollFailure(credential.id);
          logger.error(
            `[iFood] Polling falhou para credentialId=${credential.id}; nova tentativa em ${Math.round(delay / 1000)}s.`,
            error,
          );
        }
      }
    } finally {
      IfoodService.isRunning = false;
    }
  }

  static async pollCredential(credential: IntegrationCredential) {
    if (!hasValidIfoodClientId(credential)) {
      const error = Object.assign(
        new Error('Credencial iFood invalida: clientId deve ser UUID valido.'),
        { statusCode: 400 },
      );
      throw error;
    }

    const events = await IfoodClient.pollEvents(credential);

    if (events.length === 0) {
      await prisma.integrationCredential.update({
        where: { id: credential.id },
        data: { lastSyncAt: new Date() },
      });
      return;
    }

    const eventsToAck: IfoodPollingEvent[] = [];

    for (const event of events) {
      try {
        await IfoodService.processEvent(credential, event, 'POLLING');
        eventsToAck.push(event);
      } catch (error) {
        logger.error('[iFood] Erro inesperado ao processar evento na fila de ack', error);
      }
    }

    await IfoodClient.acknowledgeEvents(credential, eventsToAck);

    await Promise.all(
      eventsToAck.map((event) =>
        prisma.integrationEventLog
          .update({
            where: {
              tenantId_provider_eventId: {
                tenantId: credential.tenantId,
                provider: IntegrationProvider.IFOOD,
                eventId: eventId(event),
              },
            },
            data: {
              status: IntegrationEventStatus.ACKNOWLEDGED,
              acknowledgedAt: new Date(),
            },
          })
          .catch(() => undefined),
      ),
    );

    await prisma.integrationCredential.update({
      where: { id: credential.id },
      data: { lastSyncAt: new Date() },
    });
  }

  static async processEvent(
    credential: IntegrationCredential,
    event: IfoodPollingEvent,
    source = 'POLLING',
  ) {
    const id = eventId(event);
    const orderId = externalOrderId(event);
    const payload = withOperationalMetadata(event, source);

    const existingLog = await prisma.integrationEventLog.findUnique({
      where: {
        tenantId_provider_eventId: {
          tenantId: credential.tenantId,
          provider: IntegrationProvider.IFOOD,
          eventId: id,
        },
      },
    });

    if (existingLog && existingLog.status === IntegrationEventStatus.PROCESSED) {
      logger.info(`[iFood] Evento ${id} ja foi processado anteriormente.`);
      return;
    }

    try {
      await prisma.integrationEventLog.upsert({
        where: {
          tenantId_provider_eventId: {
            tenantId: credential.tenantId,
            provider: IntegrationProvider.IFOOD,
            eventId: id,
          },
        },
        update: {
          payload: payload as any,
          eventType: eventType(event),
          externalOrderId: orderId || null,
          status: IntegrationEventStatus.RECEIVED,
          error: null,
        },
        create: {
          tenantId: credential.tenantId,
          provider: IntegrationProvider.IFOOD,
          eventId: id,
          eventType: eventType(event),
          externalOrderId: orderId || null,
          payload: payload as any,
        } as any,
      });

      if (isOrderEvent(event)) {
        const detail = await IfoodClient.getOrderDetail(credential, orderId);
        const normalized = IfoodAdapter.normalizeOrder({
          ...detail,
          id: detail?.id ?? orderId,
          merchantId: detail?.merchantId ?? event.merchantId ?? credential.merchantId,
          code: detail?.code ?? event.code,
          fullCode: detail?.fullCode ?? event.fullCode,
        });

        await ExternalOrderIngestionService.upsertExternalOrder(normalized);
      }

      await prisma.integrationEventLog.update({
        where: {
          tenantId_provider_eventId: {
            tenantId: credential.tenantId,
            provider: IntegrationProvider.IFOOD,
            eventId: id,
          },
        },
        data: {
          status: IntegrationEventStatus.PROCESSED,
          processedAt: new Date(),
        },
      });
    } catch (error) {
      await prisma.integrationEventLog
        .update({
          where: {
            tenantId_provider_eventId: {
              tenantId: credential.tenantId,
              provider: IntegrationProvider.IFOOD,
              eventId: id,
            },
          },
          data: {
            status: IntegrationEventStatus.FAILED,
            error: sanitizeError(error),
          },
        })
        .catch(() => undefined);
      logger.error('[iFood] Falha ao processar evento:', id, error);
      throw error;
    }
  }

  static async getHealth() {
    const tenantId = getTenantId();
    const now = new Date();
    const today = startOfToday();
    const since24h = last24Hours();

    const [
      credentials,
      latestEvents,
      lastAck,
      eventsReceivedToday,
      failedEvents24h,
      ordersImportedToday,
    ] = await Promise.all([
      prisma.integrationCredential.findMany({
        where: { provider: IntegrationProvider.IFOOD },
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      }),
      prisma.integrationEventLog.findMany({
        where: { tenantId, provider: IntegrationProvider.IFOOD },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.integrationEventLog.findFirst({
        where: { tenantId, provider: IntegrationProvider.IFOOD, acknowledgedAt: { not: null } },
        orderBy: { acknowledgedAt: 'desc' },
      }),
      prisma.integrationEventLog.count({
        where: { tenantId, provider: IntegrationProvider.IFOOD, createdAt: { gte: today } },
      }),
      prisma.integrationEventLog.count({
        where: {
          tenantId,
          provider: IntegrationProvider.IFOOD,
          createdAt: { gte: since24h },
          OR: [{ status: IntegrationEventStatus.FAILED }, { error: { not: null } }],
        },
      }),
      prisma.order.count({
        where: {
          tenantId,
          origin: IntegrationProvider.IFOOD as any,
          createdAt: { gte: today },
        },
      }),
    ]);

    const activeCredential = credentials.find((credential) => credential.isActive);
    const lastPolling = latestEvents.find(
      (event) => (event.payload as any)?.__operationalSource === 'POLLING',
    );
    const lastWebhook = latestEvents.find(
      (event) => (event.payload as any)?.__operationalSource === 'WEBHOOK',
    );

    const tokenStatus = !activeCredential
      ? 'PENDING'
      : !activeCredential.accessToken
        ? 'PENDING'
        : activeCredential.expiresAt && activeCredential.expiresAt <= now
          ? 'EXPIRED'
          : 'VALID';

    const lastSignalAt =
      [lastPolling?.createdAt, lastWebhook?.createdAt, activeCredential?.lastSyncAt]
        .filter(Boolean)
        .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] ?? null;
    const minutesSinceSignal = minutesSince(lastSignalAt as Date | null);
    const storePresence =
      !activeCredential || !lastSignalAt
        ? 'UNKNOWN'
        : minutesSinceSignal !== null && minutesSinceSignal <= 2
          ? 'ONLINE'
          : 'OFFLINE';

    const warnings: string[] = [];
    const blockingIssues: string[] = [];

    if (!activeCredential) blockingIssues.push('Nenhuma credencial iFood ativa configurada.');
    if (tokenStatus === 'PENDING') warnings.push('Token ainda nao foi gerado/testado.');
    if (tokenStatus === 'EXPIRED') blockingIssues.push('Token iFood expirado.');
    if (storePresence === 'OFFLINE') warnings.push('Sem sinal recente de polling/webhook.');
    if (failedEvents24h > 0)
      warnings.push(`${failedEvents24h} evento(s) com falha nas ultimas 24h.`);

    const status = !activeCredential
      ? 'DISCONNECTED'
      : blockingIssues.length > 0
        ? 'CRITICAL'
        : warnings.length > 0
          ? 'WARNING'
          : 'HEALTHY';

    return {
      status,
      merchantId: activeCredential?.merchantId ?? null,
      tokenStatus,
      storePresence,
      lastPollingAt: lastPolling?.createdAt ?? activeCredential?.lastSyncAt ?? null,
      lastWebhookAt: lastWebhook?.createdAt ?? null,
      lastAckAt: lastAck?.acknowledgedAt ?? null,
      lastCatalogSyncAt: activeCredential?.lastSyncAt ?? null,
      ordersImportedToday,
      eventsReceivedToday,
      failedEvents24h,
      errors24h: failedEvents24h,
      minutesSinceLastEvent: minutesSince(latestEvents[0]?.createdAt),
      minutesSinceLastPolling: minutesSince(lastPolling?.createdAt ?? activeCredential?.lastSyncAt),
      minutesSinceLastWebhook: minutesSince(lastWebhook?.createdAt),
      warnings,
      blockingIssues,
    };
  }

  static async listEvents(params: {
    status?: string;
    type?: string;
    q?: string;
    failedOnly?: boolean;
    pendingOnly?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const tenantId = getTenantId();
    const page = Math.max(1, Number(params.page ?? 1));
    const pageSize = Math.min(100, Math.max(10, Number(params.pageSize ?? 20)));
    const where: any = { tenantId, provider: IntegrationProvider.IFOOD };

    const validStatuses = Object.values(IntegrationEventStatus) as string[];
    if (params.status && validStatuses.includes(params.status)) where.status = params.status;
    if (params.type) where.eventType = { contains: params.type, mode: 'insensitive' };
    if (params.failedOnly) where.status = IntegrationEventStatus.FAILED;
    if (params.pendingOnly) where.status = { in: [IntegrationEventStatus.RECEIVED] };
    if (params.q) {
      where.OR = [
        { eventId: { contains: params.q, mode: 'insensitive' } },
        { externalOrderId: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    const [total, events] = await Promise.all([
      prisma.integrationEventLog.count({ where }),
      prisma.integrationEventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const externalIds = events
      .map((event) => event.externalOrderId)
      .filter((value): value is string => Boolean(value));
    const orders = externalIds.length
      ? await prisma.order.findMany({
          where: { tenantId, origin: 'IFOOD' as any, externalId: { in: externalIds } },
          select: {
            id: true,
            externalId: true,
            status: true,
            total: true,
            customer: { select: { name: true } },
          },
        })
      : [];
    const orderByExternalId = new Map(orders.map((order) => [order.externalId, order]));

    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      items: events.map((event) => {
        const order = event.externalOrderId ? orderByExternalId.get(event.externalOrderId) : null;
        return {
          id: event.id,
          eventId: event.eventId,
          eventType: event.eventType,
          externalOrderId: event.externalOrderId,
          merchantId: eventMerchantId(event.payload as IfoodPollingEvent) || null,
          source: (event.payload as any)?.__operationalSource ?? 'UNKNOWN',
          status: event.status,
          orderStatus: order?.status ?? null,
          customerName: order?.customer?.name ?? null,
          total: order?.total ?? null,
          attempts: event.processedAt || event.error ? 1 : 0,
          lastError: event.error ? sanitizeError(event.error) : null,
          createdAt: event.createdAt,
          processedAt: event.processedAt,
          acknowledgedAt: event.acknowledgedAt,
          payload: sanitizeIfoodPayload(event.payload),
        };
      }),
    };
  }

  static async reprocessEvent(
    eventIdParam: string,
    options: { force?: boolean; adminId?: string },
  ) {
    const tenantId = getTenantId();
    const event = await prisma.integrationEventLog.findFirst({
      where: { tenantId, provider: IntegrationProvider.IFOOD, eventId: eventIdParam },
    });

    if (!event) {
      const error = Object.assign(new Error('Evento iFood nao encontrado.'), { statusCode: 404 });
      throw error;
    }

    const processedStatuses: IntegrationEventStatus[] = [
      IntegrationEventStatus.PROCESSED,
      IntegrationEventStatus.ACKNOWLEDGED,
    ];

    if (!options.force && processedStatuses.includes(event.status)) {
      const error = Object.assign(
        new Error('Evento ja processado. Reprocessamento exige confirmacao explicita.'),
        { statusCode: 409 },
      );
      throw error;
    }

    const payload = event.payload as IfoodPollingEvent;
    const merchantId = eventMerchantId(payload);
    const credential = await prisma.integrationCredential.findFirst({
      where: {
        tenantId,
        provider: IntegrationProvider.IFOOD,
        isActive: true,
        ...(merchantId ? { merchantId } : {}),
      },
    });

    if (!credential) {
      const error = Object.assign(new Error('Credencial iFood ativa nao encontrada.'), {
        statusCode: 404,
      });
      throw error;
    }

    await IfoodService.processEvent(credential, payload, 'REPROCESS');

    return {
      ok: true,
      eventId: event.eventId,
      reprocessedBy: options.adminId ?? null,
    };
  }

  static async syncOrderStatus(orderId: string, status: string) {
    const tenantId = tenantContext.getStore()?.tenantId;

    if (!tenantId) {
      logger.warn('[iFood] syncOrderStatus chamado fora do contexto de tenant');
      return;
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: {
        id: true,
        origin: true,
        externalId: true,
        externalMerchantId: true,
      },
    });

    if (!order || order.origin !== 'IFOOD' || !order.externalId) {
      return;
    }

    const credential = await prisma.integrationCredential.findFirst({
      where: {
        tenantId,
        provider: IntegrationProvider.IFOOD,
        isActive: true,
        ...(order.externalMerchantId ? { merchantId: order.externalMerchantId } : {}),
      },
    });

    if (!credential) {
      logger.warn('[iFood] Sem credencial ativa para sincronizar status do pedido:', order.id);
      return;
    }

    await IfoodClient.syncStatus(credential, order.externalId, status);
  }
}
