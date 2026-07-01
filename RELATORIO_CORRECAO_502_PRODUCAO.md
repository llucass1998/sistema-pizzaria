# Relatorio de Correcao 502 em Producao

Data: 2026-06-30

## 1. Causa real do erro 502

O erro 502 era causado pelo container `pizzaria_api` em loop de restart.

Logs principais encontrados:

```text
Error:
We found changes that cannot be executed:
Added the required column `cashRegisterId` to the `Shift` table without a default value.
Added the required column `updatedAt` to the `Shift` table without a default value.
```

O `docker-entrypoint.sh` executava `npx prisma db push --accept-data-loss` no boot. Como ja existia 1 registro antigo em `Shift`, o Prisma nao conseguia adicionar colunas obrigatorias sem backfill e encerrava o container da API. Com a API fora do ar, o Nginx/web retornava 502 para `/api/*`.

## 2. Classificacao do problema

- API: sim, container reiniciando antes de servir `/api`.
- Banco/Prisma: sim, schema novo incompatível com dados existentes em `Shift`.
- Docker: sim, `api` nao tinha `build` no `docker-compose.yml`, entao `docker compose up --build` nao reconstruia a imagem da API.
- Proxy/Nginx: funcional localmente depois que a API ficou healthy.
- Tenant: `resolve-store` funciona; endpoints publicos validaram com `x-tenant-id`.
- Caddy: arquivo versionado estava desatualizado; ajustado para encaminhar ao web/Nginx.

## 3. Arquivos alterados

- `docker-entrypoint.sh`
- `docker-compose.yml`
- `prisma/safe-startup.sql`
- `Caddyfile`
- `frontend-src/App.jsx`
- `frontend-src/pages/MockPaymentPage.jsx`
- `backend-src/app.ts`
- `backend-src/routes/dispatch.routes.ts`
- `backend-src/routes/saas.routes.ts`

## 4. Configuracoes alteradas

- Removido o uso de `prisma db push --accept-data-loss` no boot.
- Adicionado `prisma/safe-startup.sql`, idempotente, para:
  - criar `CashRegister` se ausente;
  - criar um caixa padrao por tenant;
  - preencher `Shift.cashRegisterId`;
  - preencher `Shift.createdAt` e `Shift.updatedAt`;
  - renomear `Shift.closingCash` para `actualClosingCash` quando necessario;
  - adicionar FKs sem apagar dados.
- `docker-compose.yml` agora tem `build` no servico `api`.
- `Caddyfile` versionado agora aponta o dominio para o web/Nginx (`127.0.0.1:80`), que ja faz proxy de `/api`.

## 5. Docker compose ps

```text
pizzaria_api  Up (healthy)
pizzaria_db   Up (healthy)
pizzaria_waha Up
pizzaria_web  Up, 0.0.0.0:80->80/tcp
```

## 6. Testes locais

```text
http://127.0.0.1/                                           200
http://127.0.0.1/api/status                                  200
http://127.0.0.1/api/public/resolve-store?...                200
http://127.0.0.1/api/configuracoes                           200
http://127.0.0.1/api/categorias                              200
http://127.0.0.1/api/pizzas                                  200
```

Validacao com tenant resolvido:

```text
tenant=37c646b4-b2ac-4356-9a29-de14dfa7afa7
configuracoes=200
categorias=200
pizzas=200
categories_count=4
products_count=4
```

## 7. Testes de build

```text
npm run typecheck:strict  passou
npm run build             passou
npm run build:api         passou
npm test                  passou: 2 arquivos, 5 testes
```

## 8. Testes em producao/dominio

Tentativas a partir deste ambiente:

```text
https://pizzarialucas.istigestao.com.br/api/status
https://pizzarialucas.istigestao.com.br/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug=
```

Resultado:

```text
Invoke-WebRequest: Impossivel conectar-se ao servidor remoto
Test-NetConnection pizzarialucas.istigestao.com.br:443 => TcpTestSucceeded=False
Test-NetConnection pizzarialucas.istigestao.com.br:80  => TcpTestSucceeded=False
```

O dominio resolve para `177.70.8.202`, mas as portas 80/443 nao responderam deste ambiente. A stack local/WSL esta saudavel e servindo na porta 80.

## 9. Caddy

O binario `caddy` nao esta disponivel neste ambiente Windows, entao nao foi possivel executar `caddy validate` localmente.

O `Caddyfile` versionado foi corrigido para:

```caddyfile
pizzarialucas.istigestao.com.br {
    encode gzip zstd
    reverse_proxy 127.0.0.1:80
}
```

No servidor real, validar com:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## 10. Resultado final

- O loop de restart da API foi corrigido.
- A API ficou healthy.
- `/api/status` retornou 200 localmente.
- `/api/public/resolve-store` retornou 200 localmente.
- `/api/configuracoes`, `/api/categorias` e `/api/pizzas` retornaram 200 localmente.
- A loja publica carrega via Nginx local.
- O frontend nao mostra mais "Loja nao encontrada" para falhas 500/502/503/conexao; agora mostra mensagem de servidor indisponivel/conexao.

## 11. Pendencias

- Validar/recarregar o Caddy real no servidor onde o dominio `pizzarialucas.istigestao.com.br` aponta.
- Verificar firewall/NAT/DNS do IP `177.70.8.202`, pois 80/443 nao aceitaram conexao a partir deste ambiente.
