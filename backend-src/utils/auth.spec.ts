import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

async function importAuth() {
  vi.resetModules();
  return import('./auth.js');
}

describe('auth token secret resolution', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses ADMIN_SESSION_SECRET for JWTs in production when JWT_SECRET is absent', async () => {
    delete process.env.JWT_SECRET;
    process.env.ADMIN_SESSION_SECRET = 'admin-session-secret-test';
    process.env.NODE_ENV = 'production';

    const { createToken, verifyToken } = await importAuth();
    const token = createToken({ id: 'admin-1', email: 'admin@teste.com', role: 'ADMIN' });

    expect(verifyToken(token)).toMatchObject({
      id: 'admin-1',
      email: 'admin@teste.com',
      role: 'ADMIN',
    });
  });

  it('still requires an explicit secret in production', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.ADMIN_SESSION_SECRET;
    process.env.NODE_ENV = 'production';

    const { createToken } = await importAuth();

    expect(() => createToken({ id: 'admin-1', email: 'admin@teste.com', role: 'ADMIN' })).toThrow(
      'JWT_SECRET ou ADMIN_SESSION_SECRET obrigatorio em producao.',
    );
  });
});
