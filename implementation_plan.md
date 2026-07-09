# Implementation Plan: FASE 2 — Roles / Níveis de Acesso

## Objetivo

Criar um controle de permissões (RBAC) para o Painel Administrativo, garantindo que perfis diferentes (Caixa, Cozinha, Gerente) acessem apenas os menus pertinentes às suas funções.

## Análise Atual

1. A model `Admin` **não** possui a coluna `role` atualmente. O login apenas assina um token `JWT` genérico e fixa `role: 'ADMIN'` no payload.
2. Nenhuma rota possui um middleware que barre acesso baseado em perfis (existe apenas o `requireAdmin`).
3. O Frontend não esconde telas baseado no `adminData.role`.
4. Não existe uma tela para listar os usuários do painel.

## Proposed Changes

### [MODIFY] schema.prisma & Banco de Dados

- Adicionar o campo `role String @default("ADMIN")` na model `Admin`.
- **NÃO será feito wipe (reset) de banco**. Executarei um `npx prisma db push --accept-data-loss` (que só afeta a estrutura, sem dropar a tabela principal se os dados forem compatíveis) para propagar as mudanças locais para o PostgreSQL sem apagar dados atuais. Se houver falha, gerarei uma migration formal.

### [NEW] backend-src/middlewares/requireRole.ts

- Criar o middleware `requireRole(allowedRoles: string[])`.
- Retorna HTTP 403 se o `req.admin.role` não estiver na lista.

### [MODIFY] backend-src/routes/admin.routes.ts

- Injetar o campo `role` na geração do Token JWT e retorno do Payload.
- Adicionar endpoints simples:
  - `GET /admin/users` (lista administradores do sistema).
  - `POST /admin/users` (cria administradores com role específica).
  - `PATCH /admin/users/:id/role` (altera a role de um administrador).

### [MODIFY] backend-src/routes/*.ts

- Aplicar o middleware `requireRole(['OWNER', 'ADMIN', 'MANAGER'])` nas rotas financeiras, de relatórios, ERP e configurações.
- Rotas de pedidos (`order.routes.ts`) ficarão liberadas para `CASHIER` e `KITCHEN`.
- Rotas de POS (`pos.routes.ts`) liberadas para `CASHIER`.

### [MODIFY] frontend-src/pages/admin/AdminLayout.jsx

- Capturar a `role` do `adminData`.
- Modificar o array `navItems` condicionalmente:
  - CASHIER vê apenas: `PDV`, `Pedidos Live`.
  - KITCHEN vê apenas: `Pedidos Live`.
  - MANAGER vê tudo exceto configurações críticas/financeiras.
  - ADMIN/OWNER vê tudo.
- Adicionar o atalho para a nova rota `Usuários (Equipe)`.
- Fazer redirect (Navigate) caso um Caixa tente acessar o link de financeiro via barra de endereço.

### [NEW] frontend-src/pages/admin/AdminsPage.jsx

- Tela simples para listar a equipe, visualizar as roles e adicionar/editar um usuário do painel.

## User Review Required

> [!IMPORTANT]
> Vou criar o campo `role` como String (para facilitar evoluções futuras sem mexer na estrutura do Postgres) e aplicar um `prisma db push`. Isso não apagará os dados se a tabela existir. Você aprova essa estratégia para atualizar o banco sem migrations rigorosas?

> [!TIP]
> Os atuais usuários que foram criados no setup continuarão com a role `ADMIN`, garantindo que não percam acesso.

## Verification Plan

1. `npm run typecheck:strict`
2. Restart dos containers via Docker.
3. Testes manuais:
   - Login no painel usando um usuário Admin e criação de um usuário "Caixa".
   - Logout e Login com o "Caixa".
   - Verificar se as rotas de Dashboard e Configurações somem do menu.
   - Testar o bloqueio HTTP 403 ao forçar um curl ou acesso direto via URL para configurações.
