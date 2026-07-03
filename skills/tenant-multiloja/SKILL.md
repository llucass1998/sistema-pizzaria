---
name: tenant-multiloja
description: Regras fundamentais de arquitetura SaaS Multi-Tenant, resolução de loja por subdomínio/slug, middleware tenantGuard e isolamento de dados no Prisma.
---

# SaaS Multi-Tenant & Store Resolution Architecture

Este skill documenta o modelo multi-tenant do sistema de Pizzaria/ERP e define as regras estritas que DEVEM ser seguidas para evitar vazamento de dados entre lojas.

## 1. O Modelo SaaS Multi-Tenant

A plataforma opera em modelo SaaS onde múltiplas pizzarias compartilham a mesma instância do banco de dados PostgreSQL e aplicação, sendo estritamente separadas pelo campo `tenantId`.

### Mecanismos de Resolução da Loja
A requisição HTTP chega na API e o middleware `tenantGuard.ts` identifica o restaurante através de uma das seguintes origens (em ordem de prioridade):
1. **Cabeçalho Explícito:** Header `x-tenant: <tenantId>` ou `x-store-slug: <slug>`.
2. **Subdomínio/Host:** Header `Host` (ex: `pizzarialucas.istigestao.com.br` -> busca no Prisma por `domain` ou subdomínio).
3. **Query/Param:** Parâmetro `?tenantId=...` ou `?slug=...` em endpoints públicos específicos.

## 2. Guardrails de Banco de Dados (Prisma)

> [!WARNING]
> **Vazamento de dados entre tenants é uma falha crítica de segurança e privacidade.** Nenhuma query deve ser escrita sem isolamento.

- **SEMPRE** inclua `where: { tenantId: req.tenantId }` em operações de `findMany`, `findFirst`, `count`, `updateMany` e `deleteMany`.
- Ao criar novos registros (`create` ou `createMany`), o campo `data.tenantId` **NUNCA** deve vir do body da requisição do cliente sem validação; deve ser extraído do `req.tenantId` resolvido pelo middleware ou do JWT do usuário autenticado.
- Tabelas globais/compartilhadas (como definições de planos SaaS no admin geral da plataforma) são exceção estrita e devem ser devidamente comentadas.

## 3. Resolução no Frontend & Zustand Store

No Frontend:
- Ao carregar a aplicação, a store Zustand (`useCartStore.js`) consulta as configurações públicas da loja e armazena em `storeSettings` (contendo `tenantId`, `name`, `theme`, `slug`, `logo`).
- Todas as chamadas subsequentes para endpoints daquela loja devem anexar o cabeçalho `x-tenant: storeSettings.tenantId` automaticamente.

## 4. Onboarding de Novas Lojas
O fluxo de criação de nova loja (`OnboardingPage.jsx` / `POST /api/public/saas/onboarding`):
- Cria o registro na tabela `Store` gerando um `tenantId` único (CUID/UUID) e validando a unicidade do `slug` e `domain`.
- Cria automaticamente o usuário dono (`role: 'OWNER'`) vinculado a esse novo `tenantId`.
- Inicializa categorias e cardápio de exemplo (se solicitado no template de onboarding).