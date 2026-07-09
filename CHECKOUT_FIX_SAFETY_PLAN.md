# 🛡️ CHECKOUT FIX SAFETY PLAN

**Data:** 2026-07-01
**Objetivo:** Garantir a correção da página de checkout/pagamento sem causar indisponibilidade (downtime) nem quebrar outras páginas e rotas.

---

## 1. Estado Atual do Sistema

- **API (`pizzaria_api`)**: Rodando e funcional, porém a rota pública de cálculo de frete estava caindo num interceptor de administrador (middleware).
- **Frontend (`pizzaria_web`)**: O contêiner do Nginx havia caído durante deploys mal executados anteriormente. Foi restabelecido e está saudável.
- **Problema Principal**: Qualquer alteração no frontend causava o colapso da página ou do site se a infraestrutura fosse alterada indevidamente ou se componentes globais e dependências quebrassem no build, resultando em tela branca, `ReferenceError` ou bloqueio de middleware na API (`401 Unauthorized`).

## 2. Erros Relatados do Checkout

1. `ReferenceError: useShowInfo is not defined` (Frontend - já resolvido no componente `CheckoutPage.jsx`).
2. Rota `/api/checkout/calculate-delivery-fee` retornando erro `401 Unauthorized` devido a um middleware global aplicado por acidente no agrupamento do Express.
3. Tratamentos de fallback para a integração PIX, para que o sistema não falhe se a chave estiver vazia.

## 3. Arquivos Candidatos à Alteração

Os seguintes arquivos podem receber correções isoladas e cirúrgicas:

- `frontend-src/pages/CheckoutPage.jsx` (Lógica de Carrinho e Pagamento).
- `backend-src/routes/integration.routes.ts` (Remoção da armadilha do `requireAdmin` global no router).
- `scripts/smoke-checkout-safe.sh` (Para testes locais rápidos).

## 4. Arquivos Proibidos (NÃO ALTERAR)

A não ser que haja extrema necessidade comprovada, estão estritamente bloqueados:

- `docker-compose.yml`
- `Dockerfile.api` e `Dockerfile.web`
- `nginx.conf` ou proxy Caddy
- Variáveis de ambiente de infra (`.env`, `DATABASE_URL`, portas 3000/80)
- Rotas base no `app.ts` (apenas isolamentos permitidos)
- Componentes visuais não relacionados ao checkout (`Navbar`, `AdminLayout`, `Home`)

## 5. Estratégia de Rollback

1. Se qualquer alteração no frontend quebrar o build, rodar `git checkout frontend-src/pages/CheckoutPage.jsx`.
2. Se qualquer rota do backend for quebrada na correção do 401, desfazer o commit do `integration.routes.ts`.
3. Se os contêineres quebrarem, usar o `update.sh` sem a flag de novos commits para reinstanciar a imagem estável, ou reverter para a última branch saudável (`main`).

## 6. Comandos de Validação

Antes de subir para a produção ou fechar a tarefa, é estritamente obrigatório a execução de:

```bash
# Validar Infraestrutura
git status
git diff --name-only

# Validar Typecheck e Build do Frontend
npm run typecheck:strict
npm run build

# Validar APIs e Rotas via script de smoke-test
bash scripts/smoke-checkout-safe.sh
```

Apenas após a conclusão bem-sucedida 100% desses passos, o merge com o código de produção será aceito e validado no WSL.
