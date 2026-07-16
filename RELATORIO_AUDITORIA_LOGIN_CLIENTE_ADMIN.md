# Relatorio de Auditoria - Login Cliente e Admin

Data: 2026-07-15

## 1. Rotas de login existentes

- `POST /api/login`: login hibrido; procura primeiro um `Admin` e depois um `Customer`.
- `POST /api/register`: cadastro exclusivo de cliente.
- `POST /api/admin/login`: login dedicado de administrador/funcionario.
- `POST /api/admin/setup`: bootstrap do primeiro administrador, bloqueado quando o tenant ja possui admin.
- `GET/PUT /api/account/me` e `GET /api/account/orders`: rotas autenticadas de cliente.

## 2. Login usado por cliente

O modal da loja publica chama `POST /api/login`. O endpoint pode autenticar cliente ou admin. Para cliente, a resposta contem os dados do cliente, `token` e `role: CUSTOMER`.

## 3. Login usado por admin

A pagina `#/admin/login` chama `POST /api/admin/login`. Entretanto, o modal publico tambem permite autenticar um admin porque `/api/login` procura a tabela `Admin` antes de `Customer`.

## 4. Geracao e campos do JWT

Os dois tipos usam `createToken` e o mesmo cookie `token`. O payload atual contem somente `id`, `email` e `role`. Nao contem `type`, `tenantId`, `customerId` ou `userId`, portanto a natureza da identidade e inferida pela role e por consultas posteriores ao banco.

## 5. Identificacao no frontend

- Admin: existencia de `session.admin` ou role presente em `ADMIN_SESSION_ROLES` no objeto `pizzaria-admin`.
- Cliente: qualquer objeto em `pizzaria-customer` que nao seja reconhecido como admin.
- `AdminLayout` verifica apenas se `pizzaria-admin` existe. Nao valida token no servidor.
- `getSavedAdminRole` e `AdminLayout` usam fallback perigoso para `ADMIN` quando a role esta ausente.

## 6. Causa raiz da entrada indevida

Ha tres falhas combinadas:

1. `finishAuth`, executado no login de cliente, nao remove `pizzaria-admin`. Assim, apos uma sessao admin anterior, um cliente pode entrar e a sessao administrativa antiga continua no navegador.
2. `AdminLayout` aceita qualquer JSON presente em `pizzaria-admin` e aplica fallback `ADMIN`, renderizando sidebar/layout antes de validar a identidade com o backend.
3. O endpoint publico `/api/login` mistura identidades e pode devolver sessao admin ao modal de cliente, ampliando a possibilidade de armazenamento/redirecionamento incorreto.

## 7. Guard backend e APIs afetadas

`requireAdmin` consulta a tabela `Admin` por `id`, `email` e `tenantId`; por isso um token real de cliente e recusado. A resposta atual e `403` quando o token e valido mas nao corresponde a admin. Sem token ou token invalido, retorna `401`.

Os routers de POS, receitas, KDS, inventario, fiscal e manufatura possuem `requireAdmin` interno. Integracoes aplica `requireAdmin` no prefixo `/integrations`. Dispatch recebe `requireAdmin` na montagem `/api/admin/dispatch`.

O risco principal confirmado e frontend/sessao residual. Ainda assim, o contrato do JWT e fraco: `requireAdmin` e `requireCustomer` dependem apenas de `role` antes da confirmacao no banco, sem um discriminador criptografado `type`.

## 8. Guard que falhou

- Frontend: `AdminLayout`, `getSavedAdminRole`, `ProtectedAdminRoute` e a limpeza assimetrica de storage.
- Contrato de identidade: ausencia de `type` no JWT e nas respostas de login.
- O backend nao aceitou diretamente um cliente como admin nas rotas auditadas, mas precisa rejeitar explicitamente `type: CUSTOMER` antes de qualquer consulta administrativa.

## 9. Imports, logs e codigo fantasma

- Existe `utils/adminAuth.ts`, um formato HMAC administrativo separado, mas o fluxo ativo usa `utils/auth.ts`; o utilitario aparece como legado e nao participa do login atual.
- Nao foram encontrados logs ativos imprimindo senha ou JWT no fluxo auditado.
- Ha chaves antigas (`pizzaria-admin-token`) usadas pontualmente, enquanto a sessao principal usa `pizzaria-admin`; isso sera documentado e limpo no logout sem refactor amplo.

## 10. Plano seguro de correcao

1. Adicionar `type`, `tenantId`, `customerId`/`userId` ao JWT e respostas.
2. Fazer `requireAdmin` aceitar somente `STAFF` e `requireCustomer` somente `CUSTOMER`, mantendo consulta tenant-safe ao banco.
3. Fazer `requireRole` exigir identidade administrativa ja validada, sem confiar isoladamente na role do token.
4. Impedir que `/api/login` autentique admin; admin usa exclusivamente `/api/admin/login`.
5. Limpar sessao oposta em todo login/logout.
6. Remover fallbacks `ADMIN` e criar gate de sessao administrativa com validacao no backend e loading antes do layout.
7. Criar testes de API e frontend para cliente, admin, token invalido, troca de sessao e storage residual.

