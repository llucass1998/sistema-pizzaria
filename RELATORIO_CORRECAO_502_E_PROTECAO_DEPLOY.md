# 📋 RELATÓRIO — Correção 502 e Proteção de Deploy

**Data:** 2026-07-01  
**Site:** https://pizzarialucas.istigestao.com.br/

---

## 1. Causa Real do Erro 502

O container `pizzaria_web` (Nginx) **não estava rodando**.

Sem o `pizzaria_web`, nada respondia na porta 80 do servidor. O proxy externo (ISP/CDN) tentava conectar na porta 80, não recebia resposta e retornava **502 Bad Gateway** para o usuário.

---

## 2. Componente com Problema

| Componente | Status no momento do 502 |
|---|---|
| `pizzaria_db` | ✅ Rodando |
| `pizzaria_waha` | ✅ Rodando |
| `pizzaria_api` | ✅ Rodando e saudável na porta 3000 |
| `pizzaria_web` | ❌ **Parado — causa raiz do 502** |

---

## 3. Logs e Evidências

**docker ps antes da correção:**
```
NAMES           STATUS
pizzaria_waha   Up 8 minutes
pizzaria_db     Up 8 minutes
# pizzaria_api e pizzaria_web AUSENTES
```

**Portas em escuta antes da correção:**
```
tcp   LISTEN  0.0.0.0:3000   (docker-proxy para pizzaria_api)
# porta 80 NÃO estava em escuta
```

**API saudável (confirmado por docker logs):**
```
[INFO] API da pizzaria rodando em http://localhost:3000/api
[INFO] [CRON] Iniciando rotinas agendadas...
```

---

## 4. Causa Secundária

O script `update.sh` parou no meio do processo (build do `pizzaria_web` interrompido), deixando `pizzaria_web` removido mas não recriado.

A imagem `pizzaria_web:latest` existia no servidor, mas o container não estava rodando.

---

## 5. Correção Aplicada

```bash
# Subir pizzaria_web com a imagem existente
sudo docker run -d \
  --name pizzaria_web \
  --network sgbi \
  --restart always \
  -p 80:80 \
  pizzaria_web:latest
```

Container subiu em segundos. Site voltou imediatamente.

---

## 6. Resultado dos Health Checks

### Local (127.0.0.1)
| Endpoint | Status |
|---|---|
| `/` | ✅ 200 OK |
| `/api/status` | ✅ 200 OK |
| `/api/public/resolve-store` | ✅ 200 OK |
| `/api/configuracoes` | ✅ 200 OK |
| `/api/categorias` | ✅ 200 OK |
| `/api/pizzas` | ✅ 200 OK |

### Produção (pizzarialucas.istigestao.com.br)
| Endpoint | Status |
|---|---|
| `/` | ✅ 200 OK |
| `/api/status` | ✅ 200 OK |
| `/api/public/resolve-store` | ✅ 200 OK |
| `/api/configuracoes` | ✅ 200 OK |
| `/api/categorias` | ✅ 200 OK |
| `/api/pizzas` | ✅ 200 OK |

---

## 7. Status Final dos Containers

```
NAMES           STATUS          PORTS
pizzaria_web    Up              0.0.0.0:80->80/tcp
pizzaria_api    Up              0.0.0.0:3000->3000/tcp
pizzaria_waha   Up              3000/tcp
pizzaria_db     Up              0.0.0.0:5433->5432/tcp
```

---

## 8. Arquivos Criados para Proteção

| Arquivo | Descrição |
|---|---|
| `DEPLOY_GUARDRAILS.md` | Regras sobre o que NÃO alterar sem necessidade |
| `PRE_DEPLOY_CHECKLIST.md` | Checklist obrigatório antes de cada deploy |
| `scripts/check-production-health.sh` | Script automático de validação de saúde |

---

## 9. Alterações de Código

| Arquivo | Alteração |
|---|---|
| `frontend-src/pages/CheckoutPage.jsx` | Corrigido encoding UTF-8 corrompido (causa do `ReferenceError: uccShowInfo`) |
| `DEPLOY_GUARDRAILS.md` | Criado |
| `PRE_DEPLOY_CHECKLIST.md` | Criado |
| `scripts/check-production-health.sh` | Criado |

---

## 10. O Que NÃO Foi Alterado

- ✅ Banco de dados — **não apagado, não migrado de forma destrutiva**
- ✅ `docker-compose.yml` — **não alterado**
- ✅ `Dockerfile.api` / `Dockerfile.web` — **não alterados**
- ✅ `nginx.conf` — **não alterado**
- ✅ `.env` — **não alterado**
- ✅ `DATABASE_URL` — **não alterada**
- ✅ Caddy — **não existe no servidor (confirmado)**
- ✅ Portas — **não alteradas**

---

## 11. Pendências

- [ ] O `update.sh` pode ser aprimorado para verificar se `pizzaria_web` subiu após o build
- [ ] Adicionar `--restart always` no `update.sh` para garantir que containers reiniciem automaticamente
- [ ] Considerar healthcheck no Docker para `pizzaria_web`

---

## 12. Confirmação Final

> ✅ Erro 502 resolvido  
> ✅ Site em produção funcionando  
> ✅ Todos os endpoints retornam 200  
> ✅ Banco de dados intacto  
> ✅ Proteções criadas para futuros deploys  

*Correção realizada em: 2026-07-01T11:38 UTC-3*
