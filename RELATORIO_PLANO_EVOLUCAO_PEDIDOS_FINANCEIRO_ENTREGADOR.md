# Plano de Evolucao - Pedidos, Financeiro e Entregador

## Estado atual

- Branch atual: `main`, acompanhando `origin/main`.
- Existem alteracoes locais anteriores em `backend-src/core/middlewares/tenantGuard.ts`, `backend-src/routes/order.routes.ts` e `frontend-src/pages/admin/OrdersPage.jsx`.
- Existem relatorios e testes locais ainda nao versionados das fases anteriores.
- O diff de infraestrutura esta vazio ate este ponto: nao ha alteracao em Docker, Caddy, compose, portas, proxy, envs, URLs, SSL, volumes, networks ou scripts de deploy.
- O schema ja possui modelos financeiros basicos: `Invoice`, `Payment`, `CashRegister` e `CashTransaction`.
- O checkout envia `paymentMethod`, mas o pedido ainda precisa persistir metodo/status financeiro de forma consistente.
- O PDV ja cria invoice/payment em `backend-src/routes/pos.routes.ts`, mas o pedido precisa refletir o estado financeiro para dashboard e consistencia operacional.
- O dashboard administrativo ainda depende principalmente de pedidos entregues e pagamentos vinculados a invoice, o que limita visao de pendentes/cancelados.

## Arquivos que serao analisados

- `prisma/schema.prisma`
- `backend-src/routes/order.routes.ts`
- `backend-src/routes/pos.routes.ts`
- `backend-src/routes/admin.routes.ts`
- `backend-src/routes/billing.routes.ts`
- `backend-src/controllers/receivables.controller.ts`
- `backend-src/routes/receivables.routes.ts`
- `backend-src/controllers/webhook.controller.ts`
- `frontend-src/pages/CheckoutPage.jsx`
- `frontend-src/pages/POS/POSScreen.jsx`
- `frontend-src/pages/admin/DashboardPage.jsx`
- `frontend-src/pages/ERP/Billing.jsx`
- `frontend-src/pages/ERP/AccountsReceivable.jsx`
- Testes existentes em `backend-src/**/*.spec.ts` e `tests/playwright`.

## Riscos

- Inconsistencia entre `Order`, `Invoice` e `Payment` se a atualizacao nao ocorrer em transacao.
- Receita duplicada no dashboard se forem somados pedido e pagamento da invoice ao mesmo tempo.
- Quebra de checkout se `paymentMethod` antigo ou ausente nao for tratado com fallback.
- Quebra de PDV se os metodos enviados pela tela divergirem dos metodos oficiais.
- Vazamento multi-tenant se qualquer consulta financeira deixar de filtrar `tenantId`.
- Migration deve ser apenas aditiva e nao destrutiva, preservando pedidos existentes.

## Estrategia de rollback

- Reverter apenas os arquivos alterados nesta evolucao, preservando alteracoes anteriores do usuario.
- Se campos novos forem adicionados ao Prisma, rollback de codigo pode ignorar esses campos sem apagar dados.
- Nao executar reset de banco, truncate ou migration destrutiva.
- Validar `git diff --name-only` antes e depois de cada fase para garantir que infra nao foi tocada.

## Ordem de implementacao

1. Fase 1: pagamentos, invoices, contas a receber e dashboard financeiro.
2. Fase 2: perfil entregador com permissoes backend/frontend.
3. Fase 3: Pedidos Live com SSE e fallback por polling.

## Plano da Fase 1

- Confirmar campos existentes em `Order`, `Invoice` e `Payment`.
- Adicionar campos seguros em `Order` se necessario: `paymentMethod`, `paymentStatus` e `paidAt`.
- Centralizar regras financeiras de pedido para evitar duplicacao entre checkout, PDV, webhook e baixas.
- Criar invoice/receivable inicial no checkout quando o pedido nascer.
- Garantir que PDV marque pedido como pago e mantenha invoice/payment sincronizados.
- Atualizar baixa parcial/total para refletir status no pedido vinculado.
- Ajustar dashboard para separar faturamento pago, pendente, cancelado e mix de pagamentos.
- Criar/atualizar testes automatizados para checkout, PDV, baixa parcial/total e dashboard.
- Rodar typecheck, build e testes disponiveis ao fim da fase.
