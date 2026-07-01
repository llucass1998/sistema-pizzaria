/**
 * Script de healthcheck automatizado — padrao ERP.
 *
 * Executa uma sequencia de testes de integracao contra a API em execucao,
 * validando cada regra de negocio. Reporta erros detalhados e codigo de saida 1
 * em caso de falha.
 *
 * Uso: npx tsx backend-src/healthcheck.ts [URL_BASE]
 *
 * Exemplo: npx tsx backend-src/healthcheck.ts http://localhost:3000/api
 */

const BASE_URL = process.argv[2] ?? 'http://localhost:3000/api';
const SLEEP_MS = 400;

// ─── Helpers ────────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function pass(label: string) {
  passCount++;
  console.log(`  ✅  ${label}`);
}

function fail(label: string, detail?: string) {
  failCount++;
  const msg = detail ? `${label} — ${detail}` : label;
  failures.push(msg);
  console.log(`  ❌  ${msg}`);
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return { status: response.status, data };
  } catch (error) {
    return { status: 0, data: null, error: String(error) };
  }
}

function section(title: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(60)}`);
}

// ─── Testes ─────────────────────────────────────────────────────────────────────

async function testHealthCheck() {
  section('FASE 1 — Health Check e Status');

  const { status, data } = await request('GET', '/status');
  if (status === 200 && (data as Record<string, unknown>)?.ok === true) {
    pass('/api/status retorna 200 ok=true');
  } else {
    fail('/api/status falhou', `status=${status}`);
  }

  await sleep(SLEEP_MS);

  const { status: hs, data: hd } = await request('GET', '/health');
  if (status === 200 || hs === 503) {
    const report = hd as Record<string, unknown>;
    if (report?.timestamp && report?.components) {
      pass('/api/health retorna estrutura valida com timestamp e components');
    } else {
      fail('/api/health estrutura invalida', JSON.stringify(hd));
    }
  } else {
    fail('/api/health nao respondeu', `status=${hs}`);
  }
}

async function testAdminFlow(email: string, password: string) {
  section('FASE 2 — Autenticacao Admin');

  // Setup/login.
  const { status: loginStatus, data: loginData } = await request('POST', '/login', {
    email,
    password,
  });

  if (loginStatus === 200 || loginStatus === 201) {
    pass('Login admin retornou 200/201');
  } else {
    fail('Login admin falhou — verifique se o seed foi executado', `status=${loginStatus}`);
    return null;
  }

  const token = (loginData as Record<string, unknown>)?.token as string | undefined;

  if (token) {
    pass('Token JWT recebido no login admin');
  } else {
    fail('Token ausente na resposta do login admin');
    return null;
  }

  await sleep(SLEEP_MS);

  // Rota protegida sem token deve retornar 401.
  const { status: noAuth } = await request('GET', '/pedidos');
  if (noAuth === 401) {
    pass('GET /pedidos sem token retorna 401 (protecao funcionando)');
  } else {
    fail('GET /pedidos sem token deveria retornar 401', `status=${noAuth}`);
  }

  return token;
}

async function testCustomerFlow() {
  section('FASE 3 — Autenticacao Cliente');

  const testEmail = `hc-${Date.now()}@teste.com`;
  const testPassword = 'senha123';

  // Cadastro.
  const { status: regStatus } = await request('POST', '/register', {
    name: 'HC Teste',
    email: testEmail,
    password: testPassword,
  });

  if (regStatus === 201) {
    pass('POST /register retorna 201');
  } else {
    fail('POST /register falhou', `status=${regStatus}`);
    return null;
  }

  await sleep(SLEEP_MS);

  // Cadastro duplicado deve retornar 409.
  const { status: dupStatus } = await request('POST', '/register', {
    name: 'HC Teste',
    email: testEmail,
    password: testPassword,
  });

  if (dupStatus === 409) {
    pass('Cadastro com email duplicado retorna 409 (REGRA DE NEGOCIO)');
  } else {
    fail('Cadastro duplicado deveria retornar 409', `status=${dupStatus}`);
  }

  await sleep(SLEEP_MS);

  // Login correto.
  const { status: loginStatus, data: loginData } = await request('POST', '/login', {
    email: testEmail,
    password: testPassword,
  });

  const customerLogin = loginData as Record<string, unknown>;
  const customerToken = customerLogin?.token as string | undefined;

  if (loginStatus === 200 && customerLogin?.id && customerToken) {
    pass('Login cliente com senha retorna 200 com id');
  } else {
    fail('Login cliente falhou', `status=${loginStatus}`);
    return null;
  }

  await sleep(SLEEP_MS);

  // Login com senha errada deve retornar 401.
  const { status: badLogin } = await request('POST', '/login', {
    email: testEmail,
    password: 'senhaerrada',
  });

  if (badLogin === 401) {
    pass('Login com senha errada retorna 401 (SEGURANCA)');
  } else {
    fail('Login com senha errada deveria retornar 401', `status=${badLogin}`);
  }

  await sleep(SLEEP_MS);

  // Login sem senha em conta com senha deve retornar 401 (SEGURANCA CRITICA).
  const { status: noPassLogin } = await request('POST', '/login', {
    name: 'Invasor',
    email: testEmail,
  });

  if (noPassLogin === 401) {
    pass('Login sem senha em conta com senha retorna 401 (SEGURANCA CRITICA)');
  } else {
    fail(
      '[CRITICO] Login sem senha em conta com senha deveria retornar 401',
      `status=${noPassLogin}`,
    );
  }

  return customerToken;
}

async function testProductValidations(adminToken: string) {
  section('FASE 4 — Validacoes de Produto');

  const authHeaders = { Authorization: `Bearer ${adminToken}` };

  // Categoria invalida deve retornar 400.
  const { status: catStatus } = await request(
    'POST',
    '/pizzas',
    { name: 'Teste', price: '30.00', category: 'lixo-invalido' },
    authHeaders,
  );

  if (catStatus === 400) {
    pass('Categoria invalida retorna 400 (VALIDACAO ERP)');
  } else {
    fail('Categoria invalida deveria retornar 400', `status=${catStatus}`);
  }

  await sleep(SLEEP_MS);

  // Nome muito longo deve retornar 400.
  const { status: longName } = await request(
    'POST',
    '/pizzas',
    { name: 'A'.repeat(200), price: '30.00', category: 'pizzas' },
    authHeaders,
  );

  if (longName === 400) {
    pass('Nome muito longo retorna 400 (VALIDACAO COMPRIMENTO)');
  } else {
    fail('Nome muito longo deveria retornar 400', `status=${longName}`);
  }

  await sleep(SLEEP_MS);

  // Preco zero deve retornar 400.
  const { status: zeroPrice } = await request(
    'POST',
    '/pizzas',
    { name: 'Pizza Teste', price: '0', category: 'pizzas' },
    authHeaders,
  );

  if (zeroPrice === 400) {
    pass('Preco zero retorna 400 (VALIDACAO PRECO)');
  } else {
    fail('Preco zero deveria retornar 400', `status=${zeroPrice}`);
  }
}

async function testOrderStateMachine(adminToken: string, customerToken: string) {
  section('FASE 5 — Maquina de Estados dos Pedidos');

  const authHeaders = { Authorization: `Bearer ${adminToken}` };
  const customerAuthHeaders = { Authorization: `Bearer ${customerToken}` };

  // Primeiro, busca um produto disponivel.
  const { status: pStatus, data: pData } = await request('GET', '/pizzas');
  const products = pData as Array<Record<string, unknown>>;

  if (pStatus !== 200 || !Array.isArray(products) || products.length === 0) {
    fail('Nao foi possivel buscar produtos para testar pedidos');
    return;
  }

  const product = products.find((p) => p.isAvailable === true);

  if (!product) {
    fail('Nenhum produto disponivel para criar pedido de teste');
    return;
  }

  // Cria pedido PICKUP.
  const { status: orderStatus, data: orderData } = await request(
    'POST',
    '/pedidos',
    {
      fulfillmentType: 'PICKUP',
      items: [{ productId: product.id, quantity: 1 }],
    },
    customerAuthHeaders,
  );

  if (orderStatus === 201) {
    pass('Criacao de pedido PICKUP retorna 201');
  } else {
    fail('Criacao de pedido falhou', `status=${orderStatus}, data=${JSON.stringify(orderData)}`);
    return;
  }

  const orderId = (orderData as Record<string, unknown>)?.id as string;

  if (!orderId) {
    fail('Pedido criado sem ID');
    return;
  }

  await sleep(SLEEP_MS);

  // Tenta pular etapa: PENDING → DELIVERED (deve falhar com 422).
  const { status: skipStatus } = await request(
    'PATCH',
    `/pedidos/${orderId}/status`,
    { status: 'DELIVERED' },
    authHeaders,
  );

  if (skipStatus === 422) {
    pass('Salto de status PENDING→DELIVERED retorna 422 (MAQUINA DE ESTADOS)');
  } else {
    fail('Salto de status deveria retornar 422', `status=${skipStatus}`);
  }

  await sleep(SLEEP_MS);

  // Tenta transicao invalida para PICKUP: PENDING → OUT_FOR_DELIVERY (deve falhar).
  const { status: wrongStatus } = await request(
    'PATCH',
    `/pedidos/${orderId}/status`,
    { status: 'OUT_FOR_DELIVERY' },
    authHeaders,
  );

  if (wrongStatus === 422) {
    pass('Transicao PICKUP PENDING→OUT_FOR_DELIVERY retorna 422 (TIPO DE ENTREGA)');
  } else {
    fail('Transicao invalida deveria retornar 422', `status=${wrongStatus}`);
  }

  await sleep(SLEEP_MS);

  // Transicao valida: PENDING → PREPARING.
  const { status: prepStatus } = await request(
    'PATCH',
    `/pedidos/${orderId}/status`,
    { status: 'PREPARING' },
    authHeaders,
  );

  if (prepStatus === 200) {
    pass('Transicao valida PENDING→PREPARING retorna 200');
  } else {
    fail('Transicao PENDING→PREPARING falhou', `status=${prepStatus}`);
  }

  await sleep(SLEEP_MS);

  // Cancelamento a partir de PREPARING deve funcionar.
  const { status: cancelStatus } = await request(
    'PATCH',
    `/pedidos/${orderId}/status`,
    { status: 'CANCELED' },
    authHeaders,
  );

  if (cancelStatus === 200) {
    pass('Cancelamento a partir de PREPARING retorna 200');
  } else {
    fail('Cancelamento a partir de PREPARING falhou', `status=${cancelStatus}`);
  }

  await sleep(SLEEP_MS);

  // Tentar alterar status de pedido CANCELADO deve retornar 422.
  const { status: postCancelStatus } = await request(
    'PATCH',
    `/pedidos/${orderId}/status`,
    { status: 'PENDING' },
    authHeaders,
  );

  if (postCancelStatus === 422) {
    pass('Alterar status de pedido CANCELADO retorna 422 (ESTADO TERMINAL)');
  } else {
    fail('Alterar status de pedido cancelado deveria retornar 422', `status=${postCancelStatus}`);
  }
}

async function testSettings(adminToken: string) {
  section('FASE 6 — Configuracoes da Loja');

  const authHeaders = { Authorization: `Bearer ${adminToken}` };

  const { status: getStatus, data: settings } = await request('GET', '/configuracoes');

  if (getStatus === 200 && (settings as Record<string, unknown>)?.storeName) {
    pass('GET /configuracoes retorna 200 com storeName');
  } else {
    fail('GET /configuracoes falhou', `status=${getStatus}`);
  }

  await sleep(SLEEP_MS);

  // Taxa de entrega negativa deve retornar 400.
  const { status: negFee } = await request(
    'PUT',
    '/configuracoes/taxa-entrega',
    { deliveryFee: '-5' },
    authHeaders,
  );

  if (negFee === 400) {
    pass('Taxa de entrega negativa retorna 400 (VALIDACAO FINANCEIRA)');
  } else {
    fail('Taxa negativa deveria retornar 400', `status=${negFee}`);
  }

  await sleep(SLEEP_MS);

  // serviceFee deve estar presente (Fase 5 do plano).
  const settingsData = settings as Record<string, unknown>;
  if ('serviceFee' in settingsData) {
    pass('Campo serviceFee presente nas configuracoes (TAXA DE SERVICO CONFIGURAVEL)');
  } else {
    fail('Campo serviceFee ausente nas configuracoes — migration pendente?');
  }
}

// ─── Runner ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  HEALTHCHECK — Pizzaria ERP');
  console.log(`  API: ${BASE_URL}`);
  console.log(`  ${new Date().toLocaleString('pt-BR')}`);
  console.log(`${'═'.repeat(60)}`);

  await testHealthCheck();

  const adminToken = await testAdminFlow('admin@riopizzas.com', 'admin123');
  const customerToken = await testCustomerFlow();

  if (adminToken) {
    await testProductValidations(adminToken);

    if (customerToken) {
      await testOrderStateMachine(adminToken, customerToken);
    }

    await testSettings(adminToken);
  }

  // ─── Relatorio final ───────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  RESULTADO FINAL');
  console.log(`${'═'.repeat(60)}`);
  console.log(`\n  ✅  Passou:  ${passCount}`);
  console.log(`  ❌  Falhou:  ${failCount}`);

  if (failures.length > 0) {
    console.log('\n  Falhas detalhadas:');
    failures.forEach((f, i) => console.log(`    ${i + 1}. ${f}`));
  }

  const allPassed = failCount === 0;
  console.log(
    `\n  Status: ${allPassed ? '🟢 TODOS OS TESTES PASSARAM' : '🔴 HA FALHAS — VERIFIQUE ACIMA'}\n`,
  );

  process.exit(allPassed ? 0 : 1);
}

run().catch((error) => {
  console.error('\n💥  Erro fatal no healthcheck:', error);
  process.exit(1);
});
