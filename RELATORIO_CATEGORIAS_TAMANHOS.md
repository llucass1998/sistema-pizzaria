# Relatorio - Categorias dinamicas, tamanhos e meia-meia

## Objetivo atendido

O cardapio publico deixou de depender de categorias fixas no frontend e agora usa as categorias cadastradas no ADM/API. Uma categoria ativa criada no admin, como "Pizza Doce", aparece automaticamente na barra publica quando possuir produtos ativos.

Tambem foi adicionada a configuracao por categoria para permitir tamanhos, meia-meia e grupo de compatibilidade, reaproveitando a tabela existente `ProductVariant`.

## Principais alteracoes

- Categorias agora expõem `icon`, `allowSizes`, `allowHalfAndHalf` e `halfAndHalfGroup`.
- Produtos retornam metadados da categoria e variantes para o cardapio publico, admin e PDV.
- Home publica monta a barra e as secoes pelo retorno de `/api/categorias` e `/api/pizzas`.
- Categorias ativas aparecem na barra mesmo quando ainda nao possuem produto cadastrado.
- Clique na categoria faz scroll suave ate a secao correspondente.
- Categoria ativa no menu acompanha a secao visivel.
- Produto em categoria com `allowSizes=true` abre campos de tamanhos no ADM, mesmo que a categoria nao seja `pizzas`.
- PDV tambem usa `allowSizes`, nao mais regra fixa por slug.
- Carrinho publico armazena `variantId`, `variantName`, customizacoes e dados de meia-meia.
- Checkout envia `halfAndHalf` para a API.
- Backend recalcula o preco e aplica a regra de meia-meia pelo maior valor entre as duas metades.
- Pedido salva snapshot da meia-meia em `OrderItem.halfAndHalfData`.
- Queries de variacoes e opcionais foram reforcadas com filtro de `tenantId`.

## Regras de categoria

- `allowSizes=false`: produto funciona com preco unico.
- `allowSizes=true`: produto pode usar variantes/tamanhos.
- `allowHalfAndHalf=true`: produto pode compor meia-meia com outro produto compativel.
- `halfAndHalfGroup`: controla quais categorias/produtos podem misturar entre si.
- Para meia-meia com tamanho, as duas metades precisam usar uma variante compativel pelo mesmo `code`.
- O valor cobrado e sempre o maior valor entre as duas metades, antes dos adicionais.

## Banco de dados

Foi criada a migration:

- `prisma/migrations/20260630021500_category_sizes_half_and_half/migration.sql`

Campos adicionados:

- `MenuCategory.icon`
- `MenuCategory.allowSizes`
- `MenuCategory.allowHalfAndHalf`
- `MenuCategory.halfAndHalfGroup`
- `OrderItem.halfAndHalfData`

A migration tambem marca `pizzas` e `pizzas-especiais` como categorias com tamanhos e meia-meia por padrao.

## Arquivos principais alterados

- `prisma/schema.prisma`
- `backend-src/routes/product.routes.ts`
- `backend-src/routes/order.routes.ts`
- `backend-src/types/order.ts`
- `backend-src/seed.ts`
- `frontend-src/App.jsx`
- `frontend-src/pages/HomePage.jsx`
- `frontend-src/pages/CheckoutPage.jsx`
- `frontend-src/pages/admin/CategoriesPage.jsx`
- `frontend-src/pages/admin/ProductsPage.jsx`
- `frontend-src/pages/admin/POSPage.jsx`
- `frontend-src/components/admin/CategoryModal.jsx`
- `frontend-src/components/admin/ProductModal.jsx`

## Validacoes locais

Comandos executados com sucesso:

- `npx prisma generate`
- `npx prisma validate`
- `npm run typecheck:strict`
- `npm run build:api`
- `npm run build`
- `npm run test`

Observacao: o build frontend concluiu com o aviso conhecido de bundle acima de 500 kB, sem falha de compilacao.

## Validacao em servidor

Status: containers recriados no Docker/WSL.

Comandos de deploy executados:

- `docker build -t lucas_pizarria_api:latest -f Dockerfile.api .`
- `docker compose up -d --build --force-recreate api web`
- `docker compose ps`

Containers apos deploy:

- `pizzaria_api`: healthy
- `pizzaria_web`: running, porta 80 publicada
- `pizzaria_db`: healthy
- `pizzaria_waha`: running

Endpoints locais validados:

- `http://127.0.0.1/`: 200
- `http://127.0.0.1/api/status`: 200
- `http://127.0.0.1/api/categorias`: 200
- `http://127.0.0.1/api/pizzas`: 200
- HTML servido pelo Nginx contem o bundle final `index-DF0WkxNB.js`.

Smoke test de categoria/produto:

- Login admin realizado com sucesso.
- Criada categoria temporaria `QA Pizza Doce Codex` com `allowSizes=true`, `allowHalfAndHalf=true` e `halfAndHalfGroup=qa-pizza-doce`.
- Criados dois produtos temporarios nessa categoria, ambos com 3 variantes.
- Categoria apareceu ativa em `/api/categorias`.
- Produtos apareceram em `/api/pizzas` com variantes.
- Apos o teste, categoria QA foi desativada e produtos QA ficaram indisponiveis.

Observacao sobre URL publica:

- A aplicacao esta funcional em `http://localhost`/porta 80 via Docker.
- Durante a validacao pelo terminal, `https://pizzarialucas.istigestao.com.br/` oscilou e depois passou a recusar conexao na porta 443.
- O DNS resolve para `177.70.8.202`; se a URL publica continuar fora, o ponto a verificar e o proxy/porta externa HTTPS que aponta para este Docker/WSL, nao o container local.

Validacao visual:

- A sessao atual nao tinha navegador integrado disponivel para teste visual interativo.
- Foi executado teste funcional por HTTP/API cobrindo o fluxo critico de categoria dinamica, tamanhos e visibilidade publica.
