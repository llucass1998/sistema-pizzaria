import { expect, test } from '@playwright/test';

test('replaces an expired customer session with a single login prompt', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'pizzaria-customer',
      JSON.stringify({
        id: 'legacy-customer',
        name: 'Dados antigos não devem aparecer',
        email: 'legacy@example.com',
        role: 'CUSTOMER',
        token: 'legacy-invalid-token',
      }),
    );
  });

  await page.goto('/#/conta');

  await expect(page).toHaveURL(/#\/conta$/);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toHaveCount(1);
  await expect(
    page.getByText('Sua sessão foi atualizada. Entre novamente para acessar seus pedidos.'),
  ).toBeVisible();
  await expect(page.getByText('Dados antigos não devem aparecer')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('pizzaria-customer')))
    .toBeNull();
});

test('keeps a valid customer session on temporary server errors', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'pizzaria-customer',
      JSON.stringify({
        id: 'customer-valid-shape',
        name: 'Cliente válido',
        email: 'cliente@example.com',
        role: 'CUSTOMER',
        type: 'CUSTOMER',
        token: 'typed-customer-token',
      }),
    );
  });
  await page.route('**/api/account/**', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/#/conta');

  await expect(
    page.getByText('Não foi possível carregar seus dados. Tente novamente.'),
  ).toBeVisible();
  await expect(
    page.getByText('Não foi possível carregar seus pedidos. Tente novamente.'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('pizzaria-customer')))
    .not.toBeNull();
});
