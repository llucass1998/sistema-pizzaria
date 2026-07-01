# Relatorio de Correcao - useSwInfo e Carrinho

Data: 2026-07-01

## 1. Onde `useSwInfo` estava sendo usado

Foi pesquisado em `frontend-src`, `tests/e2e` e no build `dist`. Nao existe referencia ativa a `useSwInfo` no codigo fonte do frontend nem no bundle gerado apos o build.

Comandos usados:

- `rg -n "useSwInfo" frontend-src`
- `rg -n "useSwInfo" dist frontend-src --glob "!**/*.map"`

A ocorrencia restante fica apenas no teste de regressao criado para impedir que essa referencia volte.

## 2. Por que quebrava em producao

O erro `ReferenceError: useSwInfo is not defined` vinha de um bundle antigo/minificado de producao. O build atual foi regenerado e validado sem qualquer referencia a `useSwInfo`.

## 3. Correcao aplicada

- Validado que o fonte ativo nao chama `useSwInfo`.
- Criado teste de regressao para falhar se `useSwInfo` voltar em componentes principais.
- Corrigido o carrinho para nao aplicar `aria-hidden={!isOpen}` no proprio container do dialog durante animacao.
- Adicionado controle de foco no carrinho:
  - salva o elemento que abriu o drawer;
  - move foco para o botao de fechar ao abrir;
  - devolve foco ao abridor ao fechar.

## 4. Aria-hidden / foco no carrinho

Arquivo corrigido: `frontend-src/components/ui/CartDrawer.jsx`.

O drawer continua com:

- `role="dialog"`
- `aria-modal="true"`
- `aria-label="Seu Carrinho"`

E deixou de esconder o proprio dialog enquanto algum descendente ainda podia manter foco.

## 5. Arquivos alterados

- `frontend-src/components/ui/CartDrawer.jsx`
- `tests/e2e/frontend-production-guards.spec.ts`
- `RELATORIO_CORRECAO_USESWINFO_CARRINHO.md`

## 6. Testes

- `npm run typecheck:strict`: passou.
- `npm run build`: passou.
- `npm run test`: passou, 9 arquivos e 56 testes.
- `npm run test:e2e`: passou, 3 arquivos e 10 testes.
- `npm run test:api`: passou, 9 arquivos e 56 testes.
- `npm run lint`: nao executado porque nao existe script `lint` no `package.json`.

Teste criado:

- `tests/e2e/frontend-production-guards.spec.ts`
  - garante que componentes principais nao contenham `useSwInfo`;
  - garante que o drawer mantenha `role="dialog"` e `aria-modal="true"`;
  - garante que `aria-hidden={!isOpen}` nao volte ao `CartDrawer`;
  - garante que o foco seja movido/restaurado.

## 7. Build de producao e preview

- `npm run build`: passou e gerou `dist/assets/index-BSOwqHjb.js`.
- Busca no `dist` por `useSwInfo`: sem ocorrencias.
- `npm run preview -- --host 127.0.0.1 --port 4173`: preview respondeu HTTP 200 em `http://127.0.0.1:4173/`.

Observacao: o navegador interno desta sessao nao estava disponivel (`agent.browsers.list()` retornou `[]`), entao a validacao visual interativa foi limitada por ferramenta. A validacao por build, bundle e HTTP foi concluida.

## 8. Docker / WSL2

- `docker compose build api`: passou.
- `docker compose build web`: passou.
- `docker compose up -d --build`: passou.
- `docker compose ps`: `pizzaria_api` healthy, `pizzaria_db` healthy, `pizzaria_web` na porta 80, `pizzaria_waha` running.
- `curl -I http://127.0.0.1/`: HTTP 200.
- `curl -I http://127.0.0.1/api/status`: HTTP 200.
- `curl -i "http://127.0.0.1/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="`: HTTP 200 com loja `Pizzaria Lucas`.

## 9. Infra

Nao foram feitas alteracoes de infra para esta correcao. Nao editei Docker, Caddy, docker-compose, Dockerfiles, portas, proxy, API_URL, baseURL, DATABASE_URL, env, healthcheck, dominio, SSL ou resolve-store.

Observacao: o worktree global ja tinha muitas alteracoes preexistentes, inclusive arquivos de infra. A checagem focada desta tarefa nao mostrou diffs de infra gerados por esta correcao.

## 10. Confirmacoes

- Home nao deve quebrar por `useSwInfo`, pois o fonte e o bundle atual nao possuem essa referencia.
- ErrorBoundary nao deve capturar mais `ReferenceError: useSwInfo is not defined` no bundle novo.
- Carrinho preserva semantica de dialog e gerencia foco ao abrir/fechar.
- Checkout permanece acessivel porque o drawer ainda fecha antes de navegar para `#/checkout`.
