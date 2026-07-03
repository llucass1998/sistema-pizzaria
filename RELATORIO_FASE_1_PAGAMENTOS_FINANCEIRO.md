# Relatorio Fase 1 - Pagamentos, Invoices e Financeiro

## Resumo

Fase 1 iniciada e implementada com foco em persistencia financeira confiavel para checkout, PDV, invoices, contas a receber e dashboards.

Nao foram alterados arquivos de infraestrutura, Docker, Caddy, compose, portas, proxy, envs, URLs, SSL, networks, volumes ou scripts de deploy.

## Alteracoes no banco

Migration segura proposta/aplicada no schema Prisma de forma aditiva, sem apagar dados:

- `Order.paymentMethod String?`
- `Order.paymentStatus String @default("PENDING")`
- `Order.paidAt DateTime?`

Esses campos permitem consultar o estado financeiro do pedido sem depender apenas do status operacional do pedido.

Arquivo de migration criado:

- `prisma/migrations/20260701185000_order_payment_fields/migration.sql`

## Regras implementadas

- Checkout cria pedido com `paymentStatus = PENDING`.
- Checkout persiste `paymentMethod` oficial (`PIX`, `CASH`, `DEBIT_CARD`, `CREDIT_CARD`, `ONLINE_CARD`).
- Checkout cria `Invoice` pendente junto com o pedido, na mesma transacao.
- PDV cria pedido com `paymentStatus = PAID` e `paidAt` preenchido.
- PDV cria ou mantem `Invoice` e `Payment` pagos.
- Baixa parcial em contas a receber atualiza invoice e pedido como `PARTIALLY_PAID`.
- Baixa total atualiza invoice e pedido como `PAID` e preenche `paidAt`.
- Pedido cancelado atualiza financeiro para `CANCELED` e nao entra como receita paga.
- Webhook de pagamento online marca pedido/invoice como pago e cria pagamento complementar quando necessario.

## Dashboard e financeiro

- Dashboard administrativo passou a separar:
  - faturamento pago;
  - valor pendente;
  - valor cancelado;
  - mix de pagamentos por metodo real.
- ERP financeiro passou a usar status financeiro real do pedido/invoice.
- Contas a receber reconhece `PARTIALLY_PAID` alem do status legado `PARTIAL`.
- Rota de billing evita depender de pedido entregue para considerar receita paga.

## Arquivos alterados nesta fase

- `prisma/schema.prisma`
- `prisma/migrations/20260701185000_order_payment_fields/migration.sql`
- `.gitignore`
- `backend-src/services/orderFinancial.service.ts`
- `backend-src/services/orderFinancial.service.spec.ts`
- `backend-src/routes/order.routes.ts`
- `backend-src/routes/pos.routes.ts`
- `backend-src/routes/admin.routes.ts`
- `backend-src/routes/billing.routes.ts`
- `backend-src/controllers/receivables.controller.ts`
- `backend-src/controllers/webhook.controller.ts`
- `frontend-src/pages/admin/DashboardPage.jsx`
- `frontend-src/pages/ERP/Billing.jsx`
- `frontend-src/pages/ERP/AccountsReceivable.jsx`

## Testes realizados

- `npm run format:prisma`: passou.
- `npm run prisma:generate`: passou.
- `npm run typecheck:strict`: passou.
- `npm run test:api`: passou, 12 arquivos e 64 testes.
- `npm run build`: passou.
- `npm run test:e2e`: passou, 4 arquivos e 13 testes.
- `npm run test:all`: passou.

Observacao: o build manteve apenas o aviso conhecido do Vite sobre chunk maior que 500 kB.

## Validacao de infra

- `git diff --name-only` nao listou arquivos de infra.
- Nenhum arquivo Docker/Caddy/compose/env/proxy/porta/URL foi alterado.
- Banco nao foi apagado.
- Nao houve reset de dados.
- A alteracao de schema e apenas aditiva.

## Pendencias para fases seguintes

- Fase 2: expor e proteger o perfil entregador como papel administravel.
- Fase 3: substituir polling principal de Pedidos Live por SSE com fallback por polling.
- Validacao WSL/Docker final deve ser feita apos concluir as fases planejadas, evitando recriar containers com compose divergente sem necessidade.
