import type { Response } from 'express';

type OrderEventClient = {
  id: string;
  tenantId: string;
  res: Response;
  heartbeat: NodeJS.Timeout;
};

type OrderEventPayload = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

const clientsByTenant = new Map<string, Map<string, OrderEventClient>>();

function writeEvent(res: Response, event: string, data: OrderEventPayload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function addOrderEventClient(tenantId: string, res: Response) {
  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write('retry: 5000\n\n');

  const heartbeat = setInterval(() => {
    writeEvent(res, 'heartbeat', { at: new Date().toISOString() });
  }, 25000);

  const client: OrderEventClient = { id: clientId, tenantId, res, heartbeat };
  const tenantClients = clientsByTenant.get(tenantId) ?? new Map<string, OrderEventClient>();
  tenantClients.set(clientId, client);
  clientsByTenant.set(tenantId, tenantClients);

  writeEvent(res, 'connected', { tenantId, clientId });

  return () => {
    clearInterval(heartbeat);
    const currentTenantClients = clientsByTenant.get(tenantId);
    currentTenantClients?.delete(clientId);
    if (currentTenantClients?.size === 0) {
      clientsByTenant.delete(tenantId);
    }
  };
}

export function emitOrderEvent(tenantId: string, event: string, data: OrderEventPayload) {
  const tenantClients = clientsByTenant.get(tenantId);
  if (!tenantClients || tenantClients.size === 0) return 0;

  let delivered = 0;
  for (const client of tenantClients.values()) {
    try {
      writeEvent(client.res, event, data);
      delivered += 1;
    } catch {
      clearInterval(client.heartbeat);
      tenantClients.delete(client.id);
    }
  }

  if (tenantClients.size === 0) {
    clientsByTenant.delete(tenantId);
  }

  return delivered;
}

export function getOrderEventClientCount(tenantId: string) {
  return clientsByTenant.get(tenantId)?.size ?? 0;
}
