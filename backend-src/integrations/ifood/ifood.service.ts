import {
  IntegrationEventStatus,
  IntegrationProvider,
  type IntegrationCredential,
} from '../../../generated/prisma/index.js';
import { tenantContext } from '../../core/context/TenantContext.js';
import { basePrisma, prisma } from '../../lib/prisma.js';
import { logger } from '../../utils/logger.js';
import { ExternalOrderIngestionService } from '../core/external-order-ingestion.service.js';
import { IfoodAdapter } from './ifood.adapter.js';
import { IfoodClient, type IfoodPollingEvent } from './ifood.client.js';

const IFOOD_POLL_INTERVAL_MS = 30_000;

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
        await tenantContext.run({ tenantId: credential.tenantId }, async () => {
          await IfoodService.pollCredential(credential as IntegrationCredential);
        });
      }
    } finally {
      IfoodService.isRunning = false;
    }
  }

  static async pollCredential(credential: IntegrationCredential) {
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
        await IfoodService.processEvent(credential, event);
        eventsToAck.push(event);
      } catch (error) {
        logger.error('[iFood] Erro inesperado ao processar evento na fila de ack', error);
        eventsToAck.push(event);
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

  static async processEvent(credential: IntegrationCredential, event: IfoodPollingEvent) {
    const id = eventId(event);
    const orderId = externalOrderId(event);

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
          payload: event as any,
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
          payload: event as any,
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
            error: error instanceof Error ? error.message : String(error),
          },
        })
        .catch(() => undefined);
      logger.error('[iFood] Falha ao processar evento:', id, error);
      throw error;
    }
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
