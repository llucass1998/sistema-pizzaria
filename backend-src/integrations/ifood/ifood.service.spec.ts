import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationEventStatus, IntegrationProvider } from '../../../generated/prisma/index.js';

const mocks = vi.hoisted(() => ({
  pollEvents: vi.fn(),
  getOrderDetail: vi.fn(),
  acknowledgeEvents: vi.fn(),
  baseCredentialFindMany: vi.fn(),
  credentialFindMany: vi.fn(),
  credentialUpdate: vi.fn(),
  eventCount: vi.fn(),
  eventFindMany: vi.fn(),
  eventUpdate: vi.fn(),
  eventFindFirst: vi.fn(),
  orderCount: vi.fn(),
  orderFindMany: vi.fn(),
  credentialFindFirst: vi.fn(),
}));

vi.mock('../../core/context/TenantContext.js', () => ({
  getTenantId: () => 'tenant-ifood',
  tenantContext: {
    getStore: () => ({ tenantId: 'tenant-ifood' }),
    run: (_context: unknown, callback: () => unknown) => callback(),
  },
}));

vi.mock('../../lib/prisma.js', () => ({
  basePrisma: {
    integrationCredential: {
      findMany: mocks.baseCredentialFindMany,
    },
  },
  prisma: {
    integrationCredential: {
      findFirst: mocks.credentialFindFirst,
      findMany: mocks.credentialFindMany,
      update: mocks.credentialUpdate,
    },
    integrationEventLog: {
      findFirst: mocks.eventFindFirst,
      findMany: mocks.eventFindMany,
      count: mocks.eventCount,
      update: mocks.eventUpdate,
      upsert: vi.fn(),
    },
    order: {
      count: mocks.orderCount,
      findMany: mocks.orderFindMany,
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('./ifood.client.js', () => ({
  IfoodClient: {
    pollEvents: mocks.pollEvents,
    getOrderDetail: mocks.getOrderDetail,
    acknowledgeEvents: mocks.acknowledgeEvents,
  },
}));

const { IfoodService, sanitizeIfoodPayload } = await import('./ifood.service.js');

const credential = {
  id: 'cred-1',
  tenantId: 'tenant-ifood',
  provider: IntegrationProvider.IFOOD,
  merchantId: 'merchant-1',
  clientId: '550e8400-e29b-41d4-a716-446655440000',
  clientSecret: 'client-secret',
  accessToken: 'access-token',
  refreshToken: null,
  tokenType: 'Bearer',
  scopes: null,
  expiresAt: new Date(Date.now() + 60_000),
  isActive: true,
  metadata: null,
  lastSyncAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('IfoodService operational safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.credentialUpdate.mockResolvedValue(credential);
    mocks.eventUpdate.mockResolvedValue({});
  });

  it('sanitizes tokens and secrets before exposing payloads', () => {
    const sanitized = sanitizeIfoodPayload({
      accessToken: 'real-token',
      nested: { clientSecret: 'real-secret', ok: true },
    });

    expect(sanitized).toEqual({
      accessToken: '[REDACTED]',
      nested: { clientSecret: '[REDACTED]', ok: true },
    });
  });

  it('acknowledges only events processed successfully during polling', async () => {
    const first = { id: 'evt-ok', code: 'ORDER_PLACED', orderId: 'order-ok' };
    const second = { id: 'evt-fail', code: 'ORDER_PLACED', orderId: 'order-fail' };
    mocks.pollEvents.mockResolvedValue([first, second]);
    const processSpy = vi.spyOn(IfoodService, 'processEvent');
    processSpy
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Falha controlada'));

    await IfoodService.pollCredential(credential);

    expect(mocks.acknowledgeEvents).toHaveBeenCalledWith(credential, [first]);
  });

  it('continues polling other credentials when one credential fails', async () => {
    const failingCredential = { ...credential, id: 'cred-fail', tenantId: 'tenant-fail' };
    const workingCredential = { ...credential, id: 'cred-ok', tenantId: 'tenant-ok' };
    const pollSpy = vi.spyOn(IfoodService, 'pollCredential');
    pollSpy
      .mockRejectedValueOnce(new Error('Credencial invalida'))
      .mockResolvedValueOnce(undefined);
    mocks.baseCredentialFindMany.mockResolvedValue([failingCredential, workingCredential]);

    await IfoodService.pollAllTenants();

    expect(pollSpy).toHaveBeenCalledWith(failingCredential);
    expect(pollSpy).toHaveBeenCalledWith(workingCredential);
  });

  it('skips clearly invalid iFood clientId values in the background worker', async () => {
    const invalidCredential = { ...credential, id: 'cred-invalid', clientId: 'test-client-id-8899' };
    const workingCredential = { ...credential, id: 'cred-ok' };
    const pollSpy = vi.spyOn(IfoodService, 'pollCredential').mockResolvedValue(undefined);
    mocks.baseCredentialFindMany.mockResolvedValue([invalidCredential, workingCredential]);

    await IfoodService.pollAllTenants();

    expect(pollSpy).not.toHaveBeenCalledWith(invalidCredential);
    expect(pollSpy).toHaveBeenCalledWith(workingCredential);
  });

  it('blocks reprocessing of an already processed event without explicit force', async () => {
    mocks.eventFindFirst.mockResolvedValue({
      id: 'log-1',
      tenantId: 'tenant-ifood',
      provider: IntegrationProvider.IFOOD,
      eventId: 'evt-ok',
      payload: { id: 'evt-ok', merchantId: 'merchant-1' },
      status: IntegrationEventStatus.PROCESSED,
    });

    await expect(IfoodService.reprocessEvent('evt-ok', {})).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('filters health event metrics by current tenant', async () => {
    mocks.credentialFindMany.mockResolvedValue([credential]);
    mocks.eventFindMany.mockResolvedValue([]);
    mocks.eventFindFirst.mockResolvedValue(null);
    mocks.eventCount.mockResolvedValue(0);
    mocks.orderCount.mockResolvedValue(0);

    await IfoodService.getHealth();

    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-ifood',
          provider: IntegrationProvider.IFOOD,
        }),
      }),
    );
    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-ifood',
          provider: IntegrationProvider.IFOOD,
        }),
      }),
    );
    expect(mocks.eventCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-ifood',
          provider: IntegrationProvider.IFOOD,
        }),
      }),
    );
  });

  it('filters listed events and related orders by current tenant', async () => {
    mocks.eventCount.mockResolvedValue(1);
    mocks.eventFindMany.mockResolvedValue([
      {
        id: 'log-1',
        eventId: 'evt-ok',
        eventType: 'ORDER_PLACED',
        externalOrderId: 'order-ok',
        payload: { merchantId: 'merchant-1' },
        status: IntegrationEventStatus.RECEIVED,
        error: null,
        createdAt: new Date(),
        processedAt: null,
        acknowledgedAt: null,
      },
    ]);
    mocks.orderFindMany.mockResolvedValue([]);

    await IfoodService.listEvents({ page: 1, pageSize: 20 });

    expect(mocks.eventCount).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-ifood', provider: IntegrationProvider.IFOOD },
    });
    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-ifood', provider: IntegrationProvider.IFOOD },
      }),
    );
    expect(mocks.orderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-ifood',
          externalId: { in: ['order-ok'] },
        }),
      }),
    );
  });
});
