# ✅ PRE-DEPLOY CHECKLIST — Pizzaria ERP

> Execute este checklist **antes de cada deploy em produção**.
> Não pule etapas. Não finalize sem todos os checks passando.

---

## 1. Validação de Código

```bash
# TypeScript — sem erros de tipo
npm run typecheck:strict || npx tsc --noEmit

# Build do frontend (Vite)
npm run build

# Lint (se disponível)
npm run lint
```

**Critério:** Nenhum erro de compilação ou tipo.

---

## 2. Build dos Containers

```bash
# Build da API
docker build -f Dockerfile.api -t pizzaria_api:latest .
# OU via update.sh:
sudo docker build -f Dockerfile.api -t lucas_pizarria_api:latest .

# Build do Web (Nginx + frontend)
docker build -f Dockerfile.web -t pizzaria_web:latest .
```

**Critério:** Ambos os builds finalizam com `Successfully built`.

---

## 3. Subir Containers

```bash
# Parar containers antigos
sudo docker stop pizzaria_web pizzaria_api

# Iniciar com as novas imagens
sudo docker start pizzaria_api pizzaria_web

# OU forçar recriação:
sudo docker rm -f pizzaria_web pizzaria_api
sudo docker run -d --name pizzaria_api --network sgbi --restart always -p 3000:3000 \
  --env-file .env lucas_pizarria_api:latest
sudo docker run -d --name pizzaria_web --network sgbi --restart always -p 80:80 \
  pizzaria_web:latest
```

---

## 4. Verificar Status dos Containers

```bash
sudo docker ps
```

**Critério:** Todos os 4 containers estão `Up`:

- [ ] `pizzaria_db` — Up
- [ ] `pizzaria_waha` — Up
- [ ] `pizzaria_api` — Up
- [ ] `pizzaria_web` — Up, porta `0.0.0.0:80->80/tcp`

---

## 5. Health Check Local

```bash
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/api/status
curl -i "http://127.0.0.1/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="
curl -I http://127.0.0.1/api/configuracoes
curl -I http://127.0.0.1/api/categorias
curl -I http://127.0.0.1/api/pizzas
```

**Critério:** Todos retornam `200 OK`.

- [ ] `/` — 200
- [ ] `/api/status` — 200
- [ ] `/api/public/resolve-store` — 200
- [ ] `/api/configuracoes` — 200
- [ ] `/api/categorias` — 200
- [ ] `/api/pizzas` — 200

---

## 6. Health Check Produção

```bash
curl -I https://pizzarialucas.istigestao.com.br/
curl -I https://pizzarialucas.istigestao.com.br/api/status
curl -i "https://pizzarialucas.istigestao.com.br/api/public/resolve-store?host=pizzarialucas.istigestao.com.br&slug="
curl -I https://pizzarialucas.istigestao.com.br/api/configuracoes
curl -I https://pizzarialucas.istigestao.com.br/api/categorias
curl -I https://pizzarialucas.istigestao.com.br/api/pizzas
```

**Critério:** Todos retornam `200 OK`. **Zero 502.**

- [ ] Site produção `/` — 200
- [ ] `/api/status` produção — 200
- [ ] `/api/public/resolve-store` produção — 200
- [ ] `/api/configuracoes` produção — 200
- [ ] `/api/categorias` produção — 200
- [ ] `/api/pizzas` produção — 200

---

## 7. Verificação Visual

- [ ] Loja pública abre no navegador
- [ ] Cardápio exibe produtos
- [ ] Painel `/admin` abre sem erro
- [ ] Login admin funciona (`admin@riopizzas.com` / `admin123`)

---

## 8. Script Automático

```bash
# Rodar o script de healthcheck completo:
bash scripts/check-production-health.sh
```

**Critério:** Script termina com `✅ TODOS OS CHECKS PASSARAM`.

---

## ⚠️ Se qualquer check falhar

1. **PARE** — não considere o deploy finalizado.
2. Verificar logs: `sudo docker logs pizzaria_api --tail 100`
3. Verificar logs: `sudo docker logs pizzaria_web --tail 50`
4. Corrigir a causa raiz (ver `DEPLOY_GUARDRAILS.md`).
5. Repetir o checklist do início.

---

_Última atualização: 2026-07-01_
