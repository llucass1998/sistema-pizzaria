# 🕵️‍♂️ Relatório de Auditoria: Conta Admin (`admin@riopizzas.com`)

**Data:** 04/07/2026  
**Objetivo:** Identificar o estado atual da conta `admin@riopizzas.com`, bloqueios de acesso e conflitos de Tenant no sistema Multi-Loja.

---

## 1. Usuários Encontrados (Conflito de E-mail)

Durante a consulta ao banco de dados (`PostgreSQL`), descobrimos que o e-mail `admin@riopizzas.com` **não é único**. Existem **DUAS** contas vinculadas a este mesmo e-mail, cada uma em um `Tenant` (loja) diferente:

| ID            | E-mail                | Role          | Nome do Tenant            | Tenant ID (Resumo) | Domínio Vinculado                 |
| :------------ | :-------------------- | :------------ | :------------------------ | :----------------- | :-------------------------------- |
| `4b0e5edc...` | `admin@riopizzas.com` | `SUPER_ADMIN` | Pizzaria Matriz (Default) | `f0cf1e54...`      | Nenhum (slug: `demo`)             |
| `ca3e87dd...` | `admin@riopizzas.com` | `SUPER_ADMIN` | Pizzaria Lucas            | `37c646b4...`      | `pizzarialucas.istigestao.com.br` |

### ⚠️ Causa Provável dos Bloqueios:

Como o login provavemente busca o usuário usando `findFirst({ where: { email } })`, a API pode estar retornando a primeira conta (a do Tenant "Pizzaria Matriz"). Ao entrar no admin, o `tenantId` injetado no token JWT é o da Matriz, mas o front-end está rodando no domínio `pizzarialucas.istigestao.com.br` (Pizzaria Lucas).
Isso causa **incompatibilidade de Tenant**, fazendo com que o middleware RBAC e o Tenant Guard bloqueiem rotas ou não encontrem os dados da loja certa, resultando em "Acesso Negado" ou telas vazias/quebradas.

---

## 2. Status Atual da Conta "Pizzaria Lucas"

Analisando a conta correta (`ca3e87dd-6b61-439e-a8ac-38d259248ebe`), vinculada ao domínio `pizzarialucas.istigestao.com.br`:

- **Role Atual:** `SUPER_ADMIN` (Acesso Máximo no enum Prisma).
- **Tenant:** Pizzaria Lucas (`37c646b4-b2ac-4356-9a29-de14dfa7afa7`).
- **Status:** Ativo.
- **Bloqueios de Banco:** Não há flags de bloqueio.

---

## 3. Próximos Passos (Plano de Ação)

1. **Resolver a Duplicidade:** Alterar o e-mail da conta do tenant "demo" (ex: `admin_demo@riopizzas.com`) para evitar que o Prisma pegue a conta errada no momento do login.
2. **Revisar Middlewares:** Garantir que o `requireRole` no back-end aceite `SUPER_ADMIN` e `OWNER` para **todas** as rotas administrativas solicitadas (Dashboard, Estoque, Financeiro, Integrações, etc.).
3. **Validar Front-End:** Revisar os `Guards` e o `<AdminLayout />` para garantir que `SUPER_ADMIN` tenha renderização completa da Sidebar, sem ocultar menus essenciais.
4. **Testes Completos:** Logar com `admin@riopizzas.com`, validar o JWT gerado (deve apontar para a Pizzaria Lucas) e navegar ponta-a-ponta.
