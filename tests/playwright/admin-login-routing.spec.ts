import { expect, test } from '@playwright/test';

test('routes staff credentials from the public modal to the dedicated admin login', async ({
  page,
}) => {
  let customerLoginCalls = 0;
  let adminLoginCalls = 0;

  await page.route('**/api/login', async (route) => {
    customerLoginCalls += 1;
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Email ou senha invalidos.' }),
    });
  });
  await page.route('**/api/admin/login', async (route) => {
    adminLoginCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        admin: { id: 'admin-1', email: 'admin@riopizzas.com', role: 'OWNER' },
        token: 'staff-token',
        role: 'OWNER',
        type: 'STAFF',
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar na conta' }).click();
  await page.locator('input[type="email"]').fill('admin@riopizzas.com');
  await page.locator('input[type="password"]').fill('senha-segura');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  await expect(page).toHaveURL(/#\/admin\/dashboard$/);
  expect(customerLoginCalls).toBe(1);
  expect(adminLoginCalls).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(window.localStorage.getItem('pizzaria-admin') || 'null')),
    )
    .toMatchObject({ type: 'STAFF', role: 'OWNER', token: 'staff-token' });
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('pizzaria-customer')))
    .toBeNull();
});
