# Relatorio Fase 2 - Perfil Entregador

## Resumo

Fase 2 implementada com o papel oficial `DRIVER`, alinhado ao modelo `Driver` ja existente no Prisma.

O entregador agora existe como perfil administravel em Equipe, tem acesso limitado no frontend/backend e opera apenas o painel de despacho com pedidos vinculados ao seu proprio cadastro de entregador.

## Decisao tecnica

- Papel oficial escolhido: `DRIVER`.
- Motivo: o schema ja possui modelo `Driver`, evitando conflito com `DELIVERY`, que ja representa tipo de atendimento/pedido.

## Banco e migration

Migration segura e aditiva criada:

- `prisma/migrations/20260701193000_driver_admin_link/migration.sql`

Campos adicionados:

- `Driver.adminId String? @unique`
- Relacao opcional `Driver.admin -> Admin`
- Relacao opcional `Admin.driverProfile -> Driver`

Nenhum dado existente e obrigatorio para a migration. Entregadores antigos continuam funcionando.

## Backend

- Criado utilitario oficial de roles em `backend-src/utils/adminRoles.ts`.
- `DRIVER` adicionado como role valida.
- Criacao de usuario com role `DRIVER` cria automaticamente um perfil `Driver` vinculado.
- Alterar usuario para `DRIVER` cria vinculo de entregador se ainda nao existir.
- Alterar usuario `DRIVER` para outro papel remove o vinculo de entregador.
- `requireRole` agora aceita token por cookie ou header `Authorization`, mantendo compatibilidade com as telas atuais.
- Rotas de despacho foram protegidas por role:
  - `OWNER`, `ADMIN`, `MANAGER`: podem listar entregadores, cadastrar/editar entregadores, atribuir pedidos e operar despacho.
  - `DRIVER`: pode listar apenas o proprio perfil e ver apenas pedidos em rota atribuídos ao seu `Driver`.
  - `DRIVER`: pode marcar entrega atribuida como `DELIVERED`.
  - `DRIVER`: nao pode atribuir pedido, criar entregador, editar entregador ou acessar rotas administrativas sensiveis.
- Todas as consultas novas mantem filtro por `tenantId`.

## Frontend

- Tela Equipe agora exibe a opcao `Entregador (Apenas Despacho)`.
- Menu lateral mostra apenas `Despacho` para role `DRIVER`.
- Login de `DRIVER` redireciona diretamente para `/admin/dispatch`.
- Rotas admin agora possuem guard por role no frontend:
  - acesso manual a dashboard, produtos, configuracoes, financeiro, equipe etc. retorna tela de `Acesso negado`.
- Painel de Despacho tem modo entregador:
  - mostra texto de acompanhamento;
  - oculta gerenciamento de motoboys;
  - mostra entregas em rota atribuidas;
  - permite finalizar entrega.

## Matriz final desta fase

- `OWNER`: acesso total administrativo.
- `ADMIN`: acesso administrativo amplo, exceto regras especiais de OWNER.
- `MANAGER`: operacao, estoque, ERP operacional e despacho.
- `CASHIER`: PDV e Pedidos Live.
- `KITCHEN`: Pedidos Live e KDS.
- `DRIVER`: Despacho/entregas atribuidas, finalizacao de entrega.

## Arquivos alterados nesta fase

- `prisma/schema.prisma`
- `prisma/migrations/20260701193000_driver_admin_link/migration.sql`
- `.gitignore`
- `backend-src/utils/adminRoles.ts`
- `backend-src/utils/adminRoles.spec.ts`
- `backend-src/middlewares/requireRole.ts`
- `backend-src/routes/admin.routes.ts`
- `backend-src/routes/dispatch.routes.ts`
- `backend-src/routes/dispatch.routes.spec.ts`
- `frontend-src/App.jsx`
- `frontend-src/pages/admin/AdminLayout.jsx`
- `frontend-src/pages/admin/AdminsPage.jsx`
- `frontend-src/pages/admin/DispatchPage.jsx`
- `frontend-src/pages/admin/LoginPage.jsx`

## Testes realizados

- `npm run prisma:generate`: passou.
- `npm run typecheck:strict`: passou.
- `npm run test:api`: passou, 14 arquivos e 68 testes.
- `npm run build`: passou.
- `npm run test:all`: passou.

Observacao: o build manteve apenas o aviso conhecido do Vite sobre chunk maior que 500 kB.

## Validacao de infra

- Nao foram alterados Docker, Caddy, compose, Dockerfile, portas, proxy, envs, URLs, SSL, healthcheck, networks, volumes ou scripts de deploy.
- As migrations sao aditivas.
- Banco nao foi resetado.
- Dados reais nao foram apagados.

## Pendencias

- Fase 3: Pedidos Live com SSE e fallback por polling.
- Validacao visual em navegador/WSL deve ser feita no fechamento das fases, preservando o cuidado com containers atuais.
