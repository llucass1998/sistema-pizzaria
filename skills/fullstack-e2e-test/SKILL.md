# Skill: Teste Full Stack E2E — Loja Pública + Admin

## Objetivo

Esta skill deve ser usada sempre que for necessário testar o sistema inteiro da pizzaria, incluindo:

* frontend da loja pública
* backend da loja pública
* checkout
* carrinho
* PIX
* cartão
* entrega
* retirada
* frontend do admin
* backend do admin
* PDV
* Pedidos Live
* financeiro
* configurações
* permissões
* tenant/loja
* Docker/WSL

O objetivo é garantir que o sistema esteja funcional de ponta a ponta, sem código quebrado, sem tela branca, sem erro 502, sem loja em manutenção indevida e sem erro crítico no console.

---

## Regra obrigatória: não derrubar o site

Antes de testar ou corrigir qualquer coisa, respeitar estas regras:

Não alterar sem necessidade:

* Docker
* Caddy
* docker-compose.yml
* Dockerfile.api
* Dockerfile.web
* portas
* proxy /api
* API_URL
* baseURL
* DATABASE_URL
* env
* domínio
* SSL
* healthcheck
* networks
* volumes
* update.sh
* resolve-store global

Não apagar banco.

Não resetar dados reais.

Não rodar migration destrutiva.

Não deletar tenant/loja.

Não deixar o site fora do ar.

Não deixar a loja pública aparecendo como manutenção se a manutenção não estiver ativa no ADM.

Antes de qualquer alteração, rodar:

```bash
git status
git diff --name-only
```

Se aparecer arquivo de infraestrutura alterado sem necessidade, reverter antes de continuar.

---

## Ordem obrigatória dos testes

Testar nesta ordem:

1. Infra local e API base
2. Loja pública frontend
3. Loja pública backend
4. Carrinho e checkout
5. Pagamentos
6. Entrega e retirada
7. Admin frontend
8. Admin backend
9. Categorias e produtos
10. Pedidos Live
11. PDV
12. Financeiro
13. Configurações
14. Permissões
15. Testes automatizados
16. Docker/WSL final
17. Produção, se estiver no servidor

Não pular etapa.

---

# 1. Teste de saúde do sistema

Rodar:

```bash
docker compose ps
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/api/status
curl -i "http://127.0.0.1/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="
```

Resultado esperado:

* frontend responde
* API responde
* resolve-store retorna a loja correta
* Docker está healthy
* sem erro 502
* sem container reiniciando

Se falhar:

```bash
docker compose logs api --tail=200
docker compose logs web --tail=200
docker compose logs db --tail=100
```

Corrigir antes de continuar.

---

# 2. Teste da loja pública — frontend

Abrir a loja pública.

Validar:

* home carrega
* logo aparece
* nome da loja aparece
* status aberto/fechado aparece corretamente
* categorias aparecem
* produtos aparecem
* promoções aparecem, se existirem
* categorias vazias ficam ocultas, se essa for a regra
* navbar funciona
* footer funciona
* WhatsApp funciona
* botão voltar ao topo funciona, se existir
* modo claro/escuro funciona
* mobile funciona
* desktop funciona

Não pode aparecer:

* tela branca
* ErrorBoundary
* “Ops! Algo deu errado”
* `undefined`
* `null`
* `R$ NaN`
* erro vermelho crítico no console
* loja em manutenção indevidamente

---

# 3. Teste da loja pública — backend

Testar endpoints públicos principais:

```bash
curl -i http://127.0.0.1/api/status
curl -i "http://127.0.0.1/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="
curl -i http://127.0.0.1/api/configuracoes
curl -i http://127.0.0.1/api/categorias
curl -i http://127.0.0.1/api/products
```

Validar:

* não retorna 500
* não retorna 502
* não retorna loja errada
* não exige login em rota pública
* retorna dados da loja correta
* respeita tenant/store

---

# 4. Teste de carrinho

Fluxo obrigatório:

