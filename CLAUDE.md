# CLAUDE.md - Regras Permanentes do Sistema Pizzaria SaaS/ERP

Este arquivo orienta qualquer agente que trabalhe neste repositório. Ele deve ser lido antes de qualquer alteração. O sistema é um SaaS/ERP de pizzaria com loja pública, operação interna e integrações críticas. Preserve compatibilidade, dados reais e isolamento multi-tenant.

## 1. Visão Geral da Arquitetura

- **Frontend:** React + Vite + Tailwind, em `frontend-src/`.
- **Backend:** Node.js + Express + TypeScript, em `backend-src/`.
- **Banco:** PostgreSQL + Prisma, schema em `prisma/schema.prisma`, client gerado em `generated/`.
- **Infra local/prod:** Docker/WSL/Caddy, com `docker-compose.yml`, `Dockerfile.api`, `Dockerfile.web`, `nginx.conf` e `Caddyfile`.
- **Domínio de produção:** `pizzarialucas.istigestao.com.br`.

Principais áreas do produto:

- **Loja pública:** páginas públicas em `frontend-src/pages/`, produtos/categorias/configurações servidos por rotas públicas da API.
- **Carrinho:** componentes públicos em `frontend-src/components/ui/`, rotas backend em `backend-src/routes/cart.routes.ts`.
- **Checkout:** `frontend-src/pages/CheckoutPage.jsx`, criação/validação de pedido em `backend-src/routes/order.routes.ts` e serviços relacionados.
- **Admin/ERP:** páginas em `frontend-src/pages/admin/`, layout em `AdminLayout.jsx`, rotas protegidas em `/api/admin/*`.
- **PDV:** frontend em `frontend-src/pages/POS/` e `frontend-src/pages/admin/POSPage.jsx`; backend em `backend-src/routes/pos.routes.ts`.
- **Caixa:** ligado ao PDV, auditoria de turno, financeiro e recebimentos; serviços em `shiftAudit`, `financial`, `receivables`.
- **Pedidos live:** SSE em `/api/admin/orders/events` e `/api/orders/events`, serviço `backend-src/services/orderEvents.service.ts`.
- **KDS:** páginas em `frontend-src/pages/KDS/` e admin `KDSPage.jsx`; backend em `backend-src/routes/kds.routes.ts`.
- **Despacho:** `frontend-src/pages/admin/DispatchPage.jsx`, backend em `backend-src/routes/dispatch.routes.ts`.
- **Estoque:** `frontend-src/pages/admin/InventoryPage.jsx`; backend em `inventory.routes.ts`, `inventory.service.ts`, `InventoryConsumptionPlanner.ts`, `ProductAvailabilityService.ts`, `waste.service.ts`.
- **Financeiro:** contas a pagar/receber, DRE, fluxo de caixa, conciliação, relatórios; rotas e services em `financial`, `payables`, `receivables`, `reconciliation`, `reports`.
- **iFood:** integrações em `backend-src/integrations/ifood/` e rotas em `backend-src/routes/integration.routes.ts`.
- **Fiscal/NFC-e:** `frontend-src/pages/admin/FiscalPage.jsx`, backend em `backend-src/routes/fiscal.routes.ts` e `backend-src/services/FiscalService.ts`.
- **Pagamentos:** `PaymentGatewayService`, webhooks de pagamento, `PaymentTransaction`, `PaymentWebhookEvent`, Mercado Pago, PIX manual e fluxo de entrada 50%.
- **Multi-tenant:** tenant resolvido por domínio/header/contexto; Prisma injeta `tenantId` via extensão em `backend-src/lib/prisma.ts`.

## 2. Convenções do Projeto

