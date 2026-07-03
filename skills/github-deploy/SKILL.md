---
name: github-deploy
description: Padrões de versionamento no GitHub, commits convencionais, verificação de branch e fluxo contínuo de integração e deploy em produção.
---

# GitHub CI/CD & Production Release Workflow

Este skill estabelece o fluxo de trabalho obrigatório no Git e GitHub para gerenciar atualizações e libertações de versão no sistema de Pizzaria ERP.

## 1. Padrão de Commits Convencionais
Todos os commits devem seguir a especificação de **Conventional Commits** para manter o histórico limpo e facilitar a geração automática de changelogs:
- `feat(admin): add suppliers management page and purchase orders`
- `fix(dispatch): correct hardcoded api url to respect API_BASE_URL`
- `refactor(routing): lazy load admin subpages to improve bundle splitting`
- `test(e2e): add regression specs for pix checkout flow`
- `chore(deps): update prisma client and docker config`

## 2. Checklist Pré-Commit & Push
Antes de realizar o `git push origin main` (ou para branch de feature):
1. **Verificação Local:** Executar `npm run test:all`. Se houver qualquer falha de tipagem do TypeScript ou teste quebrado, o commit não deve ser realizado.
2. **Revisão de Arquivos Sensíveis:** Certificar-se de que arquivos `.env`, chaves de API reais, segredos bancários ou bancos SQLite temporários não estejam sendo empurrados (verificar o `.gitignore`).
3. **Sincronização de Schema:** Se houve alteração no `schema.prisma`, verificar se a respectiva migração (`prisma migrate dev` ou `prisma migrate deploy`) foi criada e testada.

## 3. Fluxo de Deploy Contínuo no Servidor (WSL/Production)

O ambiente de produção (rodando em Docker sobre Linux/WSL com Nginx/Caddy) consome as atualizações diretamente através de submissão no GitHub e sincronização via shell script:

```bash
# 1. Puxar alterações mais recentes da branch principal
git pull origin main

# 2. Executar o script oficial de redeploy
bash scripts/redeploy-wsl.sh
```

## 4. Auditoria de Deploy (Health Check)
Logo após rodar o deploy, é mandatório validar os endpoints de saúde e contrato:
- Executar `bash scripts/check-production-health.sh`.
- Verificar se a API responde 200 OK em `/api/health` ou na resolução de loja pública de teste.
- Verificar se os arquivos estáticos gerados pelo Vite (`dist/`) estão sendo servidos corretamente sem erros de CORS ou MIME type no console do navegador.