1. Abrir cardápio.
2. Escolher produto.
3. Abrir modal do produto.
4. Escolher tamanho, se existir.
5. Escolher adicionais, se existir.
6. Escolher borda, se existir.
7. Adicionar ao carrinho.
8. Abrir carrinho.
9. Aumentar quantidade.
10. Diminuir quantidade.
11. Remover item.
12. Adicionar novamente.
13. Confirmar subtotal.
14. Confirmar total.

Não pode aparecer:

* total NaN
* preço errado
* item duplicado indevidamente
* botão sem ação
* carrinho travado
* erro no console

---

# 5. Teste de checkout

## Entrega

Fluxo obrigatório:

1. Adicionar produto ao carrinho.
2. Ir para checkout.
3. Preencher nome.
4. Preencher WhatsApp.
5. Escolher entrega.
6. Preencher endereço.
7. Preencher número.
8. Preencher bairro.
9. Calcular taxa de entrega.
10. Escolher pagamento.
11. Finalizar pedido.
12. Confirmar sucesso.
13. Confirmar pedido no admin.

Validar:

* entrega exige endereço
* taxa de entrega correta
* bairro não atendido mostra mensagem amigável
* pedido não finaliza sem dados obrigatórios
* total correto
* pedido criado no backend

## Retirada

Fluxo obrigatório:

1. Adicionar produto.
2. Ir para checkout.
3. Escolher retirada.
4. Confirmar taxa de entrega zerada.
5. Confirmar endereço da loja visível.
6. Escolher pagamento.
7. Finalizar pedido.
8. Confirmar pedido no admin.

Validar:

* retirada não exige endereço do cliente
* retirada não cobra entrega
* endereço da loja não aparece como undefined/null

---

# 6. Teste de pagamentos

Testar:

* PIX
* dinheiro
* cartão de débito
* cartão de crédito
* cartão online somente se gateway estiver configurado

## PIX

Validar:

* PIX aparece disponível quando configurado no ADM
* PIX aparece indisponível somente quando realmente não configurado
* QR Code aparece, se existir
* código copia e cola aparece, se existir
* botão copiar funciona
* pedido com PIX é criado
* pedido aparece no admin com paymentMethod PIX

Não mostrar no público:

```txt
Configure a chave PIX real da loja
```

Essa mensagem é somente administrativa.

## Dinheiro

Validar:

* paymentMethod CASH
* campo troco, se existir
* troco não pode ser menor que o total
* pedido criado corretamente

## Cartão

Validar:

* DEBIT_CARD
* CREDIT_CARD
* ONLINE_CARD somente se gateway existir
* backend aceita o enum correto
* pedido criado corretamente

---

# 7. Teste do admin — frontend

Abrir admin e validar:

* login funciona
* dashboard abre
* menu lateral funciona
* sidebar recolhe e expande
* ícones aparecem quando recolhida
* nomes aparecem quando expandida
* item ativo fica destacado
* rotas do menu funcionam
* modo claro/escuro funciona
* logout funciona
* mobile não quebra
* desktop não quebra

Não pode aparecer:

* tela branca
* ErrorBoundary
* menu quebrado
* rota sem componente
* botão sem ação
* erro vermelho crítico no console

---

# 8. Teste do admin — backend

Testar rotas admin com autenticação.

Validar:

* rota admin sem token retorna 401
* usuário sem permissão retorna 403
* usuário autorizado retorna 200
* tenant/store é respeitado
* dados de outra loja não vazam

Áreas a testar:

* categorias
* produtos
* pedidos
* PDV
* configurações
* financeiro
* fornecedores
* compras
* notas
* conciliação
* relatórios
* equipe/admins

---

# 9. Teste de categorias

Fluxo obrigatório:

1. Abrir Categorias.
2. Criar categoria `E2E_TEST_Categoria`.
3. Salvar.
4. Confirmar aparece na lista.
5. Editar categoria.
6. Alterar nome/status/ordem.
7. Salvar.
8. Recarregar página.
9. Confirmar persistência.
10. Confirmar comportamento no cardápio público.
11. Desativar/remover apenas categoria de teste, se seguro.

Validar:

* POST funciona
* PUT/PATCH funciona
* sortOrder funciona, se existir
* tenant correto
* sem erro 500
* sem categoryId undefined

