# Relatorio Fase 2 - Checkout Real em Producao

Data: 2026-07-01

## Objetivo

Validar o checkout completo em uso real: entrega, retirada, PIX, dinheiro, cartao, taxa de entrega, bairro atendido/nao atendido, loja aberta/fechada, WhatsApp e criacao de pedido no backend/admin.

## Correcao Aplicada

- Atualizado `backend-src/routes/order.routes.ts`.
- A rota `POST /api/pedidos` agora bloqueia pedido quando `StoreSetting.isOpen = false`.
- Resposta de loja fechada:
  - HTTP 423
  - `A loja esta fechada no momento. Volte durante o horario de atendimento para fazer seu pedido.`
- Criado teste `backend-src/routes/order-checkout.spec.ts` para garantir que a API bloqueia pedido mesmo com cliente autenticado.

## Fluxos Validados

- Tenant correto: `32e1122e-d24c-4273-992a-42bf4ce26b8a`.
- Loja: `Rio de Janeiro Pizzas`.
- PIX real: `contato@riopizzas.com.br`.
- Produto usado nos testes: `E2E_TEST Pizza`.
- Retirada + PIX: pedido criado.
- Entrega + dinheiro: pedido criado.
- Retirada + debito: pedido criado.
- Entrega + credito: pedido criado.
- Todos os pedidos criados apareceram no endpoint admin `/api/pedidos`.
- Retirada sem endereco: pedido criado com sucesso.
- Entrega sem endereco: HTTP 400.
- Bairro atendido em modo temporario `NEIGHBORHOOD`: `Centro` disponivel com taxa calculada.
- Bairro nao atendido em modo temporario `NEIGHBORHOOD`: retorno indisponivel.
- Configuracao de entrega foi restaurada para `FIXED` com taxa `5`.
- Loja fechada: pedido bloqueado com HTTP 423.
- Loja reaberta apos teste: `isOpen=true`.

## Validacao de UI

Playwright executado contra Vite local e API WSL:

- Home -> carrinho -> checkout PIX.
- Entrega + cartao de credito.
- Retirada + dinheiro sem troco.

Resultado: 3 testes passaram.

## Validacao Automatizada

- `npm run test:all`: passou.
- Typecheck strict: passou.
- Testes API: 11 arquivos, 61 testes passaram.
- Testes E2E/Vitest: 4 arquivos, 13 testes passaram.
- Build Vite: passou.
- Aviso restante: bundle Vite maior que 500 kB, pendente para Fase 9.

## Validacao WSL

- API WSL reconstruida com a correcao.
- Containers ativos:
  - `pizzaria_api`
  - `pizzaria_web`
  - `pizzaria_db`
  - `pizzaria_waha`
- Endpoints usados na validacao:
  - `/api/status`
  - `/api/public/resolve-store`
  - `/api/configuracoes`
  - `/api/products`
  - `/api/categorias`
  - `/api/register`
  - `/api/pedidos`
  - `/api/admin/login`

## Infra

- Nao houve alteracao em Docker, Caddy, compose, portas, proxy, envs, dominio, SSL, healthcheck, networks, volumes ou `update.sh`.
- Foi necessario reconstruir e recriar apenas o container `pizzaria_api` no WSL para aplicar o backend atualizado.

## Pendencias Identificadas

- O modelo `Order` ainda nao possui campo dedicado `paymentMethod`; hoje o metodo fica nas observacoes do pedido e `paymentProvider/paymentUrl` cobre gateway online. Recomendada evolucao em fase futura para relatorio financeiro/admin.
- WhatsApp foi validado por composicao de fluxo e abertura de UI coberta nos testes, mas envio real via WAHA deve ser validado junto da Fase 3/Pedidos Live e ambiente de WhatsApp.
- Gateway online nao esta configurado; por isso cartao online nao deve aparecer no checkout. O fluxo validado foi maquininha/pagar na hora.

## Resultado

Fase 2 concluida para os fluxos essenciais de checkout: entrega, retirada, PIX, dinheiro, debito, credito, taxa de entrega, bairro atendido/nao atendido, loja fechada e criacao/listagem de pedidos.
