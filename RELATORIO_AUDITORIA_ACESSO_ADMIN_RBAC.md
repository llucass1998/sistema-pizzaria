# Relatorio de Auditoria - Acesso Admin/RBAC

Data: 2026-07-07

## 1. Conta principal

- Email auditado: `admin@riopizzas.com`
- Estado encontrado no banco:
  - Tenant principal do dominio: `37c646b4-b2ac-4356-9a29-de14dfa7afa7`
  - Tenant: `Pizzaria Lucas`
  - Slug: `pizzaria-lucas`
  - Dominio: `pizzarialucas.istigestao.com.br`
  - Role: `OWNER`
  - Tenant ativo: `true`
- Tambem existe uma segunda conta com o mesmo email no tenant `demo`, tambem como `OWNER`. O login pelo dominio/tenant principal resolve corretamente para o tenant do dominio.

## 2. Permissoes atuais

- `OWNER` e tratado como papel maximo dentro da loja.
- `SUPER_ADMIN` continua sendo bypass global em `requireRole`, quando existir.
- `ADMIN` e `MANAGER` mantem acesso amplo, mas nao necessariamente a gestao de equipe/configuracoes criticas.
- `CASHIER`, `KITCHEN`, `DRIVER` e `INTEGRATION_MANAGER` continuam restritos pela matriz de roles no frontend e backend.

## 3. Modulos verificados

Modulos reais testados com login de `admin@riopizzas.com`:

- Dashboard
- Pedidos Live
- KDS
- Despacho/Motoboys
- Clientes/CRM
- Estoque
- Fiscal/NFC-e
- iFood/Integracoes
- Usuarios/Permissoes
- Configuracoes
- Financeiro
- Compras
- Fornecedores
- Contas a pagar/receber

## 4. Rotas frontend bloqueadas

Nao foi encontrado bloqueio indevido para `OWNER` nas rotas principais do Admin. As telas abriram sem "Acesso negado" no teste Playwright.

## 5. Rotas backend bloqueadas

Antes da correcao, as rotas reais principais respondiam para `OWNER`, mas alguns aliases esperados retornavam 404:

- `/api/admin/orders`
- `/api/admin/integrations`
- `/api/admin/integrations/ifood`
- `/api/admin/customers`
- `/api/admin/crm`
- `/api/admin/nfce`
- `/api/admin/settings`
- `/api/admin/store-settings`
- `/api/admin/permissions`
- `/api/admin/dashboard`

Nao foram encontrados 401/403 indevidos nos endpoints reais para a conta `OWNER`.

## 6. Endpoints com 401/403/500

- 401 sem token: comportamento correto.
- 403 com token de cliente/forjado: comportamento correto.
- 500 por import/service quebrado: nao encontrado nos endpoints auditados.

## 7. Imports e codigo fantasma

- Nao foi encontrado import quebrado nos arquivos alterados.
- `npx eslint .` varre artefatos fora do fonte (`.chrome-test`, `generated`, `out.js`, `temp.js`) e falha por problemas historicos desses arquivos.
- `npx eslint frontend-src/pages/admin/AdminLayout.jsx` ficou sem erros/avisos especificos apos limpeza.

## 8. Achados principais

1. Login hibrido em `/api/login` autenticava admin, mas gravava token com role fixa `ADMIN`, ignorando a role real do banco.
2. `requireRole` sempre lia a role do token, mesmo quando `requireAdmin` ja tinha carregado a role atual do banco.
3. Rotas de integracao usavam `requireRole`, mas nao passavam por `requireAdmin`, deixando a validacao mais fraca que as outras rotas admin.
4. Rotas fiscais usavam `requireRole`, mas nao passavam internamente por `requireAdmin` quando acessadas por `/api/fiscal`.
5. Grupos da sidebar nao tinham `type="button"` e nao faziam `preventDefault/stopPropagation`, o que podia causar comportamento de navegacao/scroll em cenarios de remount/evento.
6. Alguns aliases `/api/admin/*` esperados por testes/agentes nao existiam, embora endpoints equivalentes existissem com outro nome.

## 9. Plano seguro de correcao

- Preservar banco, tenants, usuarios e infra.
- Corrigir token para usar role real.
- Fazer `requireRole` preferir role carregada do banco.
- Proteger iFood e fiscal com `requireAdmin`.
- Adicionar aliases admin sem duplicar regra de negocio.
- Corrigir accordion da sidebar com botoes puros.
- Validar com typecheck, build, Vitest, Playwright, Docker e curls.
