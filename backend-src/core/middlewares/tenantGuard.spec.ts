import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queryRawUnsafe: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  basePrisma: {
    $queryRawUnsafe: mocks.queryRawUnsafe,
  },
}));

const { getTenantId } = await import('../context/TenantContext.js');
const { tenantGuard } = await import('./tenantGuard.js');

function createApp() {
  const app = express();
  app.use(tenantGuard);
  app.get('/tenant', (_req, res) => {
    res.json({ tenantId: getTenantId() });
  });
  return app;
}

describe('tenantGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps a valid x-tenant-id as the highest priority source', async () => {
    mocks.queryRawUnsafe
      .mockResolvedValueOnce([{ column_name: 'isActive' }])
      .mockResolvedValueOnce([{ id: 'tenant-from-header' }]);

    const response = await request(createApp())
      .get('/tenant')
      .set('x-tenant-id', 'tenant-from-header')
      .set('Host', 'pizzarialucas.istigestao.com.br');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ tenantId: 'tenant-from-header' });
    expect(mocks.queryRawUnsafe).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE id = $1'),
      'tenant-from-header',
    );
  });

  it('rejects an invalid x-tenant-id instead of falling back to another tenant', async () => {
    mocks.queryRawUnsafe
      .mockResolvedValueOnce([{ column_name: 'isActive' }])
      .mockResolvedValueOnce([]);

    const response = await request(createApp())
      .get('/tenant')
      .set('x-tenant-id', 'tenant-from-header')
      .set('Host', 'pizzarialucas.istigestao.com.br');

    expect(response.status).toBe(401);
    expect(response.body.message).toContain('tenant invalido');
  });

  it('resolves the tenant from the production domain host when the header is absent', async () => {
    mocks.queryRawUnsafe
      .mockResolvedValueOnce([
        { column_name: 'customDomain' },
        { column_name: 'subdomain' },
        { column_name: 'isActive' },
      ])
      .mockResolvedValueOnce([{ id: 'tenant-from-domain' }]);

    const response = await request(createApp())
      .get('/tenant')
      .set('Host', 'pizzarialucas.istigestao.com.br');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ tenantId: 'tenant-from-domain' });
    expect(mocks.queryRawUnsafe).toHaveBeenLastCalledWith(
      expect.stringContaining('"customDomain" = $1'),
      'pizzarialucas.istigestao.com.br',
      'pizzarialucas',
    );
  });

  it('prefers an active tenant with customDomain before the generic first tenant fallback', async () => {
    mocks.queryRawUnsafe
      .mockResolvedValueOnce([
        { column_name: 'customDomain' },
        { column_name: 'subdomain' },
        { column_name: 'isActive' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'tenant-with-domain' }]);

    const response = await request(createApp()).get('/tenant').set('Host', '127.0.0.1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ tenantId: 'tenant-with-domain' });
    expect(mocks.queryRawUnsafe).toHaveBeenLastCalledWith(
      expect.stringContaining('"customDomain" IS NOT NULL'),
    );
  });

  it('returns 401 when no tenant can be resolved', async () => {
    mocks.queryRawUnsafe
      .mockResolvedValueOnce([{ column_name: 'isActive' }])
      .mockResolvedValueOnce([]);

    const response = await request(createApp()).get('/tenant').set('Host', '127.0.0.1');

    expect(response.status).toBe(401);
    expect(response.body.message).toContain('Tenant ausente');
  });
});
