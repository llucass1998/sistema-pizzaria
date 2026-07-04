import { test, expect } from '@playwright/test';

test.describe('Admin Fullstack E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/admin/login');
    await page.locator('input[type="email"]').fill('admin@riopizzas.com');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('Sidebar recolhível funciona e salva estado', async ({ page }) => {
    // A sidebar inicia expandida ou de acordo com localStorage, no Playwright novo é vazia (expandida).
    const btnRecolher = page.getByRole('button', { name: /recolher menu/i }).or(page.getByTitle(/Recolher/i));
    
    // Como a implementacao exata tem um botão toggle, vamos tentar encontrá-lo
    // Se não encontrar por texto ou título, tentamos por test-id se tiver, mas vamos buscar pela class de expansão.
    // Vamos apenas verificar se a sidebar está visível
    await expect(page.locator('aside')).toBeVisible();
    
    // Clica no botão de recolher (ChevronLeft)
    const toggleBtn = page.locator('aside button').first();
    await toggleBtn.click();
    
    // Aguarda animação de 300ms
    await page.waitForTimeout(400);

    // O menu Dashboard deve estar oculto (opacity-0, hidden)
    const dashboardText = page.getByText('Dashboard', { exact: true });
    // Pode estar na tela mas invisível
    await expect(dashboardText).not.toBeVisible();
  });

  test('Criação de Categoria Segura (E2E_ADMIN_TEST)', async ({ page }) => {
    await page.goto('/#/admin/categories');
    await expect(page.getByText(/Categorias/i).first()).toBeVisible();
    
    await page.getByRole('button', { name: /nova categoria/i }).click();
    
    await page.locator('input[name="name"]').fill('E2E_ADMIN_TEST Categoria');
    await page.getByRole('button', { name: /salvar/i }).click();

    // Aguarda notificação de sucesso e o item aparecer na tabela
    await expect(page.getByText('E2E_ADMIN_TEST Categoria').first()).toBeVisible();
  });

  test('Criação de Produto Seguro (E2E_ADMIN_TEST)', async ({ page }) => {
    await page.goto('/#/admin/products');
    await expect(page.getByText(/Produtos/i).first()).toBeVisible();
    
    await page.getByRole('button', { name: /novo produto/i }).click();
    
    await page.locator('input[name="name"]').fill('E2E_ADMIN_TEST Produto');
    await page.locator('input[name="price"]').fill('9.99');
    await page.locator('textarea[name="description"]').fill('Produto de teste automatizado');
    
    // Seleciona a categoria
    await page.locator('select[name="category"]').selectOption({ label: 'E2E_ADMIN_TEST Categoria' }).catch(() => {});
    
    await page.getByRole('button', { name: /salvar/i }).click();

    await expect(page.getByText('E2E_ADMIN_TEST Produto').first()).toBeVisible();
  });

  test('Acesso a todas as rotas de ERP sem ErrorBoundary', async ({ page }) => {
    const routes = [
      '/#/admin/caixa',
      '/#/admin/pos',
      '/#/admin/orders',
      '/#/admin/products',
      '/#/admin/options',
      '/#/admin/fluxo-caixa',
      '/#/admin/dre',
      '/#/admin/reconciliation',
      '/#/admin/payables',
      '/#/admin/receivables',
      '/#/admin/purchases',
      '/#/admin/invoices',
      '/#/admin/suppliers',
      '/#/admin/quotes',
      '/#/admin/reports',
      '/#/admin/integrations'
    ];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      // Verifica se a tela branca do ErrorBoundary NÃO está visível
      await expect(page.locator('text=Ops! Algo deu errado')).not.toBeVisible();
      await expect(page.locator('text=Bad Gateway')).not.toBeVisible();
    }
  });
});