---

# 10. Teste de produtos

Fluxo obrigatório:

1. Criar produto `E2E_TEST_Produto`.
2. Vincular categoria.
3. Definir preço.
4. Definir descrição.
5. Adicionar imagem, se possível.
6. Salvar.
7. Confirmar produto na lista.
8. Confirmar produto no cardápio.
9. Adicionar produto ao carrinho.
10. Editar preço.
11. Confirmar alteração.
12. Desativar/remover produto de teste, se seguro.

Validar:

* upload funciona
* preço em BRL
* produto não aparece em tenant errado
* imagem não quebra
* produto sem categoria não quebra tela

---

# 11. Teste de Pedidos Live

Fluxo obrigatório:

1. Criar pedido como cliente.
2. Abrir Pedidos Live no admin.
3. Confirmar pedido aparece.
4. Abrir detalhes.
5. Confirmar cliente.
6. Confirmar itens.
7. Confirmar pagamento.
8. Confirmar entrega/retirada.
9. Alterar status.
10. Confirmar atualização.
11. Se SSE existir, confirmar atualização sem refresh.
12. Se SSE cair, confirmar fallback por polling.

Validar:

* pedido não duplica
* status não pula etapa indevidamente
* tenant correto
* sem tela travada

---

# 12. Teste de PDV

Fluxo obrigatório:

1. Abrir Frente de Caixa.
2. Confirmar produtos carregam.
3. Adicionar produto.
4. Alterar quantidade.
5. Remover item.
6. Finalizar venda com dinheiro.
7. Finalizar venda com PIX.
8. Finalizar venda com débito.
9. Finalizar venda com crédito.
10. Confirmar pedido/venda criada.
11. Confirmar financeiro atualizado, se aplicável.

Validar:

* total correto
* paymentMethod correto
* venda aparece no lugar correto
* sem NaN
* sem erro 500

---

# 13. Teste financeiro

Testar:

* Dashboard Executivo
* Fluxo de Caixa
* DRE
* Conciliação
* Contas a Pagar
* Contas a Receber
* Compras
* Notas Fiscais
* Fornecedores
* Orçamentos
* Relatórios

Para cada tela:

* abrir
* confirmar título correto
* confirmar dados carregando
* testar filtros
* testar ações principais
* confirmar sem NaN
* confirmar sem undefined/null
* confirmar sem ErrorBoundary

---

# 14. Teste de configurações

Testar:

* nome da loja
* endereço
* WhatsApp
* horário
* status aberto/fechado
* modo manutenção
* cores
* logo
* favicon
* Instagram/footer
* pagamentos
* PIX
* taxa de entrega
* zonas de entrega

Regra crítica:

Se manutenção estiver OFF, a loja pública não pode aparecer em manutenção.

Se loja estiver CLOSED, pode bloquear checkout, mas não pode parecer erro de sistema.

---

# 15. Testes automatizados recomendados

Se existir Playwright ou Cypress, criar E2E para:

* login admin
* sidebar recolher/expandir
* navegar menus admin
* criar categoria
* criar produto
* criar pedido cliente
* pedido aparecer no admin
* checkout entrega
* checkout retirada
* PIX
* PDV
* configurações
* financeiro
* sem ErrorBoundary
* sem NaN
* sem undefined

Se existir Vitest, Jest ou Supertest, criar testes API para:

* status
* resolve-store
* categorias
* produtos
* checkout
* pedidos
* admin auth
* PDV
* financeiro
* configurações
* tenant isolado

Scripts esperados se possível:

```bash
npm run test
npm run test:api
npm run test:e2e
npm run test:smoke
npm run test:all
```

---

# 16. Smoke test obrigatório

Criar ou atualizar:

```txt
scripts/smoke-test-fullstack-site-admin.sh
```

Conteúdo mínimo:

```bash
#!/usr/bin/env bash
set -e

curl -f http://127.0.0.1/
curl -f http://127.0.0.1/api/status
curl -f "http://127.0.0.1/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="
curl -f http://127.0.0.1/api/configuracoes
curl -f http://127.0.0.1/api/products
curl -f http://127.0.0.1/api/categorias

echo "Smoke test fullstack OK"
```

