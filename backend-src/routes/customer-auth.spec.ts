import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  customerFindFirst: vi.fn(),
}));

vi.mock('../core/context/TenantContext.js', () => ({
  getTenantId: () => 'tenant-auth',
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    customer: {
      findFirst: mocks.customerFindFirst,
      create: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
  rlsContext: { run: (_context: unknown, callback: () => void) => callback() },
}));

const { hashPassword } = await import('../utils/password.js');
const { verifyToken } = await import('../utils/auth.js');
const { customerRoutes } = await import('./customer.routes.js');

let passwordHash = '';

beforeAll(async () => {
  passwordHash = await hashPassword('senha123');
});

function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api', customerRoutes);
  return app;
}

describe('customer login identity contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not authenticate an admin through the public customer endpoint', async () => {
    mocks.customerFindFirst.mockResolvedValue(null);

    const response = await request(createApp()).post('/api/login').send({
      email: 'admin@riopizzas.com',
      password: 'admin123',
    });

    expect(response.status).toBe(401);
    expect(response.body.admin).toBeUndefined();
  });

  it('returns a typed customer token for a valid customer', async () => {
    mocks.customerFindFirst.mockResolvedValue({
      id: 'customer-1',
      name: 'Cliente Teste',
      email: 'cliente@teste.com',
      phone: null,
      cpf: null,
      street: null,
      neighborhood: null,
      city: null,
      cep: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      orders: [],
      passwordHash,
    });

    const response = await request(createApp()).post('/api/login').send({
      email: 'cliente@teste.com',
      password: 'senha123',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 'customer-1',
      role: 'CUSTOMER',
      type: 'CUSTOMER',
    });
    expect(verifyToken(response.body.token)).toMatchObject({
      type: 'CUSTOMER',
      customerId: 'customer-1',
      tenantId: 'tenant-auth',
    });
  });
});
