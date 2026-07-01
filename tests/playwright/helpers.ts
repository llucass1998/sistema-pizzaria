import { expect, type Page } from '@playwright/test';

const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:3000/api';
const storeHost = process.env.PLAYWRIGHT_STORE_HOST ?? '127.0.0.1';

export async function loginE2ECustomer(page: Page, suffix: string) {
  const tenantResponse = await page.request.get(`${apiBaseUrl}/public/resolve-store`, {
    params: {
      host: storeHost,
      slug: '',
    },
  });

  expect(tenantResponse.ok()).toBeTruthy();
  const tenant = await tenantResponse.json();
  const email = `e2e_cliente_${suffix}@example.com`;
  const response = await page.request.post(`${apiBaseUrl}/login`, {
    headers: {
      'x-tenant-id': tenant.id,
    },
    data: {
      name: 'E2E_TEST Cliente',
      email,
    },
  });

  expect(response.ok()).toBeTruthy();
  const customer = await response.json();

  await page.addInitScript((savedCustomer) => {
    window.localStorage.setItem('pizzaria-customer', JSON.stringify(savedCustomer));
  }, customer);

  return customer;
}
