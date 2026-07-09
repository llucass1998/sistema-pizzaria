# Relatório Final — App/PWA do Motoboy e Confirmação de Entrega

## Resumo

Foi implementada a primeira versão funcional do App/PWA do Motoboy dentro do Sistema Pizzaria SaaS/ERP, acessível por `#/motoboy`. A solução reaproveita autenticação admin/JWT, tenant guard, pedidos, despacho, motoboys existentes e eventos live, sem criar app nativo separado e sem alterar infraestrutura.

## Backend implementado

### Rotas novas

Namespace dedicado:

- `GET /api/driver/me`
- `GET /api/driver/orders`
- `GET /api/driver/orders/:orderId`
- `POST /api/driver/orders/:orderId/confirm-delivery`
- `POST /api/driver/orders/:orderId/delivery-failed`
- `POST /api/driver/orders/:orderId/location`
- `POST /api/driver/orders/:orderId/proof`

Arquivos:

- `backend-src/routes/driver.routes.ts`
- `backend-src/services/driverDelivery.service.ts`
- `backend-src/routes/driver.routes.spec.ts`
- `backend-src/app.ts`

### Regras de segurança

- Todas as rotas `/api/driver/*` exigem autenticação JWT via `requireAdmin` no registro do app.
- Todas as rotas exigem role `DRIVER` via `requireRole(['DRIVER'])`.
- O backend resolve o entregador por `tenantId + Admin.id`, usando `Driver.adminId`.
- O frontend não envia `driverId` como fonte de verdade.
- Pedidos são sempre filtrados por `tenantId`, `driverId` autenticado e `fulfillmentType='DELIVERY'`.
- Um motoboy não acessa pedido atribuído a outro motoboy.
- Confirmação duplicada é bloqueada quando o pedido já está `DELIVERED`.
- Falha de entrega não cancela pedido em V1.
- Upload de comprovante usa rota dedicada e pasta própria `public/uploads/delivery-proofs`.
- SSE tenant-wide não foi liberado para `DRIVER`; a PWA usa polling.

### Auditoria e banco

Foi adicionada migration não destrutiva:

- `prisma/migrations/20260709000000_driver_delivery_events/migration.sql`

Foi adicionada a model `DriverDeliveryEvent` em `prisma/schema.prisma`, com relações para `Tenant`, `Order` e `Driver`, além de índices por tenant/pedido, tenant/driver, tenant/tipo e ator.

Eventos auditados:

- `LOCATION_REPORTED`
- `PROOF_UPLOADED`
- `DELIVERY_CONFIRMED`
- `DELIVERY_FAILED`

A confirmação de entrega também cria `OrderStatusEvent` com `source='DRIVER_DELIVERY_CONFIRMATION'`.

## Frontend implementado

Área mobile-first em:

- `#/motoboy`
- alias `#/driver` redireciona para `#/motoboy`
- alias `#/entregador` redireciona para `#/motoboy`

Arquivos:

- `frontend-src/pages/driver/driverApi.js`
- `frontend-src/pages/driver/DriverLoginPage.jsx`
- `frontend-src/pages/driver/DriverLayout.jsx`
- `frontend-src/pages/driver/DriverHomePage.jsx`
- `frontend-src/pages/driver/DriverOrderDetailsPage.jsx`
- `frontend-src/App.jsx`
- `frontend-src/pages/admin/LoginPage.jsx`
- `public/manifest.webmanifest`
- `index.html`

Funcionalidades:

- Login mobile do motoboy usando `/api/admin/login`.
- Sessão reaproveita `localStorage['pizzaria-admin']` com token e role.
- Bloqueio de sessão que não seja `DRIVER`.
- Lista de entregas atribuídas ao motoboy.
- Polling seguro a cada 30 segundos.
- Tela de detalhe do pedido.
- Endereço, telefone, WhatsApp e rota no Google Maps.
- Itens, total e dados de pagamento operacional.
- Confirmação de entrega com recebido por, observação, localização opcional e comprovante opcional.
- Registro de falha de entrega com motivo, observação e localização opcional.
- Logout próprio do app do motoboy.

## PWA

Foi adicionado manifest em `public/manifest.webmanifest` com:

- `start_url: /#/motoboy`
- `display: standalone`
- ícones existentes do projeto
- tema visual mobile

Não foi adicionado cache agressivo nem confirmação offline para `/api/*`, evitando dados transacionais desatualizados.

## Integração com admin/dispatch/live

Na confirmação de entrega, o backend emite:

- `order-status-changed`
- `order-updated`

Em falha, localização e comprovante, o backend emite `order-updated` com evento operacional seguro. Isso mantém admin/dispatch/pedidos live alinhados sem liberar canal SSE global para o motoboy.

## Testes executados

- `npm run format:prisma` — passou.
- `npm run prisma:generate` — passou.
- `npx vitest run -c vitest.config.ts backend-src/routes/driver.routes.spec.ts` — 6 testes passaram.
- `npm run typecheck:strict` — passou.
- `npm run build` — passou.
- `npm run build:api` — passou.
- `npm run test:api` — 27 arquivos e 148 testes passaram.

## Validações manuais pendentes para Docker/WSL

Ainda devem ser executadas na etapa final de subida Docker/WSL:

- Aplicar migration com `npm run prisma:deploy` no ambiente Docker/WSL, sem reset de banco.
- Rebuild/recreate de `api` e `web` sem remover volumes.
- Validar `/api/status`.
- Validar loja pública `/`.
- Validar `/api/public/resolve-store`.
- Abrir `/#/motoboy` no navegador em viewport mobile.
- Testar login real de um usuário `DRIVER` vinculado a um `Driver.adminId`.
- Testar pedido atribuído real em `OUT_FOR_DELIVERY`, confirmação, falha e atualização no admin/dispatch.

## Riscos residuais

- A confirmação com geolocalização depende da permissão do navegador/dispositivo do motoboy.
- O fluxo de comprovante salva imagem local em `public/uploads/delivery-proofs`; em produção distribuída, storage persistente/backup deve ser validado conforme infraestrutura real.
- A PWA V1 não confirma entrega offline por segurança operacional.
- A falha de entrega não cancela pedido; tratativa final continua administrativa para não afetar financeiro, estoque ou fiscal indevidamente.

## Pendências evolutivas

- SSE filtrado por driver, se necessário no futuro.
- Histórico dedicado de eventos de entrega no admin/dispatch.
- Política formal de retenção e limpeza de comprovantes.
- Melhorias de tracking em tempo real por localização, com consentimento e escopo operacional claro.
