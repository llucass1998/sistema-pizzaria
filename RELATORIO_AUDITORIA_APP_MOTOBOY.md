# Relatório de Auditoria — App/PWA do Motoboy

## Objetivo

Mapear o estado atual do Sistema Pizzaria SaaS/ERP antes da implementação da área mobile do motoboy, garantindo que a solução preserve segurança, multi-tenant, pedidos, despacho, admin, KDS, financeiro, checkout e loja pública.

## Arquitetura atual encontrada

### Frontend

- O frontend usa React + Vite + Tailwind em `frontend-src/`.
- `frontend-src/App.jsx` centraliza resolução de tenant, sessão pública/admin, rotas públicas e rotas admin/SaaS via `HashRouter`.
- A sessão admin fica em `localStorage['pizzaria-admin']` com `{ admin, token, role }`.
- A role `DRIVER` já existe no frontend e é aceita como sessão admin.
- `frontend-src/pages/admin/LoginPage.jsx` autentica em `/api/admin/login` e atualmente redireciona `DRIVER` para `/admin/dispatch`.
- `frontend-src/pages/admin/AdminLayout.jsx` possui layout responsivo com drawer mobile, mas continua sendo uma experiência administrativa completa.
- `frontend-src/pages/admin/DispatchPage.jsx` já concentra despacho, motoboys, mapa e conclusão de entrega, porém mistura gestão administrativa com operação do entregador.

### Backend

- O backend usa Express + TypeScript em `backend-src/`.
- `backend-src/app.ts` registra rotas públicas antes do `tenantGuard` e rotas protegidas depois dele.
- `tenantGuard` resolve tenant por header/domínio/subdomínio/fallback e popula `TenantContext`.
- `requireAdmin` valida JWT/cookie, consulta o admin no tenant atual e injeta `req.adminId`, `req.admin` e `req.adminRole`.
- `requireRole` aplica RBAC por role, com `SUPER_ADMIN` como exceção de role, mas sem dispensar validação de tenant quando combinado com `requireAdmin`.
- `backend-src/routes/dispatch.routes.ts` já permite role `DRIVER` em algumas rotas e filtra pedidos pelo `Driver.adminId` vinculado ao admin autenticado.
- `PATCH /api/admin/dispatch/orders/:orderId/status` já permite ao driver concluir entrega própria, desde que o pedido esteja `OUT_FOR_DELIVERY`.

### Banco/Prisma

- `prisma/schema.prisma` possui `Order.driverId`, relação `Order.driver`, `Driver.adminId`, relação `Admin.driverProfile` e `OrderStatusEvent`.
- `Order.status` é `String`, não enum tipado, embora existam enums no schema.
- Ainda não existe uma tabela específica para eventos granulares de entrega do motoboy.

### Eventos/live

- `backend-src/services/orderEvents.service.ts` mantém SSE por tenant.
- Os eventos atuais são distribuídos para todos os clientes conectados do tenant.
- Esse SSE não possui filtro por driver, portanto não deve ser liberado diretamente para role `DRIVER`.

### Upload

- `backend-src/routes/upload.routes.ts` tem upload genérico para admin/produtos/identidade.
- Não há upload dedicado de comprovante de entrega vinculado ao pedido/motoboy.

## Lacunas identificadas

1. Não existe rota frontend dedicada `#/motoboy`.
2. Motoboy hoje cai em `/admin/dispatch`, que é pesado e administrativo.
3. Não existe namespace backend dedicado `/api/driver/*`.
4. `DispatchPage.jsx` busca `/api/pedidos?limit=100`, rota inadequada para app de motoboy por potencial exposição ampla de pedidos.
5. SSE atual é tenant-wide, sem filtro por driver.
6. Falha de entrega, localização e prova não possuem fluxo dedicado.
7. Não há auditoria granular por ação do motoboy além de `OrderStatusEvent` para troca de status.
8. Não há manifest PWA específico para iniciar em `#/motoboy`.

## Impacto por área

- Loja pública: não deve ser alterada funcionalmente; apenas roteamento deve excluir `#/motoboy` da navegação pública.
- Checkout: não deve ser alterado.
- Admin: mantém `/admin/dispatch` para gestão; motoboy deve ganhar experiência separada.
- PDV/KDS/Despacho: devem continuar recebendo eventos quando pedido for entregue.
- Financeiro/pagamentos: não deve haver alteração de valores, recebimentos ou status financeiro.
- Multi-tenant: todas as queries devem usar tenant do contexto e nunca confiar em tenant vindo do frontend.
- Segurança: `driverId` deve ser derivado pelo token/admin autenticado e vínculo `Driver.adminId`.

## Recomendação

Implementar uma PWA mobile-first em `#/motoboy`, com endpoints dedicados `/api/driver/*`, usando a autenticação admin/JWT existente, role `DRIVER`, filtro obrigatório por driver vinculado e uma nova tabela `DriverDeliveryEvent` para auditoria granular. A confirmação de entrega deve atualizar `Order.status` para `DELIVERED`, criar `OrderStatusEvent`, criar `DriverDeliveryEvent` e emitir eventos live existentes para admin/dispatch.
