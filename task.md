# Task Tracking: FASE 1 — Taxa de Entrega Dinâmica

- `[x]` 1. Prisma: Adicionar `deliveryFeeMode` em `StoreSetting`.
- `[x]` 2. Prisma: Criar models `DeliveryZone` e `DeliveryRadiusRule`.
- `[x]` 3. Prisma: Gerar o Prisma client (`npx prisma generate`).
- `[x]` 4. Backend: Criar endpoints CRUD para Bairros e Raios em `delivery.routes.ts` (ou acoplar em `settings.routes.ts`).
- `[x]` 5. Backend: Criar rota `POST /api/checkout/calculate-delivery-fee`.
- `[x]` 6. Frontend: Atualizar `SettingsPage.jsx` para suportar as tabelas de zonas de entrega.
- `[x]` 7. Frontend: Modificar `Checkout` / `cartStore` para puxar a taxa dinâmica usando `/calculate-delivery-fee`.
- `[x]` 8. Typecheck e verificação final.

### Fase 2: Pagamento Online Integrado
- `[x]` 1. Prisma: Adicionar `paymentProvider`, `paymentExternalId`, e `paymentUrl` no model `Order`. Gerar prisma client.
- `[x]` 2. Backend: Criar interface/serviço estendido `PaymentGatewayService` para mockar a API (e permitir Stripe/MercadoPago no futuro).
- `[x]` 3. Backend: Novo endpoint `POST /api/checkout/create-online-payment` ou atualizar POST `/api/pedidos` para retornar `paymentUrl` se pagamento for `ONLINE`.
- `[x]` 4. Backend: Endpoint de Webhook `POST /api/webhooks/payments` para receber status de pagamento.
- `[x]` 5. Frontend: Modificar `CheckoutPage` para lidar com resposta contendo `paymentUrl` (redirecionar usuário).
- `[x]` 6. Frontend: Atualizar `orders.routes` ou similar para escutar status e UI de sucesso de pagamento online.

### Fase 2.1: Frente de Caixa (PDV) - Correção Crítica
- `[x]` 1.1 Alterar endpoints `/admin/categorias` para `/categorias` (com auth).
- `[x]` 1.2 Alterar endpoints `/admin/produtos` para `/produtos` (com auth).
- `[x]` 1.3 Implementar validação e empty states na listagem.
- `[x]` 1.4 Testar fluxo completo do PDV (abrir, adicionar itens, total, finalizar).

### Fase 3: Identificação da Loja (Multi-Tenant)
- `[x]` 1. Prisma: Modificar model `Tenant` (`slug`, `subdomain`, `customDomain`, `isActive`).
- `[x]` 2. Prisma: Gerar migração para o novo schema (cuidado com dados existentes).
- `[x]` 3. Backend: Criar `tenant.routes.ts` com `GET /api/public/resolve-store`.
- `[x]` 4. Backend: Adaptar chamadas para exigir e usar header `x-tenant-id`.
- `[x]` 5. Frontend: Criar logica inicial no `App.jsx` ou context para bater na rota de resolucao e gerenciar o `tenantId` globalmente.
- `[x]` 6. Frontend: Atualizar todas as requisicoes `fetch`/`api` para injetar o header `x-tenant-id` (usando monkey-patch no fetch global).

### Fase 4: Emissão de Cupom Fiscal (NFC-e)
- `[x]` 1. Prisma: Criar models `FiscalSettings` e `FiscalDocument`.
- `[x]` 2. Prisma: Gerar migração / db push.
- `[x]` 3. Backend: Criar rota `POST /api/admin/fiscal/orders/:orderId/issue`.
- `[x]` 4. Backend: Implementar servico base de mock de emissao para HOMOLOGACAO.
- `[x]` 5. Frontend: Adicionar botao de Emitir NFC-e na pagina de listagem de Pedidos.
