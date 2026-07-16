# Relatório de correção — login Cliente x Admin e RBAC

Data: 15/07/2026  
Status: **corrigido, testado e publicado no Docker/WSL**

## 1. Resumo executivo

Foi eliminada a possibilidade de uma sessão de cliente reutilizar estado administrativo antigo no navegador. A API agora distingue criptograficamente e valida no banco as identidades `CUSTOMER` e `STAFF`; o frontend só renderiza o painel depois de confirmar a sessão em `/api/admin/session`.

O administrador `admin@riopizzas.com` foi validado com sucesso como `OWNER`. O login público `/api/login` não aceita mais credenciais administrativas; administradores entram exclusivamente por `/api/admin/login`.

## 2. Causa raiz

1. O frontend aceitava qualquer objeto existente em `pizzaria-admin` e aplicava `ADMIN` como perfil padrão.
2. Ao entrar como cliente, a sessão administrativa anterior não era apagada.
3. O layout administrativo podia aparecer antes de uma validação da sessão no servidor.
4. O JWT antigo não identificava explicitamente a natureza da identidade e um middleware de papel aceitava o papel decodificado como fallback.
5. O endpoint público de login pesquisava primeiro administradores e depois clientes, misturando os dois domínios de autenticação.

## 3. Correções aplicadas

- JWT obrigatório com `sub`, `tenantId`, `type`, e identificador exclusivo `customerId` ou `userId`.
- `requireAdmin`: exige `type=STAFF`, rejeita identidade de cliente, valida tenant e confirma o administrador no banco.
- `requireCustomer`: exige `type=CUSTOMER`, papel `CUSTOMER`, valida tenant e confirma o cliente no banco.
- `requireRole`: depende do `requireAdmin` e não confia mais em papel isolado vindo do token.
- `/api/login`: autentica somente clientes.
- `/api/admin/login`: autentica somente equipe administrativa.
- `/api/admin/session`: nova confirmação server-side da sessão administrativa.
- `AdminSessionGate`: não renderiza layout, menu ou conteúdo administrativo antes da confirmação do servidor.
- Removidos o fallback de papel `ADMIN` e a senha administrativa preenchida por padrão.
- Login/logout de cliente e admin apagam explicitamente estados incompatíveis e chaves legadas.
- Tokens antigos são invalidados por desenho; é necessário entrar novamente.

## 4. Matriz de autorização validada

| Cenário | Resultado |
|---|---:|
| Sem token → `/api/admin/dashboard` | 401 |
| Cliente → `/api/admin/dashboard` | 403 |
| Admin OWNER → `/api/admin/dashboard` | 200 |
| Cliente → `/api/account/me` | 200 |
| Admin → `/api/account/me` | 403 |
| Admin → `/api/admin/session` | 200 |
| Admin em `/api/login` público | 401 |
| Admin em `/api/admin/login` | 200, `STAFF/OWNER` |
| Identidade de outro tenant | 403 |

O cliente temporário criado para o teste publicado foi removido ao final.

## 5. Testes e evidências

- TypeScript estrito: aprovado.
- Testes completos Vitest: **32 arquivos, 169 testes aprovados**.
- Testes de API: **31 arquivos, 167 testes aprovados**.
- Playwright E2E local: **1/1 aprovado**.
- Build frontend e backend: aprovados.
- Smoke pós-publicação: aprovado, sem 502 nos endpoints críticos.
- API local `/api/status`: 200.
- Site público: 200.
- API pública `/api/status`: 200.
- API do container: `healthy`.
- Frontend recriado com a imagem nova e exposto nas portas 80/8080.

O navegador integrado não estava disponível na sessão (lista de navegadores vazia). A cobertura visual/fluxo foi executada pelo Playwright E2E e complementada pelos testes reais da API já publicada.

## 6. WSL, VPN e disponibilidade

- Serviço `openvpn@client.service`: **active**.
- Interface `tun0`: **172.25.20.159/24**.
- Tarefa persistente `Pizzaria-WSL-VPN-KeepAlive`: configurada e em estado `Ready`.
- Site `https://pizzarialucas.istigestao.com.br`: HTTP 200 após a publicação.
- Nenhuma configuração de Caddy, domínio, porta, banco ou infraestrutura foi alterada nesta correção.

## 7. Arquivos centrais alterados

- `backend-src/utils/auth.ts`
- `backend-src/middlewares/requireAdmin.ts`
- `backend-src/middlewares/requireCustomer.ts`
- `backend-src/middlewares/requireRole.ts`
- `backend-src/routes/admin.routes.ts`
- `backend-src/routes/customer.routes.ts`
- `backend-src/routes/saas.routes.ts`
- `frontend-src/App.jsx`
- `frontend-src/pages/admin/LoginPage.jsx`
- `frontend-src/pages/admin/AdminLayout.jsx`
- testes de identidade/autenticação correspondentes

## 8. Conclusão

O isolamento é aplicado em duas camadas: a interface não monta o painel sem uma sessão administrativa confirmada, e a API rejeita tokens de cliente em todas as rotas protegidas de admin. A correção está ativa no Docker/WSL e o tráfego público pela VPN está operacional, sem 502.
