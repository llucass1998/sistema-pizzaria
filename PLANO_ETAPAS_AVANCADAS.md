# PLANO TÉCNICO: ETAPAS AVANÇADAS

Este plano descreve a arquitetura e a ordem de implementação para transformar a pizzaria atual em uma plataforma SaaS Multi-Tenant madura, com entrega dinâmica, pagamentos online, roteamento por subdomínio e suporte inicial fiscal.

---

## 1. FASE 1 — TAXA DE ENTREGA DINÂMICA

### Banco de Dados
- **Model Modificado**: `StoreSetting`
  - Adicionar: `deliveryFeeMode String @default("FIXED")` // FIXED, NEIGHBORHOOD, DISTANCE
- **Novos Models**: 
  - `DeliveryZone` (Bairros)
    - id, tenantId, name, fee, minOrderValue, isActive
  - `DeliveryRadiusRule` (Raio/Km)
    - id, tenantId, maxKm, fee, minOrderValue, isActive

### Backend
- **Novos Endpoints**:
  - `GET /api/admin/delivery-zones` e CRUD respectivo
  - `GET /api/admin/delivery-radius-rules` e CRUD respectivo
  - `POST /api/checkout/calculate-delivery-fee` (Lógica de resolução baseada no modo)

### Frontend
- **ADM**: Nova aba/seção em "Configurações" (`SettingsPage`) para gerenciar as regras de entrega (Tabelas para CRUD de Bairros e Raios).
- **Checkout**: Atualizar fluxo para ler o `deliveryFeeMode`.
  - Se for `NEIGHBORHOOD`, o dropdown de bairros lista os cadastrados.
  - Se for `DISTANCE`, será preparado o esqueleto (calculo de raio), documentando a necessidade de API Key (ex: Google Maps) no log.

### Riscos e Mitigações
- Risco: O carrinho público quebrar no cálculo do total.
- Mitigação: O endpoint `POST /api/checkout/calculate-delivery-fee` será a fonte da verdade, sendo chamado sempre que o endereço for alterado.

---

## 2. FASE 2 — PAGAMENTO ONLINE INTEGRADO

### Banco de Dados
- **Model Adaptado**: `Payment` (Já existe como filho de `Invoice`, que é 1:1 com `Order`).
  - Será expandido ou utilizado o próprio `Order` para carregar `provider`, `providerPaymentId`, `checkoutUrl`, `paidAt`.
  - Como `Payment` já existe e se liga a `Invoice`, podemos adicionar `externalId`, `gateway` no `Payment` e sincronizar o status.

### Segurança e Variáveis
- `.env` precisará de:
  - `PAYMENT_GATEWAY` (ex: `stripe`, `mercadopago`)
  - `STRIPE_SECRET_KEY` (se Stripe)
  - `MERCADOPAGO_ACCESS_TOKEN` (se MP)
- *Nenhum dado sensível de cartão (PAN, CVV) tocará nosso servidor de banco de dados.*

### Backend e Frontend
- **Novo Service**: `PaymentGatewayService` com padrão Strategy para suportar N provedores.
- **Endpoints**:
  - `POST /api/checkout/create-online-payment` (cria intent/checkout link)
  - `POST /api/webhooks/payments/:provider` (recebe eventos assíncronos e atualiza o pedido para `PREPARING` se auto-aprovar).
- **Checkout**: Nova opção de pagamento redirecionando o cliente para a tela oficial do Stripe/MP.

---

## 3. FASE 3 — IDENTIFICAÇÃO DA LOJA (MULTI-TENANT REAL)

### Banco de Dados
- **Model Modificado**: `Tenant`
  - Adicionar `slug String @unique`
  - Adicionar `subdomain String? @unique`
  - Adicionar `customDomain String? @unique`
  - Adicionar `isActive Boolean @default(true)`
  - *Logo, NavbarColor etc já existem em `StoreSetting`.*

### Backend
- **Novo Endpoint**: `GET /api/public/resolve-store?host=...`
  - Varre os domínios, subdomínios ou slugs configurados e devolve o `tenantId` base.

### Frontend
- O `App.jsx` fará um fetch inicial em `/resolve-store`.
- Em ambiente de dev (`localhost`), se houver path `/loja/nomedaloja`, usará slug.
- Em produção, leria `nomedaloja.meusistema.com`.
- **Isolamento Total**: Uma vez resolvido o tenantId, ele é armazenado no estado global e todas as requisições API usam este contexto, nunca vazando cardápios.

---

## 4. FASE 4 — NFC-e / FISCAL OPCIONAL

### Banco de Dados
- **Novos Models**: 
  - `FiscalSettings` (token, ambiente, certificado)
  - `FiscalDocument` (orderId, accessKey, status, xmlUrl, pdfUrl)

### Backend
- **Endpoints**: `POST /api/admin/fiscal/orders/:orderId/issue`
- **Fluxo Seguro**: Somente em modo HOMOLOGAÇÃO se não houver dados reais, impedindo bloqueios de SEFAZ e passivos fiscais para as lojas no momento do setup inicial.

---

## Ordem de Execução Recomendada

1. Executar **Fase 1 (Entrega)** (Isolado e de alto impacto imediato no checkout local).
2. Executar **Fase 2 (Pagamentos)** (Afeta a finalização do pedido).
3. Executar **Fase 3 (Subdomínios)** (Afeta o boot da aplicação).
4. Executar **Fase 4 (Fiscal)** (Requer cuidado extra e configurações isoladas).

Ao final de cada fase, o comando `npm run typecheck:strict` e o rebuild Docker/WSL2 devem garantir zero regressões.
