# 🛡️ DEPLOY GUARDRAILS — Pizzaria ERP

> **Leia este arquivo antes de fazer qualquer alteração em infraestrutura.**
> Arquivos críticos protegidos: não altere sem necessidade comprovada.

---

## ⚠️ Arquivos Críticos — NÃO ALTERE sem necessidade comprovada

| Arquivo | Risco se alterado sem cuidado |
|---|---|
| `docker-compose.yml` | Pode derrubar todos os containers |
| `Dockerfile.api` | Pode quebrar o build da API |
| `Dockerfile.web` | Pode quebrar o Nginx/frontend |
| `nginx.conf` | Pode derrubar o proxy `/api` e o frontend |
| `update.sh` | Pode impedir o deploy correto |
| `docker-entrypoint.sh` | Pode impedir a API de subir |
| `.env` | Credenciais e `DATABASE_URL` — jamais expor |
| `prisma/schema.prisma` | Migrations erradas destroem dados |
| `backend-src/server.ts` | Porta e prefixo da API |

---

## 🚫 Regras Absolutas

1. **Alteração visual (CSS, componente React) NÃO pode mexer em Docker/Nginx/Caddy.**
2. **Alteração de componente React NÃO pode alterar `API_BASE_URL`.**
3. **Alteração de cardápio/produtos NÃO pode alterar proxy ou rotas.**
4. **Alteração de ADM/painel NÃO pode alterar portas ou nomes de serviços Docker.**
5. **Alteração de infraestrutura SÓ pode acontecer após explicar:** motivo, risco, impacto e testes.
6. **Nunca finalizar deploy sem testar `/api/status` e o domínio de produção.**
7. **Se houver erro 502, PARAR e corrigir antes de continuar qualquer outra tarefa.**
8. **Não apagar o banco de dados. Não rodar migrations destrutivas.**
9. **Não alterar portas** (API: `3000`, Web: `80`) **sem necessidade absoluta.**
10. **Não alterar nomes dos serviços Docker** (`pizzaria_api`, `pizzaria_web`, `pizzaria_db`, `pizzaria_waha`) **sem atualizar todos os pontos de referência.**

---

## 🔍 Arquitetura de Produção

```
Internet
   │
   ▼
[ISP/Cloudflare/Reverse Proxy externo]
   │  porta 443 → pizzarialucas.istigestao.com.br
   ▼
[pizzaria_web — Nginx Docker, porta 80]
   │
   ├── /           → Serve dist/ do frontend Vite
   ├── /api/*      → proxy_pass http://pizzaria_api:3000/api/*
   └── /uploads/*  → proxy_pass http://pizzaria_api:3000/uploads/*
        │
        ▼
   [pizzaria_api — Node.js/Express, porta 3000 interna]
        │
        ▼
   [pizzaria_db — PostgreSQL, porta 5432 interna]
```

**Rede Docker:** `sgbi` (todos os containers na mesma rede)

---

## 🛠️ Configurações Fixas — NÃO MUDE

| Parâmetro | Valor |
|---|---|
| `pizzaria_api` internal port | `3000` |
| `pizzaria_web` external port | `80` |
| `pizzaria_db` internal port | `5432` |
| Docker network | `sgbi` |
| API prefix | `/api` |
| `API_BASE_URL` (prod) | `/api` (relativo) |
| `DATABASE_URL` host | `db` (nome do serviço Docker) |

---

## 🔴 Causa do 502 — Histórico

O erro 502 ocorre quando `pizzaria_web` (Nginx) **não está rodando**.
Sem o `pizzaria_web`, nada responde na porta 80 e o proxy externo retorna 502.

**Principais causas identificadas:**
- `pizzaria_web` removido/reiniciado sem ser iniciado novamente
- Build do `pizzaria_web` falhou silenciosamente
- `update.sh` interrompido no meio do processo
- Imagem antiga do `pizzaria_web` sendo usada após mudança de `package.json`

**Solução rápida se 502 ocorrer:**
```bash
# Verificar containers
sudo docker ps -a

# Se pizzaria_web estiver parado:
sudo docker start pizzaria_web

# Se precisar reconstruir:
sudo docker rm -f pizzaria_web
sudo docker run -d --name pizzaria_web --network sgbi --restart always -p 80:80 pizzaria_web:latest
```

---

## 📋 Antes de alterar qualquer arquivo de infraestrutura

Responda estas perguntas:
1. **Por que preciso alterar esse arquivo?**
2. **Qual o risco se algo der errado?**
3. **Qual o impacto nos outros serviços?**
4. **Como vou testar antes e depois?**
5. **Tenho backup ou rollback disponível?**

Se não conseguir responder todas as 5, **não altere**.

---

*Última atualização: 2026-07-01 — Após correção do 502 por pizzaria_web não estar rodando.*
