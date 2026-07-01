# Relatorio de seguranca - plano de teste E2E fullstack

Data: 2026-07-01

## Estado atual do sistema

- Pasta analisada: `C:\Users\lluca\Documents\Codex\2026-06-26\b\outputs\pizzaria`.
- `package.json` possui scripts de build, typecheck, Vitest API/E2E, smoke e test:all.
- `git status --short` e `git diff --name-only` foram executados antes de alteracoes funcionais.
- Resultado: o comando Git retornou `fatal: not a git repository`, portanto este diretório nao esta sendo reconhecido como repositorio Git nesta sessao. A estrategia de seguranca sera registrar os arquivos tocados e evitar qualquer alteracao fora do escopo.
- Containers Docker existentes devem ser preservados; nao apagar banco, volumes ou dados reais.

## Arquivos que serao analisados

- `package.json`, `vitest.config.ts`, `vitest.e2e.config.ts`.
- `frontend-src/**`, com foco em home publica, cardapio, produto, carrinho, checkout, admin, PDV, financeiro e configuracoes.
- `backend-src/**`, com foco em rotas publicas, rotas admin, autenticacao, pedidos, pagamentos, delivery, PDV e financeiro.
- `prisma/**`, somente leitura salvo necessidade comprovada de ajuste nao destrutivo.
- `tests/**`, para cobertura automatizada existente e novos testes.
- `scripts/**`, para smoke test fullstack.

## Arquivos proibidos de alteracao sem necessidade comprovada

- `Dockerfile.api`
- `Dockerfile.web`
- `docker-compose.yml`
- `Caddyfile`
- `nginx.conf`
- `.env`
- `.env.example`
- Arquivos de porta, proxy, `API_URL`, `baseURL`, `DATABASE_URL`, dominio, SSL, healthcheck, networks, volumes e `resolve-store`.

## Estrategia de teste

- Mapear endpoints e telas pelo codigo antes de executar fluxos destrutivos.
- Executar testes automatizados existentes: typecheck, build, API, E2E, smoke e test:all quando disponiveis.
- Criar dados de teste apenas com prefixo `E2E_TEST_`.
- Nao truncar tabelas, nao resetar banco e nao remover dados reais.
- Validar rotas publicas com `curl`.
- Validar Docker/WSL ao final sem alterar infraestrutura.
- Quando houver falha, corrigir a causa real no menor escopo possivel e repetir o teste especifico antes da bateria geral.

## Estrategia de rollback

- Como o diretorio nao foi reconhecido como repositorio Git, todo arquivo alterado sera listado no relatorio final.
- Alteracoes serao pequenas e localizadas para permitir reversao manual por arquivo.
- Nenhuma migration destrutiva sera criada ou executada.
- Nenhum volume Docker ou banco sera apagado.
- Se uma mudanca causar regressao, restaurar o arquivo afetado a partir da copia anterior do ambiente/backup ou do pacote original do projeto.

## Riscos encontrados

- O ambiente atual nao foi reconhecido como repositorio Git, reduzindo a capacidade de diff/rollback automatico.
- O WSL pode ter compose/configuracao diferente do Docker Desktop; validacao deve preservar portas e containers existentes.
- Teste completo cliente/admin pode exigir credenciais admin e dados reais; sem credenciais descobertas no codigo, a validacao manual de areas restritas pode ficar limitada a API/testes automatizados.
- Fluxos PIX/cartao dependem de configuracao da loja/gateway; quando nao configurados, o criterio sera validar indisponibilidade amigavel e ausencia de quebra.
- Qualquer teste que cria pedido deve usar prefixo `E2E_TEST_` e limpeza restrita aos dados criados pelo teste.
