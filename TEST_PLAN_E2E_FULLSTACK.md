# TEST_PLAN_E2E_FULLSTACK

## Objetivo

Auditar o sistema de pizzaria ponta a ponta com foco em frente de loja, carrinho, checkout, pedidos, admin, PDV, Pedidos Live/KDS, produtos, categorias, configuracoes, estoque, fichas tecnicas, orcamentos, contas a receber, equipe/acessos, API, Prisma e Docker.

## Modulos testados

| Modulo | Fluxos criticos | Automacao planejada |
| --- | --- | --- |
| Frente de loja | resolver loja, carregar configuracoes, categorias e produtos | `backend-src/routes/api-smoke.spec.ts`, `scripts/smoke-test.sh` |
| Carrinho | adicionar, alterar quantidade, remover, subtotal sem NaN | E2E browser pendente; logica de total coberta em `tests/e2e/customer-admin-flows.spec.ts` |
| Checkout | entrega, retirada, cupom, fidelidade, pedido criado | `checkoutTotals` e contratos API; E2E browser pendente |
| Pedidos | criar, listar, detalhe, atualizar status | state machine em `tests/e2e/customer-admin-flows.spec.ts`; KDS specs existentes |
| Admin | login, dashboard, menus, telas sem branco | E2E browser pendente |
| PDV | checkout balcao, pedido em Pedidos Live | state machine e testes KDS existentes; API real pendente |
| Pedidos Live/KDS | fila, iniciar preparo, pronto, despacho | `backend-src/routes/kds.routes.spec.ts` |
| Produtos/categorias | listar, criar, editar, desativar | contratos publicos em `api-smoke`; CRUD admin real pendente |
| Configuracoes | loja aberta/fechada, taxas, identidade | contrato publico em `api-smoke`; PUT admin real pendente |
| Estoque/fichas | ingredientes, receitas, baixa | specs existentes de inventory/manufacturing/waste |
| Orcamentos | CRUD e status | API real pendente |
| Contas a receber | baixa parcial/total | API real pendente |
| Equipe/acessos | usuarios, roles, protecao OWNER | API real pendente |
| Docker/infra | frontend, API, resolve-store, sem 502 | `scripts/smoke-test.sh`; validacao Docker manual pendente |

## Endpoints criticos

- `GET /api/status`
- `GET /api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug=`
- `GET /api/configuracoes`
- `PUT /api/configuracoes/loja`
- `GET /api/categorias`
- `POST /api/categorias`
- `GET /api/produtos`
- `GET /api/products`
- `POST /api/produtos`
- `GET /api/pizzas`
- `POST /api/pedidos`
- `GET /api/pedidos`
- `PATCH /api/pedidos/:id/status`
- `POST /api/admin/pos/checkout`
- `GET /api/admin/kds/queue`
- `GET /api/inventory/summary`
- `GET /api/quotes`
- `GET /api/receivables/invoices`
- `GET /api/admin/users`

## Dados de teste seguros

Prefixo obrigatorio: `E2E_TEST_`.

Dados previstos: `E2E_TEST_Categoria`, `E2E_TEST_Pizza`, `E2E_TEST_Cliente`, `E2E_TEST_CUPOM`, `E2E_TEST_Orcamento`, `e2e_test_caixa@example.com`.

## Estrategia de limpeza

- Nunca usar `truncate`, `drop`, reset destrutivo ou seed destrutiva.
- Excluir/desativar apenas registros com prefixo `E2E_TEST_`.
- Preferir testes unitarios/contrato com mocks para CI local.
- Para E2E real em ambiente persistente, executar cleanup final filtrado por tenant atual e prefixo `E2E_TEST_`.

## Riscos

- Ambiente local pode apontar para banco real por `DATABASE_URL`; testes criados aqui nao conectam no banco.
- `test:smoke` depende do site estar rodando em `SMOKE_BASE_URL` ou `http://127.0.0.1`.
- Fluxos admin completos precisam credencial segura de teste e ambiente isolado.
- Docker/rebuild nao foi alterado por regra de seguranca de infra.