Se qualquer comando falhar, não finalizar.

---

# 17. Correção de erros

Para cada erro encontrado:

1. Registrar no relatório.
2. Identificar causa real.
3. Corrigir no menor escopo possível.
4. Rodar teste específico.
5. Rodar teste geral.
6. Confirmar que não quebrou outra área.

Corrigir obrigatoriamente:

* ReferenceError
* TypeError
* tela branca
* ErrorBoundary
* erro 500
* erro 502
* erro 401 indevido em rota pública
* erro 403 indevido em rota permitida
* rota quebrada
* import inválido
* botão sem ação
* R$ NaN
* undefined/null visível
* tenant errado
* loja em manutenção indevida
* build quebrado

---

# 18. Comandos obrigatórios finais

Rodar:

```bash
git status
git diff --name-only
npm run typecheck:strict
npm run build
```

Se existir:

```bash
npm run lint
npm run test
npm run test:api
npm run test:e2e
npm run test:smoke
npm run test:all
```

Não finalizar com erro.

---

# 19. Validação Docker/WSL

Rodar:

```bash
docker compose build api
docker compose build web
docker compose up -d --build
docker compose ps
```

Validar:

```bash
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/api/status
curl -i "http://127.0.0.1/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="
curl -i http://127.0.0.1/api/configuracoes
curl -i http://127.0.0.1/api/products
curl -i http://127.0.0.1/api/categorias
```

Se falhar:

```bash
docker compose logs api --tail=200
docker compose logs web --tail=200
docker compose logs db --tail=100
```

Corrigir antes de finalizar.

---

# 20. Validação em produção

Se estiver no servidor de produção, validar:

```bash
curl -I https://pizzarialucas.istigestao.com.br/
curl -I https://pizzarialucas.istigestao.com.br/api/status
curl -i "https://pizzarialucas.istigestao.com.br/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="
```

Abrir no navegador:

* loja pública
* checkout
* admin
* dashboard
* categorias
* produtos
* pedidos live
* PDV
* financeiro
* configurações

Confirmar:

* sem 502
* sem tela branca
* sem ErrorBoundary
* sem erro vermelho crítico
* loja pública não aparece em manutenção indevidamente
* admin funciona
* checkout funciona
* backend funciona

---

# 21. Relatório final obrigatório

Criar ou atualizar:

```txt
RELATORIO_TESTE_FULLSTACK_SITE_ADMIN.md
```

Incluir:

1. Data do teste.
2. Módulos testados.
3. Teste da loja pública frontend.
4. Teste da loja pública backend.
5. Teste do checkout.
6. Teste dos pagamentos.
7. Teste do admin frontend.
8. Teste do admin backend.
9. Teste de categorias.
10. Teste de produtos.
11. Teste de Pedidos Live.
12. Teste de PDV.
13. Teste de financeiro.
14. Teste de configurações.
15. Testes automatizados criados.
16. Bugs encontrados.
17. Bugs corrigidos.
18. Arquivos alterados.
19. Resultado do typecheck.
20. Resultado do build.
21. Resultado Docker/WSL.
22. Resultado dos curls.
23. Confirmação que o site não caiu.
24. Confirmação que a loja não ficou em manutenção indevidamente.
25. Pendências, se existir.

---

## Critérios finais de aceite

Só finalizar quando:

* loja pública funciona
* backend público funciona
* checkout funciona
* PIX funciona
* cartão funciona conforme configuração
* entrega funciona
* retirada funciona
* admin funciona
* backend admin funciona
* sidebar admin funciona
* categorias funcionam
* produtos funcionam
* pedidos funcionam
* PDV funciona
* financeiro funciona
* configurações funcionam
* permissões funcionam
* tenant correto
* sem erro 502
* sem loja em manutenção indevida
* sem tela branca
* sem ErrorBoundary
* sem R$ NaN
* sem undefined/null visível
* typecheck passa
* build passa
* Docker/WSL valida
* relatório final criado
