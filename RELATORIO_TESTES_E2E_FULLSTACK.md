# RELATORIO_TESTES_E2E_FULLSTACK

## Resumo

Auditoria inicial executada sem manter alteracao de infraestrutura protegida. Foram adicionados testes automatizados de contrato API e E2E logico via Vitest, mais smoke script para ambiente local/Docker. Nenhuma migration, seed destrutiva, alteracao de Docker, Caddy, portas, proxy, `DATABASE_URL` ou `API_URL` foi mantida nesta etapa.

## Testes automatizados criados

- `backend-src/routes/api-smoke.spec.ts`
- `tests/e2e/customer-admin-flows.spec.ts`
- `vitest.e2e.config.ts`
- `scripts/smoke-test.sh`

## Backend/API

Coberto:

- `GET /api/status`
- `GET /api/public/resolve-store`
- `GET /api/configuracoes`
- `GET /api/categorias`
- `GET /api/produtos`
- `GET /api/products`
- Bloqueio de `POST /api/categorias` sem token admin
- Validacao de filtros tenant-scoped em listagens publicas

## E2E cliente

Coberto de forma automatizada sem browser:

- Total de checkout finito e nunca negativo
- Fluxo de status `DELIVERY`: `PENDING -> PREPARING -> OUT_FOR_DELIVERY -> DELIVERED`
- Bloqueio de salto indevido `PREPARING -> DELIVERED`

Pendente: execucao real de browser para adicionar item ao carrinho, checkout entrega, checkout retirada e loja fechada.

## E2E admin, PDV e Pedidos Live

Coberto:

- State machine de pickup usada por PDV e pedidos live
- Specs existentes de KDS/Pedidos Live continuam passando

Pendente: login admin real, dashboard, CRUD visual, PDV browser e persistencia em banco real de teste.

## Financeiro, configuracoes, estoque e equipe

Coberto parcialmente por specs existentes e novo contrato de configuracoes publicas.

Pendente: baixa parcial/total, orcamentos completos, equipe/acessos e protecao OWNER em teste de API real isolado.

## Bugs encontrados

- `/api/products` retorna 401 via proxy Nginx local, embora `/api/produtos`, `/api/pizzas` e `/api/products` direto no container API respondam 200.
- Pendencias documentadas: fluxos E2E de browser e testes que exigem credenciais/banco isolado.

## Bugs corrigidos

- Adicionado alias publico `GET /api/products` e `GET /api/products/:id` no backend. O alias passa nos testes de API e direto no container API, mas ainda falha via proxy Nginx local.

## Arquivos alterados

- `package.json`
- `vitest.e2e.config.ts`
- `backend-src/routes/api-smoke.spec.ts`
- `tests/e2e/customer-admin-flows.spec.ts`
- `scripts/smoke-test.sh`
- `backend-src/routes/product.routes.ts`
- `backend-src/app.ts`
- `TEST_PLAN_E2E_FULLSTACK.md`
- `TEST_COVERAGE_MAP.md`
- `RELATORIO_TESTES_E2E_FULLSTACK.md`

## Scripts criados/ajustados

- `npm run test:api`
- `npm run test:smoke`
- `npm run test:all`
- `npm run test:e2e` agora possui `vitest.e2e.config.ts`

## Resultados

- `npm run test`: passou antes das alteracoes novas.
- `npm run typecheck:strict`: passou antes das alteracoes novas.
- Resultados finais apos as novas alteracoes devem ser consultados na saida da execucao desta tarefa.

## Docker e curls

Foi executado `docker compose up -d --build` para validar os containers locais. Foi criado `scripts/smoke-test.sh` para validar:

- frontend local 200
- `/api/status`
- `/api/public/resolve-store`
- `/api/configuracoes`
- `/api/categorias`
- `/api/pizzas`
- `/api/products`

Resultado observado: todos passaram exceto `/api/products` via proxy local, que retornou 401. Os containers permaneceram ativos e a API ficou healthy.

## 502 e disponibilidade

Nenhuma alteracao de infraestrutura foi mantida. O script de smoke retorna exit 1 caso qualquer endpoint critico falhe, incluindo cenarios de 502. No estado atual, ele falha em `/api/products` via proxy local; nao houve erro 502 nos endpoints testados.