- **Páginas frontend:** ficam em `frontend-src/pages/`; páginas administrativas em `frontend-src/pages/admin/`; PDV dedicado em `frontend-src/pages/POS/`; KDS dedicado em `frontend-src/pages/KDS/`.
- **Componentes frontend:** ficam em `frontend-src/components/`; componentes UI compartilhados em `frontend-src/components/ui/`; componentes admin em `frontend-src/components/admin/`.
- **Rotas backend:** ficam em `backend-src/routes/*.routes.ts` e são registradas em `backend-src/app.ts`.
- **Controllers backend:** ficam em `backend-src/controllers/*.controller.ts` quando a regra de negócio da rota é maior.
- **Services backend:** ficam em `backend-src/services/` e `backend-src/integrations/`; regras de domínio críticas devem ficar em service, não soltas no frontend.
- **Permissões:** rotas protegidas usam `requireAdmin` e/ou `requireRole`. Roles relevantes incluem `OWNER`, `ADMIN`, `MANAGER`, `CASHIER`, `KITCHEN` e `SUPER_ADMIN`. `SUPER_ADMIN` não deve substituir validação de tenant em dados operacionais.
- **Tenant/store:** `tenantGuard` resolve tenant por `x-tenant-id`, host, domínio customizado, subdomínio ou tenant padrão. Rotas públicas de resolução ficam em `tenant.routes.ts`, antes do `tenantGuard`.
- **Isolamento multi-tenant:** use `getTenantId()` do contexto. Nunca confie em `tenantId` vindo do body/query para operações autenticadas ou integrações externas. Queries Prisma devem incluir tenant explícito ou passar pelo client `prisma` com contexto ativo.
- **PaymentGatewayService:** centraliza criação de links/QR, mock local, Mercado Pago, normalização de webhook e metadados de pagamento. Não duplique lógica de gateway em rotas ou frontend.
- **Webhooks:** rotas de webhook ficam fora do `tenantGuard` e devem resolver tenant de forma confiável via assinatura, metadados, externalId, merchantId ou transação já registrada.
- **Migrations:** novas alterações de banco devem ir em `prisma/migrations/<timestamp_nome>/migration.sql` e atualizar `prisma/schema.prisma`. Rodar `npm run format:prisma` e `npm run prisma:generate` após alterar schema.

## 3. Comandos Essenciais

- Instalar dependências: `npm install`
- Rodar frontend: `npm run dev`
- Rodar backend: `npm run api`
- Rodar build frontend: `npm run build`
- Rodar build backend: `npm run build:api`
- Rodar typecheck estrito: `npm run typecheck:strict`
- Rodar lint: `npx eslint .`
- Rodar format check: `npm run format:check`
- Rodar testes unit/API: `npm run test` ou `npm run test:api`
- Rodar testes smoke: `npm run test:smoke`
- Rodar testes E2E configurados: `npm run test:e2e`
- Gerar Prisma Client: `npm run prisma:generate`
- Criar/aplicar migration dev: `npm run prisma:migrate`
- Aplicar migrations em ambiente existente: `npm run prisma:deploy`
- Formatar Prisma: `npm run format:prisma`
- Subir Docker: `docker compose up -d --build`
- Rebuild sem cache de API/web: `docker compose build --no-cache api web`
- Recriar API/web sem mexer no banco: `docker compose up -d --no-deps --force-recreate api web`
- Ver containers: `docker compose ps`
- Validar WSL: `wsl -l -v`
- Validar API: `curl.exe -I http://127.0.0.1/api/status`
- Validar loja: `curl.exe -I http://127.0.0.1/`
- Validar resolve-store: `curl.exe -i "http://127.0.0.1/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="`

## 4. Regras de Ouro

- Nunca apagar banco.
- Nunca executar reset destrutivo em dados reais.
- Nunca deletar tenant, loja, pedidos, clientes, pagamentos, fiscal ou estoque sem pedido explícito e backup validado.
- Nunca alterar `docker-compose.yml`, `Caddyfile`, `.env`, portas, domínio, volumes ou proxy sem necessidade comprovada.
- Nunca commitar segredo, token, senha, certificado A1, `clientSecret`, access token, refresh token ou credencial de gateway/iFood.
- Nunca confiar em valores enviados pelo frontend para preço, taxa, desconto, status, tenant, saldo, pagamento ou permissão.
- Cálculo de pedido deve acontecer no backend.
- Webhook deve ser idempotente.
- Pagamento nunca pode duplicar recebimento, baixa financeira ou atualização de status.
- Pedido antigo precisa continuar funcionando mesmo após mudança de schema ou UI.
- Loja pública, checkout e admin não podem quebrar.
- Antes de alterar fluxo crítico, mapear impacto em loja pública, checkout, admin, PDV, financeiro e tenant.
- Em ambiente sujo, não reverter mudanças que não foram feitas por você.

## 5. Regras Específicas de Pagamento

