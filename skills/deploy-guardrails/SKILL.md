---
name: deploy-guardrails
description: Boas práticas obrigatórias, verificações de saúde e guardrails para compilação, testes e deploy via Docker e WSL.
---

# Deploy Guardrails & WSL/Docker Best Practices

Este skill define os procedimentos obrigatórios para compilar, testar e realizar o deploy do sistema de Pizzaria/ERP no ambiente WSL2 com Docker e Nginx/Caddy.

## 1. Verificação Pré-Deploy (Obrigatória)

Antes de rodar qualquer script de deploy ou rebuild de contêineres em produção/homologação, **SEMPRE** execute a suíte de testes de checagem:

```bash
npm run test:all
```

> [!IMPORTANT]
> O comando `npm run test:all` engloba a checagem rigorosa de tipos TypeScript (`typecheck:strict`), testes unitários/integração do backend (`test:api`), testes E2E (`test:e2e`) e o build do Vite (`build`). **Nenhum deploy deve prosseguir se houver falha em qualquer uma dessas etapas.**

## 2. Reconstrução de Imagens no Docker (WSL/Windows)

Ao rodar compilações Docker no Linux (WSL2) montando diretórios do Windows (`/mnt/c/...`), o builder do Docker pode falhar em detectar alterações de carimbo de data/hora (timestamp) no sistema NTFS, utilizando cache desatualizado nas camadas de código (`COPY . .`).

### Guardrail de Cache
Sempre que o código fonte sofrer alterações estruturais, adição de novas rotas ou componentes lazy-loaded, utilize a flag `--no-cache`:

```bash
# Exemplo executado no script de redeploy
echo 'srv' | sudo -S docker build --no-cache -t lucas_pizarria_api:latest -f Dockerfile.api .
echo 'srv' | sudo -S docker build --no-cache -t pizzaria_web:latest -f Dockerfile.web .
```

## 3. Script Oficial de Redeploy no WSL

O script padrão para atualização dos contêineres na máquina local/servidor WSL é o `scripts/redeploy-wsl.sh`.
Ele executa:
1. Rebuild da imagem da API (`Dockerfile.api`).
2. Rebuild da imagem do Web/Frontend (`Dockerfile.web`).
3. Remoção e recriação dos contêineres (`pizzaria_db`, `pizzaria_waha`, `pizzaria_api`, `pizzaria_web`) na rede `sgbi`.
4. Checagem de status (`docker ps`) e logs iniciais.

## 4. Verificação de Saúde Pós-Deploy

Após o comando de deploy/redeploy, verifique imediatamente a saúde dos serviços:

```bash
# 1. Checar se os contêineres estão em status 'Up' (não 'Restarting' ou 'Exited')
wsl bash -c "echo 'srv' | sudo -S docker ps"

# 2. Rodar o script de health check de produção
bash scripts/check-production-health.sh
```

## 5. Resolução de Problemas Comuns
- **Erro 404 em novas rotas Admin:** Verifique se o novo componente importado dinamicamente (`React.lazy`) foi registrado no `AdminLayout.jsx` (menu/roles) E no roteador do `App.jsx`, além de garantir que o build do Vite não usou cache velho no Docker.
- **Requisições falhando com `/api/...` no Frontend:** Nunca faça chamadas hardcoded para `/api/...`. Sempre utilize a constante `API_BASE_URL` ou `import.meta.env.VITE_API_URL` padronizada nos componentes.