import { test, expect } from '@playwright/test';

test.describe('Admin phase 3 smoke', () => {
  test('loads dashboard, settings and live orders after admin login', async ({ page }) => {
    await page.goto('/#/admin/login');

    await page.locator('input[type="email"]').fill('admin@riopizzas.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.locator('text=Ops! Algo deu errado')).not.toBeVisible();
    await expect(page.locator('text=Bad Gateway')).not.toBeVisible();
    await expect(page.getByText(/Pedidos/i).first()).toBeVisible();

    await page.goto('/#/admin/orders');
    await expect(page.getByText(/Gestão Live|Gestao Live/i)).toBeVisible();
    await expect(page.locator('text=Erro ao carregar os pedidos')).not.toBeVisible();

    await page.goto('/#/admin/settings');
    await expect(page.getByText(/Configurações da Loja|Configuracoes da Loja/i)).toBeVisible();
    await expect(page.locator('input[value="Rio de Janeiro Pizzas"]').first()).toBeVisible();
  });
});
