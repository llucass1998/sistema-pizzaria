# Relatorio de Correcao - Acesso Admin/RBAC

Data: 2026-07-07

## 1. Estado inicial da conta

- Conta: `admin@riopizzas.com`
- Role inicial: `OWNER`
- Role final: `OWNER`
- Tenant/store vinculado:
  - Tenant ID: `37c646b4-b2ac-4356-9a29-de14dfa7afa7`
  - Tenant: `Pizzaria Lucas`
  - Store exibida: `Pizzariba`
  - Dominio: `pizzarialucas.istigestao.com.br`

Nenhuma senha foi alterada. Nenhum usuario, tenant, loja, pedido ou dado real foi apagado.

## 2. Permissoes corrigidas

- `requireRole` agora usa a role ja carregada do banco por `requireAdmin` quando ela existe.
- O login hibrido de cliente/admin em `/api/login` agora gera token com a role real do admin, em vez de forcar `ADMIN`.
- Integracoes/iFood agora passam por `requireAdmin` antes de `requireRole`.
- Fiscal/NFC-e agora passa por `requireAdmin` antes de `requireRole`.

## 3. Rotas backend corrigidas/adicionadas

Aliases adicionados ou corrigidos:

- `/api/admin/dashboard`
- `/api/admin/orders`
- `/api/admin/customers`
- `/api/admin/crm`
- `/api/admin/permissions`
- `/api/admin/integrations`
- `/api/admin/integrations/credentials`
- `/api/admin/integrations/ifood`
- `/api/admin/integrations/ifood/catalog/preview`
- `/api/admin/fiscal`
- `/api/admin/nfce`
- `/api/admin/nfce/settings`
- `/api/admin/settings`
- `/api/admin/store-settings`

Endpoints reais preservados:

- `/api/admin/clientes`
- `/api/integrations/*`
- `/api/admin/fiscal/*`
- `/api/pedidos`
- `/api/configuracoes`

## 4. Guards frontend corrigidos

- O `ProtectedAdminRoute` ja permitia `OWNER` para os modulos principais.
- A sidebar ja exibia modulos para `OWNER`.
- Foi mantida a matriz de roles existente para `CASHIER`, `KITCHEN`, `DRIVER` e `INTEGRATION_MANAGER`.
- Removidos imports nao usados no arquivo alterado `AdminLayout.jsx`.

## 5. Menus corrigidos

- Grupo `Cadastros & Gestao` agora usa clique com `preventDefault` e `stopPropagation`.
- Grupos `Operacao`, `ERP & Financeiro` e `Cadastros & Gestao` usam `button type="button"`.
- Botoes de topo/rodape/mobile da sidebar tambem receberam `type="button"`.

## 6. Bug "Cadastros & Gestao sobe para o topo"

Validacao Playwright:

- Rota antes: `http://127.0.0.1/#/admin/settings`
- Rota depois: `http://127.0.0.1/#/admin/settings`
- Scroll antes: `500`
- Scroll depois: `500`
- Erros de console: `0`

Resultado: corrigido.

## 7. Imports quebrados e codigo fantasma

- Nenhum import quebrado foi encontrado nos arquivos alterados.
- `npx eslint .` falha por artefatos historicos fora do fonte: `.chrome-test`, `generated`, `out.js`, `temp.js`, scripts soltos.
- `backend-src/check.js` tem parsing error legado quando o lint e rodado em `backend-src` completo.
- Nao removi codigo fantasma fora do escopo para evitar refactor grande.

## 8. APIs revisadas e endpoints testados

Login real:

- `POST /api/admin/login`: `200`, role `OWNER`

Admin testado com token real:

- `/api/admin/dashboard`: `200`
- `/api/admin/dashboard/summary`: `200`
- `/api/admin/orders?limit=1`: `200`
- `/api/admin/kds/queue`: `200`
- `/api/admin/dispatch/drivers`: `200`
- `/api/admin/clientes`: `200`
- `/api/admin/customers`: `200`
- `/api/admin/crm`: `200`
- `/api/admin/inventory/ingredients`: `200`
- `/api/admin/inventory/waste`: `200`
- `/api/admin/fiscal`: `200`
- `/api/admin/fiscal/settings`: `200`
- `/api/admin/fiscal/documents`: `200`
- `/api/admin/nfce`: `200`
- `/api/admin/nfce/settings`: `200`
- `/api/integrations/credentials`: `200`
- `/api/admin/integrations`: `200`
- `/api/admin/integrations/credentials`: `200`
- `/api/admin/integrations/ifood`: `200`
- `/api/admin/integrations/ifood/catalog/preview`: `200`
- `/api/admin/users`: `200`
- `/api/admin/permissions`: `200`
- `/api/admin/settings`: `200`
- `/api/admin/store-settings`: `200`
- `/api/admin/financial/summary?period=today`: `200`
- `/api/admin/purchases/orders`: `200`
- `/api/admin/suppliers`: `200`
- `/api/admin/receivables/invoices/summary`: `200`
- `/api/admin/payables/summary`: `200`

