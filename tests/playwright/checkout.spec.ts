import { test, expect } from '@playwright/test';
import { loginE2ECustomer } from './helpers';

test.describe('Checkout Completo E2E', () => {

  test.beforeEach(async ({ page }) => {
    await loginE2ECustomer(page, test.info().title.replace(/\W+/g, '_').toLowerCase());

    // Preparar carrinho
    await page.goto('/');
    const productCard = page.locator('text=E2E_TEST Pizza').first();
    await productCard.click();
    const modal = page.locator('.fixed.inset-0').first();
    const addToCartButton = modal.locator('button:has-text("Adicionar ao carrinho")').first();
    await addToCartButton.click();
    
    const checkoutBtn = page.locator('text=Finalizar Pedido').first();
    if (await checkoutBtn.isVisible()) {
      await checkoutBtn.click();
    } else {
      await page.goto('/#/checkout');
    }
    await expect(page.locator('text=Finalizar Pedido').first()).toBeVisible();
    await page.getByPlaceholder('Seu nome').fill('E2E_TEST Cliente');
    await page.getByPlaceholder('(00) 00000-0000').fill('11999999999');
  });

  test('Entrega + Cartão de Crédito', async ({ page }) => {
    // Selecionar Entrega
    const deliveryRadio = page.locator('input[value="DELIVERY"]');
    if (await deliveryRadio.isVisible()) {
      await deliveryRadio.check();
    }

    // Preencher endereço
    await page.getByPlaceholder('Nome da rua, avenida...').fill('Rua de Teste, 999');
    await page.getByPlaceholder('Bairro').fill('Centro');
    await page.getByPlaceholder('123').fill('999');

    // Selecionar Cartão de Crédito (na entrega)
    await page.getByRole('button', { name: 'Crédito' }).click();

    const finishBtn = page.getByRole('button', { name: /Finalizar Pedido/i }).first();
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/pedidos') && (res.status() === 200 || res.status() === 201)),
      finishBtn.click()
    ]);
    expect(response.ok()).toBeTruthy();
  });

  test('Retirada + Dinheiro sem troco', async ({ page }) => {
    // Selecionar Retirada
    await page.getByRole('button', { name: 'Retirada na loja' }).click();

    // Selecionar Dinheiro
    await page.getByRole('button', { name: 'Dinheiro' }).click();
      
    const finishBtn = page.getByRole('button', { name: /Finalizar Pedido/i }).first();
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/pedidos') && (res.status() === 200 || res.status() === 201)),
      finishBtn.click()
    ]);
    expect(response.ok()).toBeTruthy();
  });
});
