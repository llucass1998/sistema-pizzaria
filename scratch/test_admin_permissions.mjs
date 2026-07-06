/**
 * Teste E2E de permissões do admin@riopizzas.com
 * Executa: node scratch/test_admin_permissions.mjs
 */

const BASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@riopizzas.com';
const ADMIN_PASSWORD = 'admin123';

// Cores no terminal
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let token = null;
let passCount = 0;
let failCount = 0;

async function test(description, fn) {
  try {
    const result = await fn();
    if (result.ok) {
      console.log(`${GREEN}✅ PASS${RESET} ${description} (HTTP ${result.status})`);
      passCount++;
    } else {
      console.log(`${RED}❌ FAIL${RESET} ${description} (HTTP ${result.status})`);
      const body = await result.text().catch(() => '');
      if (body) console.log(`   Response: ${body.slice(0, 150)}`);
      failCount++;
    }
  } catch (err) {
    console.log(`${RED}❌ ERROR${RESET} ${description}: ${err.message}`);
    failCount++;
  }
}

async function main() {
  console.log(`\n${BOLD}=== Teste de Permissões: admin@riopizzas.com ===${RESET}\n`);

  // ─── LOGIN ──────────────────────────────────────────────────────────────────
  console.log(`${BOLD}[1/3] Login${RESET}`);
  
  let loginResponse;
  try {
    loginResponse = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
  } catch (err) {
    console.log(`${RED}❌ FATAL: Servidor não acessível em ${BASE_URL}${RESET}`);
    console.log(`   Erro: ${err.message}`);
    console.log(`   Verifique se a API está rodando.\n`);
    process.exit(1);
  }

  if (!loginResponse.ok) {
    const body = await loginResponse.json().catch(() => ({}));
    console.log(`${RED}❌ FATAL: Login falhou (HTTP ${loginResponse.status})${RESET}`);
    console.log(`   Resposta: ${JSON.stringify(body)}`);
    console.log(`   Verifique as credenciais ou execute o resetAdmin.ts\n`);
    process.exit(1);
  }

  const loginData = await loginResponse.json();
  token = loginData.token;
  const role = loginData.role || loginData.admin?.role;
  
  console.log(`${GREEN}✅ Login realizado!${RESET}`);
  console.log(`   Email: ${loginData.admin?.email}`);
  console.log(`   Role: ${role}`);
  console.log(`   Token: ${token ? token.slice(0, 30) + '...' : 'N/A'}\n`);

  if (role !== 'OWNER' && role !== 'SUPER_ADMIN') {
    console.log(`${YELLOW}⚠️  Role atual: ${role}. Para acesso total, deve ser OWNER.${RESET}\n`);
  }

  const headers = { Authorization: `Bearer ${token}` };

  // ─── TESTES DE ROTAS BACKEND ─────────────────────────────────────────────
  console.log(`${BOLD}[2/3] Testando rotas protegidas do backend${RESET}`);

  await test('GET /api/admin/dashboard/summary', () =>
    fetch(`${BASE_URL}/api/admin/dashboard/summary`, { headers })
  );
  await test('GET /api/admin/clientes', () =>
    fetch(`${BASE_URL}/api/admin/clientes`, { headers })
  );
  await test('GET /api/admin/users', () =>
    fetch(`${BASE_URL}/api/admin/users`, { headers })
  );
  await test('GET /api/admin/inventory/ingredients', () =>
    fetch(`${BASE_URL}/api/admin/inventory/ingredients`, { headers })
  );
  await test('GET /api/admin/inventory/waste', () =>
    fetch(`${BASE_URL}/api/admin/inventory/waste`, { headers })
  );
  await test('GET /api/admin/financial/summary', () =>
    fetch(`${BASE_URL}/api/admin/financial/summary`, { headers })
  );
  await test('GET /api/admin/financial/cash-flow', () =>
    fetch(`${BASE_URL}/api/admin/financial/cash-flow`, { headers })
  );
  await test('GET /api/admin/financial/dre', () =>
    fetch(`${BASE_URL}/api/admin/financial/dre`, { headers })
  );
  await test('GET /api/admin/payables', () =>
    fetch(`${BASE_URL}/api/admin/payables`, { headers })
  );
  await test('GET /api/admin/receivables/invoices', () =>
    fetch(`${BASE_URL}/api/admin/receivables/invoices`, { headers })
  );
  await test('GET /api/admin/purchases', () =>
    fetch(`${BASE_URL}/api/admin/purchases`, { headers })
  );
  await test('GET /api/admin/invoices', () =>
    fetch(`${BASE_URL}/api/admin/invoices`, { headers })
  );
  await test('GET /api/admin/suppliers', () =>
    fetch(`${BASE_URL}/api/admin/suppliers`, { headers })
  );
  await test('GET /api/admin/quotes', () =>
    fetch(`${BASE_URL}/api/admin/quotes`, { headers })
  );
  await test('GET /api/admin/reconciliation/summary', () =>
    fetch(`${BASE_URL}/api/admin/reconciliation/summary`, { headers })
  );
  await test('GET /api/admin/reports/summary', () =>
    fetch(`${BASE_URL}/api/admin/reports/summary`, { headers })
  );
  await test('GET /api/admin/fiscal/settings', () =>
    fetch(`${BASE_URL}/api/admin/fiscal/settings`, { headers })
  );
  await test('GET /api/admin/dispatch/drivers', () =>
    fetch(`${BASE_URL}/api/admin/dispatch/drivers`, { headers })
  );
  await test('GET /api/admin/manufacturing/orders', () =>
    fetch(`${BASE_URL}/api/admin/manufacturing/orders`, { headers })
  );
  await test('GET /api/admin/kds/queue', () =>
    fetch(`${BASE_URL}/api/admin/kds/queue`, { headers })
  );
  await test('GET /api/admin/pos/shift/registers', () =>
    fetch(`${BASE_URL}/api/admin/pos/shift/registers`, { headers })
  );

  // ─── RESULTADO ──────────────────────────────────────────────────────────────
  const total = passCount + failCount;
  console.log(`\n${BOLD}[3/3] Resultado${RESET}`);
  console.log(`   Total de testes: ${total}`);
  console.log(`   ${GREEN}✅ Aprovados: ${passCount}${RESET}`);
  if (failCount > 0) {
    console.log(`   ${RED}❌ Falhos: ${failCount}${RESET}`);
    console.log(`\n${YELLOW}⚠️  Algumas rotas falharam. Verifique os erros acima.${RESET}\n`);
  } else {
    console.log(`\n${GREEN}${BOLD}🎉 admin@riopizzas.com tem acesso 100% ao sistema!${RESET}\n`);
  }
}

main().catch(err => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
