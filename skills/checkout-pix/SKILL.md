---
name: checkout-pix
description: Regras de negócio, fluxos de checkout, cálculo de frete por bairro, cupons e integração do pagamento PIX mock/QR Code e conciliação no Prisma.
---

# Checkout, PIX & Payment Flows

Este skill rege as regras de implementação e teste do checkout online e fluxo de pagamento PIX no e-commerce da Pizzaria.

## 1. Regras do Carrinho e Checkout (Frontend)

O carrinho é gerenciado pelo store Zustand (`useCartStore.js`) e exibido em `CheckoutPage.jsx`.

### Guardrails de Frete e Entrega
- O frete não é estático nem fixo genérico: deve ser calculado dinamicamente com base no bairro informado através do endpoint `/checkout/calculate-delivery-fee`.
- Em pedidos do tipo `DELIVERY`, se o bairro não estiver coberto ou a taxa não for calculada com sucesso, **bloquear** a finalização do pedido.
- Pedidos do tipo `PICKUP` (retirada em balcão) têm taxa de frete igual a R$ 0,00 e dispensam endereço de entrega.

### Cupons de Desconto
- Validação no backend via `/carrinho/validate-coupon` passando `code`, `tenantId`, `cartTotal` e `items`.
- O desconto deve ser subtraído do subtotal na exibição e enviado na payload de criação do pedido.

## 2. Pagamento PIX e QR Code

O sistema suporta pagamento PIX via QR Code interativo e PIX Copia e Cola.

### Criação do Pedido (`POST /pedidos`)
- Quando `paymentMethod === 'PIX'`, o endpoint de criação do pedido deve gerar ou retornar a string de payload do PIX (QR Code / Copia e Cola) vinculada ao pedido.
- O status inicial do pagamento no banco de dados deve ser registrado como `PENDING`.
- No Frontend, ao detectar pagamento PIX, exibir o componente ou modal com o QR Code (`pix-qrcode`) e iniciar polling/SSE para monitorar a aprovação do pagamento.

## 3. Conciliação e Status Financeiro no Prisma

Toda atualização do status do pedido que represente pagamento aprovado (ex: confirmação via webhook ou baixa manual no Admin/PDV):
- Deve atualizar `paymentStatus` para `PAID` / `APPROVED`.
- Deve criar o registro de movimentação de caixa/conciliação financeira no Prisma (tabela `CashMovement` / `FinancialTransaction`) sempre com o `tenantId` da requisição.
- Deve disparar o evento de atualização em tempo real (`orderEvents.service.ts`) para notificar o KDS e a tela de rastreamento do cliente.