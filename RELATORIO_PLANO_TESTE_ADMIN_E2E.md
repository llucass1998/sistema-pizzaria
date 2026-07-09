# Plano de Teste E2E do Admin

Este documento mapeia o plano de ação para testar de ponta a ponta o painel Admin da Pizzaria, corrigindo bugs no frontend e backend sem quebrar a infraestrutura ou o app público.

## 1. Rotas Admin e Telas

- **Dashboard Executivo:** `/admin/dashboard`
- **Pedidos Live:** `/admin/orders`
- **Produtos:** `/admin/products`
- **Categorias:** `/admin/categories`
- **Opções Extras:** `/admin/options`
- **PDV:** `/admin/pos`
- **Integrações:** `/admin/integrations`
- **Equipe:** `/admin/team` ou `/admin/users`
- **CRM:** `/admin/crm`
- **Cupons:** `/admin/coupons`
- **Estoque & Fichas Técnicas:** `/admin/inventory` e `/admin/recipes`
- **Caixa & Turnos:** `/admin/caixa` e `/admin/shift-audit`
- **ERP/Financeiro:** Fluxo de Caixa, DRE, Conciliação, Receber, Pagar, Relatórios, etc.
- **Configurações:** `/admin/settings`
- **Fiscal:** `/admin/fiscal`

## 2. Endpoints Críticos

- `POST /api/login` e `/api/register`
- `GET/POST/PUT/DELETE /api/categorias`
- `GET/POST/PUT/DELETE /api/pizzas` (ou products)
- `GET/POST/PUT/DELETE /api/options` e `/api/option-groups`
- `GET/PUT /api/configuracoes`
- `GET /api/financeiro/*`, `GET /api/reports/*`
- `GET /api/public/resolve-store`

## 3. Riscos Encontrados

- **Cache do Docker:** Modificações podem não refletir sem `--no-cache`. Solução: usar scripts locais ou deploy correto.
- **Dependência de Infra:** Alterar Dockerfile/Caddy pode derrubar o sistema inteiro. Solução: proibido mexer.
- **RLS/Prisma Context:** Webhooks ou endpoints sem context de tenant podem falhar.
- **Testes Manuais:** O PDV e checkout requerem rigor para não corromper fluxo financeiro.

## 4. Estratégia de Rollback

- Todas as alterações de código (Frontend/Backend) serão commitadas em blocos lógicos. Se algo quebrar, faremos checkout local.
- Nenhum banco de dados será limpo via query destrutiva (truncate). Apenas remoção pontual dos IDs gerados.
- Infraestrutura intocável, garantindo que o Caddy/Docker continuem no estado original funcional se os contêineres precisarem ser reiniciados.

## 5. Dados de Teste

- **Prefixo:** `E2E_ADMIN_TEST_`
- **Categoria:** `E2E_ADMIN_TEST Categoria`
- **Produto:** `E2E_ADMIN_TEST Produto`
- **Opção Extra:** `E2E_ADMIN_TEST Opção`
- **Cupom:** `E2EADMIN10`
- **Usuário:** `e2e_admin_test@example.com`

## 6. Arquivos que Serão Alterados

- Componentes do Admin: `frontend-src/pages/admin/*.jsx`
- Rotas de Backend, se bugs encontrados: `backend-src/routes/*.ts` ou `backend-src/controllers/*.ts`
- Scripts de Teste Automatizado: `tests/playwright/admin-*.spec.ts` (ou similar) e `scripts/smoke-test-admin-e2e.sh`.

## 7. Arquivos Proibidos de Alteração

- `docker-compose.yml`, `Dockerfile.*`, configuração do Caddy, credenciais e `.env` reais, schema base destrutivo, ou qualquer código de infra.
