# Relatorio - Orcamentos & Eventos

## Resumo

O modulo de Orcamentos & Eventos foi ajustado para manter apenas um controle visual de status, adicionar editar/excluir, melhorar alinhamento da listagem e reorganizar o modal de detalhes.

## Duplicidade de status

A duplicidade estava em `frontend-src/pages/ERP/Quotes.jsx`:

- `QuoteStatusSelect` exibia um badge de status e tambem um select.
- `QuoteDetailsModal` exibia outro badge "Status: ..." alem do select.
- A lista de status tinha `CANCELLED` e `CANCELED`, ambos com label "Cancelado".

## Status unico mantido

Foi mantido apenas o select de status na listagem e no modal de detalhes.

O frontend exibe labels em portugues e envia valores aceitos pelo backend:

- `PENDING` -> `PENDENTE`
- `DRAFT` -> `RASCUNHO`
- `SENT` -> `ENVIADO`
- `APPROVED` -> `APROVADO`
- `REJECTED` -> `REJEITADO`
- `CANCELED` -> `CANCELADO`
- `EXPIRED` -> `EXPIRADO`
- `CONVERTED` -> `CONVERTIDO`

`CANCELLED` continua aceito no backend por compatibilidade, mas e normalizado para `CANCELED` nas respostas.

## Editar

O modal `NewQuoteModal` foi reaproveitado para criacao e edicao:

- Ao editar, carrega os dados atuais do orcamento.
- Permite alterar cliente, email, telefone, data do evento, validade, observacoes, itens e valor total.
- Salva via `PUT /api/quotes/:id`.
- Atualiza a listagem ao salvar.

## Excluir

Foi adicionado botao Excluir na listagem e no modal de detalhes:

- Pede confirmacao antes de excluir.
- Remove o item da lista apos sucesso.
- Fecha/limpa selecoes relacionadas.
- Bloqueia exclusao fisica de orcamentos `CONVERTED` com resposta `422`.

## Endpoints

Existentes mantidos:

- `GET /api/quotes`
- `POST /api/quotes`
- `PATCH /api/quotes/:id/status`

Criados:

- `GET /api/quotes/:id`
- `PUT /api/quotes/:id`
- `PATCH /api/quotes/:id`
- `DELETE /api/quotes/:id`

Todos usam `tenantId` no backend.

## Arquivos alterados

- `backend-src/controllers/quotes.controller.ts`
- `backend-src/routes/quotes.routes.ts`
- `frontend-src/pages/ERP/Quotes.jsx`
- `frontend-src/pages/ERP/NewQuoteModal.jsx`
- `frontend-src/components/ui/BaseModal.jsx`

## Testes executados

- `git status`
- `git diff --name-only`
- `npm run typecheck:strict`: passou
- `npm run build`: passou
- `npm run build:api`: passou
- `npm run test`: passou
- `npm run`: confirmado que nao existe script `lint`

Observacao: o build frontend manteve apenas o aviso conhecido de bundle acima de 500 kB.

## Smoke test API

Fluxo validado em `http://127.0.0.1/api`:

- Login admin: passou
- Criar orcamento: passou
- Alterar status para `APPROVED`: passou
- Editar dados e itens via `PUT`: passou
- Buscar detalhes por `GET /quotes/:id`: passou
- Excluir por `DELETE`: passou
- Confirmar que saiu da lista: passou
- Bloquear exclusao de `CONVERTED` com `422`: passou
- Limpeza de dados QA: passou, nenhum `QA Orcamento*` restante

## Docker / WSL

Executado:

- `docker build -t lucas_pizarria_api:latest -f Dockerfile.api .`
- `docker compose up -d --build --force-recreate api web`
- `docker compose ps`

Resultado:

- `pizzaria_api`: healthy
- `pizzaria_web`: running na porta `80`
- `pizzaria_db`: healthy
- `pizzaria_waha`: running

Endpoints validados:

- `http://127.0.0.1/`: 200
- `http://127.0.0.1/api/status`: 200
- `http://127.0.0.1/robots.txt`: 200

## Pendencias

Nao ha pendencias bloqueantes identificadas neste escopo.
