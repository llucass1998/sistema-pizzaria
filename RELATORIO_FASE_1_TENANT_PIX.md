# Relatorio Fase 1 - Tenant, Loja Ativa e PIX

Data: 2026-07-01

## Objetivo

Garantir que o site publico, o ADM e os endpoints publicos usem a mesma loja/tenant, com PIX real configurado e sem cair em tenant duplicado com placeholder.

## Diagnostico

- O fallback antigo de `tenantGuard` usava o primeiro tenant do banco quando a requisicao nao tinha `x-tenant-id`.
- Isso fazia `/api/configuracoes`, `/api/products` e `/api/categorias` poderem retornar uma loja diferente da loja resolvida por dominio.
- No WSL havia dois tenants com `slug=demo`, bloqueando a API atualizada no `db push` por constraint unica.
- O tenant duplicado `Pizzaria Lucas` tinha PIX placeholder `sua-chave-pix-aqui`.
- O tenant correto `Rio de Janeiro Pizzas` tinha PIX real `contato@riopizzas.com.br`, produtos, categorias, pedidos e admin.

## Correcao Aplicada

- Atualizado `backend-src/core/middlewares/tenantGuard.ts`.
- O middleware agora:
  - mantem `x-tenant-id` como prioridade maxima;
  - tenta resolver por `Host`, `Origin`, `Referer`, `customDomain` e `subdomain`;
  - prefere tenant ativo com dominio configurado;
  - cai para primeiro tenant ativo apenas como ultimo fallback;
  - usa consulta defensiva em `information_schema` para funcionar em bancos/schemas antigos e novos.
- Criado teste `backend-src/core/middlewares/tenantGuard.spec.ts`.
- No banco WSL:
  - tenant `32e1122e-d24c-4273-992a-42bf4ce26b8a` ficou com `customDomain = pizzarialucas.istigestao.com.br`;
  - tenant duplicado `b68c9318-55a6-4099-a6e4-ef3126bab550` foi arquivado com `slug = pizzaria-lucas-arquivo` e `isActive = false`;
  - nenhuma loja foi deletada.

## Validacao

- `npm run test:all`: passou.
- Testes API: 10 arquivos, 60 testes passaram.
- Testes E2E/Vitest: 4 arquivos, 13 testes passaram.
- Build Vite: passou, com aviso conhecido de bundle maior que 500 kB.
- WSL/API:
  - `http://127.0.0.1/api/status`: HTTP 200.
  - `http://127.0.0.1/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug=`: HTTP 200, tenant `32e112...`.
  - `http://127.0.0.1/api/configuracoes`: HTTP 200, tenant `32e112...`, loja `Rio de Janeiro Pizzas`.
  - `http://127.0.0.1/api/products`: HTTP 200.
  - `http://127.0.0.1/api/categorias`: HTTP 200.

## Infra

- Nao houve alteracao no repositorio de Docker, compose, Caddy, portas, proxy, envs ou URLs.
- No WSL foi necessario reconstruir a imagem da API e recriar o container `pizzaria_api` porque a copia WSL estava divergente do codigo atual.
- A rede WSL existente usa o hostname `pizzaria_db`; a API foi iniciada apontando para esse host para manter compatibilidade com o ambiente atual.

## Resultado

- ADM e site publico passam a trabalhar no tenant correto quando o frontend envia `x-tenant-id`.
- Endpoints sem `x-tenant-id` deixam de cair no tenant duplicado com PIX placeholder.
- PIX real da loja correta aparece em `/api/configuracoes` e no fluxo do checkout que consome essas configuracoes.
- Sem 502 apos a correcao final no WSL.

## Pendencias Para as Proximas Fases

- Fase 2: validar checkout completo em producao: entrega, retirada, PIX, dinheiro, debito, credito, loja aberta/fechada e WhatsApp.
- Fase 3: validar ADM completo, configuracoes, uploads e Pedidos Live ponta a ponta.
- Fase 4: validar PDV e reflexo em pedidos/KDS/financeiro.
- Fase 5: auditar financeiro, orcamentos, estoque e documentar o que ainda nao estiver pronto.
- Fase 6: formalizar deploy oficial, backup, restore, logs e monitoramento.
- Fase 7: ampliar testes automatizados.
- Fase 8: criar CI no GitHub Actions.
- Fase 9: auditoria visual mobile/desktop e performance.