- Manter compatibilidade com PIX manual.
- Manter compatibilidade com Mercado Pago.
- `PaymentTransaction` deve ser fonte de auditoria das tentativas/eventos de pagamento.
- `PaymentWebhookEvent` deve impedir reprocessamento de webhook duplicado.
- Webhook duplicado não pode somar valor duas vezes.
- Gateway deve usar externalId, provider e tenant como chaves de rastreio.
- Pagamento 50% deve separar entrada, saldo pendente e valor recebido.
- Não misturar `amount`, `depositAmount`, `paidAmount`, `pendingAmount` e total do pedido sem regra explícita.
- Se `allowPayRestOnDelivery` estiver ativo, o saldo pendente deve permanecer visível para admin/cliente.
- Pedido com pagamento parcial não deve ser tratado como totalmente quitado.
- Erro de gateway não pode cancelar pedido já criado sem regra explícita.

## 6. Regras Específicas de iFood

- Nunca expor secret, token, refresh token ou credencial iFood em resposta pública, log ou frontend.
- Webhook iFood precisa ser idempotente.
- Polling iFood não pode duplicar pedido.
- `merchantId` deve resolver tenant/store a partir de credencial cadastrada, nunca do body enviado pelo iFood.
- Não confiar em `tenantId` vindo do body, query ou payload externo.
- Eventos devem ser gravados/rastreados para auditoria e reprocessamento seguro.
- Integração deve continuar funcionando se uma credencial estiver inativa, expirada ou em homologação.
- Ao alterar ingestão de pedido externo, testar duplicidade, status e vínculo financeiro/estoque.

## 7. Regras Específicas de NFC-e

- Não prometer emissão real se o provider atual for mock.
- Não salvar certificado A1 sem segurança adequada.
- Nunca commitar certificado, senha de certificado, CSC, token CSC ou dados fiscais sensíveis.
- Produção fiscal só com checklist completo: certificado, CSC, ambiente, UF, regime tributário, série, numeração, contingência, cancelamento e inutilização.
- Homologação precisa ficar clara na UI.
- Logs fiscais não devem vazar XML completo com dados sensíveis sem mascaramento.
- Mudanças fiscais devem preservar pedidos antigos e documentos já emitidos.

## 8. Regras de Testes

- Toda feature crítica precisa de teste.
- Pagamento, webhook, permissões, checkout, pedido, estoque e financeiro exigem teste.
- Rodar `npm run typecheck:strict` e `npm run build` antes de finalizar mudança funcional.
- Rodar `npm run test:api` ou `npm run test` quando backend/services forem alterados.
- Rodar `npm run prisma:generate` após alteração no schema.
- Testar manualmente loja pública, admin e checkout em mudanças de UI/fluxo.
- Para pagamento/webhook, testar duplicidade e idempotência.
- Para permissões, testar usuário real afetado e rotas protegidas.
- Para multi-tenant, testar que dados de outro tenant não aparecem.

## 9. Regra Anti-cache / Anti-container Fantasma

Antes de concluir deploy local/WSL/Docker, confirmar que não há build antigo sendo servido:

1. Verificar containers antigos: `docker compose ps`
2. Rebuildar API e web: `docker compose build --no-cache api web`
3. Subir/recriar containers: `docker compose up -d --no-deps --force-recreate api web`
4. Validar status: `curl.exe -I http://127.0.0.1/api/status`
5. Validar loja: `curl.exe -I http://127.0.0.1/`
6. Validar tenant/store: `curl.exe -i "http://127.0.0.1/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="`
7. Conferir headers/data/asset hash para garantir que a resposta não veio de build velho.
8. Se houver erro visual no navegador, limpar cache do navegador ou fazer logout/login quando permissões mudarem.

Nunca remover volumes do banco para "limpar cache".

## 10. Formato de Entrega Obrigatório

Antes de codar:

- Apresentar plano.
- Citar arquivos/áreas que serão inspecionados.
- Avisar riscos se envolver banco, pagamento, fiscal, iFood, Docker, Caddy ou env.

Depois de codar:

- Apresentar arquivos alterados.
- Apresentar diff resumido.
- Apresentar testes rodados e resultado.
- Apresentar validações manuais feitas.
- Apresentar riscos residuais.
- Apresentar pendências.

Se não foi possível rodar algum teste, explicar o motivo de forma direta.

## 11. Checklist Rápido Para Agentes

- Li este `CLAUDE.md`.
- Entendi se a mudança afeta loja pública, checkout, admin, PDV, KDS, despacho, estoque, financeiro, iFood, fiscal ou pagamento.
- Preservei tenant e permissões.
- Não toquei em segredo/env/infra sem necessidade.
- Não apaguei dados.
- Mantive compatibilidade com pedidos antigos.  
- Rodei typecheck/build/testes proporcionais ao risco.
- Validei Docker/cache quando subi atualização.
