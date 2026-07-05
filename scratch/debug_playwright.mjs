import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:80/#/admin/login');
  await page.locator('input[type="email"]').fill('admin@riopizzas.com');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL('**/admin/dashboard');

  console.log('--- DASHBOARD TEXT ---');
  console.log((await page.locator('body').innerText()).slice(0, 300));

  const routes = ['orders', 'products', 'categories', 'options', 'crm', 'coupons', 'inventory', 'recipes', 'users', 'pos', 'kds', 'dispatch', 'settings', 'purchases', 'invoices', 'quotes', 'receivables', 'payables', 'caixa', 'fluxo-caixa', 'dre', 'conciliacao', 'suppliers', 'fornecedores', 'customers', 'team', 'relatorios', 'accounts-receivable', 'fiscal', 'integrations'];

  for (const route of routes) {
    await page.goto(`http://localhost:80/#/admin/${route}`);
    await page.waitForTimeout(500);
    const text = await page.locator('body').innerText();
    const isDenied = text.includes('Acesso negado');
    console.log(`Route /admin/${route}: ${isDenied ? 'DENIED' : 'OK'}`);
  }

  await browser.close();
}

run().catch(console.error);
