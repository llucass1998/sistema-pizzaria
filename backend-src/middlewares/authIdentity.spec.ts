import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  adminFindFirst: vi.fn(),
  customerFindFirst: vi.fn(),
}));

vi.mock('../core/context/TenantContext.js', () => ({
  getTenantId: () => 'tenant-auth',
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    admin: { findFirst: mocks.adminFindFirst },
    customer: { findFirst: mocks.customerFindFirst },
  },
  rlsContext: {
    run: (_context: unknown, callback: () => void) => callback(),
  },
}));

const { createToken } = await import('../utils/auth.js');
const { requireAdmin } = await import('./requireAdmin.js');
const { requireCustomer } = await import('./requireCustomer.js');

function customerToken() {
  return createToken({
    id: 'customer-1',
    sub: 'customer-1',
    customerId: 'customer-1',
    email: 'cliente@teste.com',
    role: 'CUSTOMER',
    type: 'CUSTOMER',
    tenantId: 'tenant-auth',
  });
}

function adminToken() {
  return createToken({
    id: 'admin-1',
    sub: 'admin-1',
    userId: 'admin-1',
    email: 'admin@teste.com',
    role: 'OWNER',
    type: 'STAFF',
    tenantId: 'tenant-auth',
  });
}

function createApp() {
  const app = express();
  app.use(cookieParser());
  app.get('/admin', requireAdmin, (_req, res) => res.sendStatus(204));
  app.get('/account', requireCustomer, (_req, res) => res.sendStatus(204));
  return app;
}

describe('identity separation middlewares', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminFindFirst.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@teste.com',
      role: 'OWNER',
    });
    mocks.customerFindFirst.mockResolvedValue({ id: 'customer-1' });
  });

  it('returns 401 without a token on an admin route', async () => {
    const response = await request(createApp()).get('/admin');
    expect(response.status).toBe(401);
  });

  it('returns 403 when a customer token reaches an admin route', async () => {
    const response = await request(createApp())
      .get('/admin')
      .set('Authorization', `Bearer ${customerToken()}`);
    expect(response.status).toBe(403);
    expect(mocks.adminFindFirst).not.toHaveBeenCalled();
  });

  it('allows a valid staff token on an admin route', async () => {
    const response = await request(createApp())
      .get('/admin')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(response.status).toBe(204);
  });

  it('returns 403 when a staff token reaches a customer-only route', async () => {
    const response = await request(createApp())
      .get('/account')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(response.status).toBe(403);
    expect(mocks.customerFindFirst).not.toHaveBeenCalled();
  });

  it('allows a valid customer token on a customer route', async () => {
    const response = await request(createApp())
      .get('/account')
      .set('Authorization', `Bearer ${customerToken()}`);
    expect(response.status).toBe(204);
  });

  it('rejects a customer token from another tenant', async () => {
    const token = createToken({
      id: 'customer-1',
      sub: 'customer-1',
      customerId: 'customer-1',
      email: 'cliente@teste.com',
      role: 'CUSTOMER',
      type: 'CUSTOMER',
      tenantId: 'tenant-other',
    });
    const response = await request(createApp())
      .get('/account')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });
});