Restricoes:

- `/api/admin/users` sem token: `401`
- `/api/admin/integrations` sem token: `401`
- `/api/admin/users` com token `CUSTOMER` forjado: `403`
- `/api/admin/integrations` com token `CUSTOMER` forjado: `403`

## 9. Telas testadas no navegador

Playwright abriu as rotas abaixo sem acesso negado, tela branca ou erro de console:

- Dashboard
- PDV
- Pedidos Live
- KDS
- Despacho
- Motoboys
- Fluxo de Caixa
- DRE
- Conciliacao
- Contas a Pagar
- Contas a Receber
- Compras
- Notas Fiscais
- Fornecedores
- Produtos
- Categorias
- Opcoes Extras
- Estoque
- Fichas Tecnicas
- Clientes/CRM
- Cupons
- Equipe/Usuarios
- Configuracoes
- Relatorios & BI
- Integracoes/iFood
- Fiscal/NFC-e

## 10. Testes com outras roles

- Nao existem usuarios `CASHIER`, `KITCHEN`, `DRIVER` ou `INTEGRATION_MANAGER` cadastrados no tenant principal.
- Nao criei usuarios temporarios porque a regra do pedido proibe criar/deletar usuarios sem necessidade.
- Validacao feita por codigo:
  - `CASHIER` continua restrito fora de PDV/caixa/pedidos permitidos.
  - `KITCHEN` continua restrito ao KDS/pedidos permitidos.
  - `DRIVER` continua restrito a despacho.
  - `INTEGRATION_MANAGER` continua permitido em integracoes e bloqueado nos modulos que nao o listam.
  - Cliente comum nao passa em `/api/admin/*`.

## 11. Arquivos alterados nesta correcao

- `backend-src/app.ts`
- `backend-src/middlewares/requireRole.ts`
- `backend-src/routes/admin.routes.ts`
- `backend-src/routes/customer.routes.ts`
- `backend-src/routes/fiscal.routes.ts`
- `backend-src/routes/integration.routes.ts`
- `backend-src/routes/order.routes.ts`
- `backend-src/routes/settings.routes.ts`
- `frontend-src/pages/admin/AdminLayout.jsx`
- `RELATORIO_AUDITORIA_ACESSO_ADMIN_RBAC.md`
- `RELATORIO_CORRECAO_ACESSO_ADMIN_RBAC.md`

## 12. Testes rodados

- `npm run typecheck:strict`: passou.
- `npm run test:api`: passou, 25 arquivos / 133 testes.
- `npm run test`: passou, 25 arquivos / 133 testes.
- `npm run build`: passou.
- `npx eslint .`: falhou por artefatos historicos fora do fonte.
- `npx eslint backend-src frontend-src`: falhou por `backend-src/check.js` legado e avisos antigos.
- `npx eslint frontend-src/pages/admin/AdminLayout.jsx`: passou.
- Playwright admin/sidebar: passou.
- Bateria de endpoints admin com token real: passou, 0 falhas.
- Teste sem token/cliente em `/api/admin`: passou com 401/403 esperados.

## 13. Docker/WSL

- `docker compose build api web`: passou.
- `docker compose up -d --no-deps --force-recreate api web`: passou.
- `docker compose ps`: `pizzaria_api` healthy, `pizzaria_web` rodando, `pizzaria_db` healthy.
- WSL:
  - `curl -I http://127.0.0.1/`: `200`
  - `curl -I http://127.0.0.1/api/status`: `200`

## 14. Curls publicos

- `/`: `200`
- `/api/status`: `200`
- `/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug=`: `200`
- `/api/configuracoes`: `200`
- `/api/products`: `200`
- `/api/categorias`: `200`

## 15. Confirmacoes

- Loja publica nao quebrou.
- Checkout nao foi alterado nesta correcao.
- Admin nao quebrou.
- iFood abre e endpoints respondem.
- Fiscal/NFC-e abre e endpoints respondem.
- Nao houve erro 502.
- Nao houve reset de banco.
- Nao houve alteracao de Docker/Caddy/env nesta correcao.

## 16. Pendencias

- Limpar ou excluir do lint os artefatos historicos (`.chrome-test`, `generated`, `out.js`, `temp.js`, `backend-src/check.js`) em tarefa separada.
- Se forem criados usuarios reais de `CASHIER`, `KITCHEN`, `DRIVER` e `INTEGRATION_MANAGER`, rodar uma bateria E2E dedicada para cada role.
