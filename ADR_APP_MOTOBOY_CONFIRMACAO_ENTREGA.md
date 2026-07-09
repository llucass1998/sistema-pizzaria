# ADR — App/PWA do Motoboy e Confirmação de Entrega

## Status

Aprovado para implementação.

## Contexto

O sistema já possui pedidos delivery, despacho, cadastro de motoboys, role `DRIVER`, autenticação admin/JWT, multi-tenant e eventos live. Porém o motoboy ainda acessa uma tela administrativa de despacho, sem uma experiência mobile dedicada e sem endpoints próprios que expressem claramente o limite de acesso do entregador.

A primeira versão deve ser uma PWA/web app responsiva dentro do projeto atual, acessível em `#/motoboy`, reaproveitando backend, autenticação, pedidos, despacho e motoboys existentes.

## Decisões

### 1. PWA web no projeto atual

A solução será uma área React/Vite mobile-first em `#/motoboy`, não um app nativo separado.

**Motivo:** reduz complexidade, reaproveita deploy atual, autenticação existente e permite validar o fluxo operacional rapidamente.

### 2. Endpoints dedicados `/api/driver/*`

A PWA consumirá rotas dedicadas ao motoboy, em vez de usar diretamente `/api/pedidos` ou a tela admin de despacho.

**Motivo:** o backend passa a expressar o limite de acesso do driver, evitando vazamento de pedidos de outros motoboys ou áreas administrativas.

### 3. Driver derivado do token

O frontend nunca enviará `driverId` como fonte de verdade. O backend resolverá o driver ativo por `tenantId + Admin.id`, usando `Driver.adminId`.

**Motivo:** evita impersonação de outro motoboy e preserva isolamento multi-tenant.

### 4. Confirmação de entrega transacional

A confirmação de entrega só será aceita quando o pedido for `DELIVERY`, estiver `OUT_FOR_DELIVERY`, pertencer ao tenant atual e estiver atribuído ao driver autenticado.

Ao confirmar:

- `Order.status` muda para `DELIVERED`.
- `OrderStatusEvent` registra a mudança real de status.
- `DriverDeliveryEvent` registra detalhes operacionais, como recebido por, nota, localização e prova quando enviados.
- Eventos live existentes são emitidos para atualizar admin/dispatch.

### 5. Falha de entrega não cancela pedido

`delivery-failed` registrará ocorrência em `DriverDeliveryEvent`, mas não mudará o pedido para `CANCELED` na V1.

**Motivo:** cancelamento afeta financeiro, estoque, fiscal e atendimento; deve continuar sendo decisão administrativa.

### 6. SSE do motoboy não usará canal global

A PWA usará polling seguro em V1. O SSE atual é tenant-wide e não será liberado para `DRIVER` sem filtro por driver.

**Motivo:** evitar vazamento de eventos/pedidos de outros motoboys.

### 7. PWA sem cache transacional agressivo

A PWA terá manifest e shell instalável, mas não fará confirmação offline nem cacheará `/api/*` agressivamente.

**Motivo:** entrega é fluxo operacional crítico; dados stale podem causar confirmação indevida.

## Consequências

- A área do motoboy fica separada do admin completo.
- Admin/manager continuam usando `/admin/dispatch`.
- A confirmação de entrega fica auditável e idempotente por regra de status.
- A V1 entrega segurança e usabilidade mobile sem exigir aplicativo nativo.
- Offline transacional e tracking em tempo real por SSE driver-scoped ficam como evolução futura se necessário.
