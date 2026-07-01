import { test, expect } from '@playwright/test';
import { loginE2ECustomer } from './helpers';

test.describe('Frente de Loja E2E', () => {
  test('Fluxo completo: Home -> Carrinho -> Checkout PIX', async ({ page }) => {
    await loginE2ECustomer(page, 'store_pix');

    // 1. Home
    await page.goto('/');
    
    // Verificar se não tem 502 ou ErrorBoundary
    await expect(page.locator('text=Ops! Algo deu errado')).not.toBeVisible();
    await expect(page.locator('text=Bad Gateway')).not.toBeVisible();

    // 2. Verificar produto E2E
    const productCard = page.locator('text=E2E_TEST Pizza').first();
    await expect(productCard).toBeVisible();
    
    // Clicar para abrir modal
    await productCard.click();
    
    // Modal do produto
    const modal = page.locator('.fixed.inset-0').first();
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=E2E_TEST Pizza')).toBeVisible();
    
    // Adicionar ao carrinho
    const addToCartButton = modal.locator('button:has-text("Adicionar ao carrinho")').first();
    await expect(addToCartButton).toBeVisible();
    await addToCartButton.click();

    // 3. Abrir carrinho
    // As vezes o carrinho abre automaticamente dependendo da UI.
    // Se não, vamos procurar o icone do carrinho.
    const cartButton = page.locator('button:has(svg.lucide-shopping-cart)').first();
    if (await cartButton.isVisible()) {
      await cartButton.click();
    }
    
    // Verificar se o item está no carrinho
    await expect(page.locator('text=E2E_TEST Pizza').nth(1)).toBeVisible(); // .nth(1) pq pode ter no fundo
    
    // Fechar carrinho e ir pro checkout
    const checkoutBtn = page.locator('text=Finalizar Pedido').first();
    if (await checkoutBtn.isVisible()) {
      await checkoutBtn.click();
    } else {
      await page.goto('/#/checkout'); // fallback pra rota caso gaveta de erro
    }

    // 4. Checkout
    await expect(page.locator('text=Finalizar Pedido').first()).toBeVisible();

    // Preencher formulário de checkout
    await page.getByPlaceholder('Seu nome').fill('E2E_TEST Cliente');
    await page.getByPlaceholder('(00) 00000-0000').fill('11999999999');

    // Selecionar Retirada pra pular endereco
    await page.getByRole('button', { name: 'Retirada na loja' }).click();

    // Selecionar PIX
    await page.getByRole('button', { name: /^PIX\b/ }).click();

    // O QR Code deve aparecer
    await expect(page.locator('text=Copiar código PIX')).toBeVisible();

    // Clicar em finalizar
    const finishBtn = page.getByRole('button', { name: /Finalizar Pedido/i }).first();
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/pedidos') && (res.status() === 200 || res.status() === 201)),
      finishBtn.click()
    ]);
    expect(response.ok()).toBeTruthy();
  });
});
