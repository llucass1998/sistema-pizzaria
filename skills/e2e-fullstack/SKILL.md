---
name: e2e-fullstack
description: Padrões, arquitetura e convenções para escrever e executar testes E2E com Playwright e testes de contrato/smoke no Vitest.
---

# E2E & Fullstack Testing Standards

Este skill define os padrões arquiteturais e mandamentos para criação e manutenção da suíte de testes automatizados do sistema de Pizzaria.

## 1. Suítes de Teste Existentes
- **Testes Unitários e de Serviços (`npm run test:api`):** Executado pelo Vitest (`vitest.config.ts`), testando serviços, controllers, middlewares e utilitários.
- **Testes E2E e Smoke Contracts (`npm run test:e2e`):** Executado via `vitest.e2e.config.ts` (ou Playwright em `tests/playwright/`), validando contratos HTTP reais e fluxos de ponta a ponta.

## 2. Regras para Testes E2E (Playwright & Vitest E2E)

### Isolamento e Multitenancy
- Todos os testes de API ou E2E que interagem com endpoints multitenant **DEVEM** enviar o cabeçalho `x-tenant` (ou `Host` de subdomínio configurado no mock) para que o `tenantGuard` resolva corretamente a loja.
- Em testes que verificam autenticação de Administrador/Dono, gere e injete o token JWT válido com o payload `{ id, role: 'ADMIN' | 'OWNER', tenantId }` no cabeçalho `Authorization: Bearer <token>`.

### Sem Hardcoding de Servidor Externo
- Os testes não devem depender de servidores externos em portas aleatórias na rede que possam estar desligados. Ao testar contratos HTTP localmente, utilize supertest/app injetado ou certifique-se de que o servidor de mock/teste seja iniciado na porta padrão (`3000` / `5173`) ou mockado via interceptores do Playwright (`page.route`).

### Aserções Resilientes na UI
- No Playwright, evite seletores CSS frágeis baseados em estrutura profunda ou classes geradas. Dê preferência a:
  - `page.getByRole('button', { name: 'Finalizar Pedido' })`
  - `page.getByTestId('checkout-submit')`
  - `page.getByText('Pedido despachado com sucesso!')`
- Aguarde ações assíncronas com `expect(locator).toBeVisible()` em vez de usar `page.waitForTimeout(...)` estáticos.

## 3. Cobertura de Fluxos Críticos
Ao adicionar novas features ou alterar telas do Admin/Frente de Loja, é obrigatório garantir que a alteração não quebre os seguintes fluxos nos testes E2E:
1. **Carrinho e Checkout:** Seleção de pizza, cálculo frete, aplicação de cupom e emissão de pedido.
2. **PDV e Caixa:** Abertura de turno, venda rápida, leitor de código de barras e fechamento de caixa.
3. **KDS e Despacho:** Avanço de fila da cozinha e atribuição de entregador.
4. **Multitenancy SaaS:** Resolução visual/dados da loja correta de acordo com o `tenantId`.