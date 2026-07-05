---
name: anti-cache-fantasma-pizzaria
description: Garante que qualquer correção, build, deploy ou validação do projeto da pizzaria não fique presa em cache antigo, container fantasma, imagem desatualizada ou rede Docker incorreta no Windows/WSL.
---

# Skill Anti-Cache Fantasma — Pizzaria

## Objetivo

Garantir que qualquer correção, build, deploy ou validação do projeto da pizzaria não fique presa em cache antigo, container fantasma, imagem desatualizada, container antigo no Docker Desktop/WSL ou rede Docker incorreta.

Esta skill deve ser aplicada obrigatoriamente no final de qualquer tarefa relacionada ao projeto da pizzaria, principalmente quando envolver:

- Correção de frontend
- Correção de backend
- Deploy local
- Deploy no WSL
- Docker Desktop
- Nginx
- Caddy
- Build React
- Erro 502
- Cache antigo no navegador
- Cache fantasma no cliente
- Testes E2E
- Validação de produção
- Rotas do ERP

---

## Quando usar

Use esta skill sempre que o usuário pedir algo como:

- "corrija e suba"
- "arrume o frontend"
- "arrume o backend"
- "faça deploy"
- "suba no WSL"
- "valide produção"
- "está dando 502"
- "o cliente ainda vê a versão antiga"
- "está em cache fantasma"
- "rode os testes"
- "valide as rotas do ERP"
- "publique no domínio"

---

## Checklist obrigatória

### 1. Remover containers antigos ou falhos

Antes de subir qualquer nova versão, verificar e remover containers antigos que possam estar causando cache fantasma.

No WSL/Linux:

```bash
docker rm -f pizzaria_web 2>/dev/null || true
docker rm -f pizzaria_api 2>/dev/null || true
```

No PowerShell (Windows Docker Desktop):
> **IMPORTANTE:** No PowerShell, NÃO use `2>/dev/null`, pois tenta criar um arquivo em `C:\dev\null`. Use `2>$null`!

```powershell
docker rm -f pizzaria_web 2>$null
docker rm -f pizzaria_api 2>$null
```

---

### 2. Verificar o Daemon Docker Correto (WSL vs Windows Docker Desktop)

Evitar erros **502 Bad Gateway** causados por contêineres rodando em daemons separados:
- Se o banco (`pizzaria_db`) e a API (`pizzaria_api`) foram subidos pelo Docker Desktop no Windows, o frontend (`pizzaria_web`) **deve ser subido no mesmo Docker Desktop** (no terminal PowerShell ou bash normal do Windows, sem `wsl -u root`).
- Se subir o Nginx no daemon isolado do WSL (`wsl -u root docker run...`), ele não enxergará o container `pizzaria_api` do Windows e causará loop de crash: `host not found in upstream "pizzaria_api"`.
- Sempre remover contêineres fantasmas no WSL root se estiver rodando no Docker Desktop:
```bash
wsl -u root docker rm -f pizzaria_web 2>/dev/null || true
```

---

### 3. Build Sem Cache e Re-deploy na Rede Correta

Ao recriar a imagem web ou api, certificar-se do nome exato da rede do Docker Compose (geralmente prefixada com o nome do diretório, ex: `pizzaria_sgbi` ou `sgbi`):

```powershell
# 1. Build da imagem
docker build -t pizzaria_web:latest -f Dockerfile.web .

# 2. Descobrir a rede ativa da API
docker inspect pizzaria_api -f "{{json .NetworkSettings.Networks}}"

# 3. Subir o container na mesma rede da API (ex: pizzaria_sgbi)
docker run -d --name pizzaria_web --network pizzaria_sgbi --restart always -p 80:80 -p 8080:80 pizzaria_web:latest
```

---

### 4. Validação Antifantasma e Teste E2E

Após o deploy, validar que o proxy Nginx está respondendo sem erro 502 ou cache antigo antes de concluir a tarefa:

1. **Teste de Sanidade de API (Nginx Proxy):**
```powershell
curl -i http://localhost/api/status
# Deve retornar 200 OK com {"ok":true,"service":"pizzaria-api"}
```

2. **Bateria Playwright (Validação Completa ERP):**
```powershell
npx playwright test tests/playwright/admin-fullstack.spec.ts
```

---

### 5. Regras de Ouro Anti-Cache

- **Nunca presuma que o build atualizou:** Sempre verifique o tempo de criação do container (`docker ps`).
- **Limpeza de Cache do Vite/React:** Se houver comportamento anômalo no bundle, execute limpeza de build antes de gerar a imagem Docker: `rm -rf dist node_modules/.vite`.
- **Cabeçalhos Nginx:** Certifique-se de que o arquivo `nginx.conf` ou proxy não está servindo arquivos `html` com cache prolongado (sempre `Cache-Control: no-cache, no-store, must-revalidate` para `index.html`).
