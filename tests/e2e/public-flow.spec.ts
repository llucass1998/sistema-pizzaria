import { describe, expect, it } from 'vitest';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://web-dev:5173';
const STORE_HOST = process.env.E2E_STORE_HOST ?? 'pizzarialucas.istigestao.com.br';

async function expectOk(path: string) {
  const response = await fetch(`${BASE_URL}${path}`);
  expect(response.status, `${path} status`).toBeGreaterThanOrEqual(200);
  expect(response.status, `${path} status`).toBeLessThan(400);
  return response;
}

describe('public E2E smoke flow', () => {
  it('serves the public store shell and critical public API endpoints', async () => {
    const home = await expectOk('/');
    expect(await home.text()).toContain('<div id="root">');

    const status = await expectOk('/api/status');
    expect(await status.json()).toMatchObject({ ok: true, service: 'pizzaria-api' });

    const store = await expectOk(`/api/public/resolve-store?host=${STORE_HOST}&slug=`);
    const storeBody = await store.json();
    expect(typeof storeBody.slug).toBe('string');
    expect(storeBody.slug.length).toBeGreaterThan(0);
    expect(storeBody.isMaintenance).toBe(false);

    await expectOk('/api/configuracoes');
    await expectOk('/api/categorias');
    await expectOk('/api/pizzas');
    await expectOk('/api/products');
  });
});
