# Relatorio Fase 3 - Pedidos Live com SSE

## Resumo

Fase 3 implementada com SSE/EventSource para o painel Pedidos Live, mantendo polling de 20 segundos como fallback automatico.

O objetivo foi reduzir dependencia do polling principal e permitir que novos pedidos, mudancas de status e atribuicoes de entregador aparecam no painel administrativo sem refresh manual.

## Backend

Criado servico:

- `backend-src/services/orderEvents.service.ts`

Responsabilidades:

- manter clientes SSE por `tenantId`;
- enviar `heartbeat`;
- remover cliente ao desconectar;
- emitir eventos apenas para clientes do tenant correto;
- retornar quantidade de clientes notificados para testes/observabilidade.

Endpoint criado:

- `GET /api/admin/orders/events`
- Alias operacional usado pelo frontend: `GET /api/orders/events`

Protecoes:

- exige `requireAdmin`;
- exige role permitida: `OWNER`, `ADMIN`, `MANAGER`, `CASHIER`, `KITCHEN`;
- usa `getTenantId()` para isolar eventos por loja.

Eventos emitidos:

- `connected`
- `heartbeat`
- `order-created`
- `order-updated`
- `order-status-changed`
- `order-assigned`

Pontos conectados:

- checkout publico ao criar pedido;
- PDV em `order.routes.ts`;
- PDV em `pos.routes.ts`;
- alteracao de status no admin;
- KDS ao marcar item/pedido pronto;
- KDS ao despachar pedido;
- despacho ao atribuir entregador;
- despacho/entregador ao finalizar entrega.

## Frontend

Arquivo ajustado:

- `frontend-src/pages/admin/OrdersPage.jsx`

Comportamento:

- carregamento inicial segue usando `fetch`;
- depois abre `EventSource` para `/api/orders/events`, alias validado no WSL/proxy;
- eventos atualizam ou inserem pedidos sem recarregar a tela;
- evita duplicacao ordenando por `createdAt`;
- toca alerta sonoro para novo pedido pendente;
- se SSE cair, ativa polling a cada 20 segundos;
- tenta reconectar automaticamente;
- mantem refresh manual/status update funcionando.

## Testes automatizados

Criado teste:

- `backend-src/services/orderEvents.service.spec.ts`

Cobre:

- evento enviado apenas para clientes do tenant correto;
- cleanup remove cliente da lista.

## Validacao executada

- `npm run typecheck:strict`: passou.
- `npm run test:api`: passou, 15 arquivos e 70 testes.
- `npm run build`: passou.
- `npm run test:all`: passou.

Observacao: o build manteve apenas o aviso conhecido do Vite sobre chunk maior que 500 kB.

## Validacao de infra

- Nao foram alterados Docker, Caddy, compose, Dockerfile, portas, proxy, envs, URLs, SSL, healthcheck, networks, volumes ou scripts de deploy.
- Nao houve migration nesta fase.
- Banco nao foi resetado.
- Dados reais nao foram apagados.

## Validacao WSL

- Projeto sincronizado para `/home/srv/lucas/lucas_pizarria`.
- Imagens WSL nativas rebuildadas:
  - `lucas_pizarria_api:latest`
  - `pizzaria_web:latest`
- Containers WSL recriados preservando `pizzaria_db` e `pizzaria_waha`.
- `curl -I http://127.0.0.1/`: 200 OK.
- `curl -I http://127.0.0.1/api/status`: 200 OK.
- `resolve-store` para `pizzarialucas.istigestao.com.br`: 200 OK.
- `GET /api/configuracoes`: 200 OK.
- `GET /api/products`: 200 OK.
- Login admin: 200 OK, role `ADMIN`.
- Dashboard admin: 200 OK.
- Despacho: 200 OK.
- Receivables: 200 OK.
- SSE em `GET /api/orders/events`: 200 OK, `Content-Type: text/event-stream`, evento `connected` recebido.
- Banco WSL confirmou colunas `paymentMethod`, `paymentStatus`, `paidAt` em `Order`.

## Pendencias

- Fazer validacao visual/manual no ambiente WSL/produção:
  - abrir Pedidos Live;
  - criar pedido no checkout;
  - confirmar aparicao sem refresh;
  - mudar status;
  - confirmar atualizacao sem refresh;
  - criar pedido no PDV;
  - simular queda do SSE e confirmar polling fallback.
- Criar relatorio final consolidado apos validacao WSL/produção.
