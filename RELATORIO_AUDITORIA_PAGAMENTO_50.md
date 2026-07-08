# Auditoria Tecnica - Pagamento com Entrada de 50%

Data: 07/07/2026

## 1. Como o pedido e criado hoje

O checkout publico envia a intencao do pedido para `POST /api/pedidos`. A rota recalcula produtos, variacoes, meia-meia, adicionais, bordas, taxas, cupom e cashback no backend antes de criar o `Order`, `OrderItem` e `Invoice`. O pedido publico nasce com `paymentStatus = PENDING`. O PDV cria pedido via `POST /api/admin/pos/checkout` e ja registra pagamento integral como `PAID`.

## 2. Como o total e calculado hoje

O total e calculado no backend em `backend-src/routes/order.routes.ts`: subtotal dos itens validos, taxa de entrega conforme configuracao, taxa de servico, desconto de cupom e cashback. O frontend mostra uma previa, mas o valor final confiavel e o do servidor.

## 3. Como o PIX manual funciona hoje

O checkout gera QR Code e copia-e-cola localmente usando `frontend-src/utils/pix.js` com `pixKey`, `pixMerchantName` e `pixCity` vindos de configuracoes da loja. Esse PIX manual nao confirma pagamento automaticamente e nao deve ser tratado como pago sem acao administrativa.

## 4. Como Mercado Pago funciona hoje

`PaymentGatewayService` suporta `MOCK` e `MERCADOPAGO`. Para Mercado Pago, cria preferencia de checkout ou pagamento PIX online, usando `MERCADOPAGO_ACCESS_TOKEN`, `PUBLIC_URL`, `MERCADOPAGO_WEBHOOK_URL` e assinatura por `MERCADOPAGO_WEBHOOK_SECRET`.

## 5. Como webhook marca pagamento hoje

`WebhookController.handlePaymentWebhook` normaliza o evento, grava `PaymentWebhookEvent`, faz upsert de `PaymentTransaction`, atualiza `Order.paymentStatus`, cria/atualiza `Invoice` e registra `Payment` quando aprovado. Webhook duplicado por `eventId` e ignorado.

## 6. Como caixa/financeiro registra pagamento hoje

O PDV cria `Invoice`, `Payment` e `CashTransaction` de venda quando existe turno aberto. Pedidos publicos pagos por webhook criam `Payment` na invoice, mas entrada online nao entra no caixa fisico.

## 7. Onde paymentStatus e usado

`paymentStatus` aparece em rotas de pedidos, billing, financeiro, relatorios, dashboard e checkout/acompanhamento. Status ja suporta `PARTIALLY_PAID` no helper financeiro, mas ainda nao havia fluxo de entrada.

## 8. Onde PaymentTransaction e usado

`PaymentTransaction` e usado para registrar gateway, `externalId`, `amount`, `status`, `paymentUrl` e metadata. Antes desta implementacao faltavam `type`, `idempotencyKey` e `paidAt` para auditar entrada, restante e pagamento integral.

## 9. Melhor estrategia de modelagem

Manter valores consolidados no `Order` para leitura rapida e compatibilidade com admin/relatorios, e manter `PaymentTransaction` como trilha auditavel por pagamento. Pedidos antigos continuam como `FULL` por default.

## 10. Riscos de quebra

- Duplicar receita no webhook se pagamento parcial for somado mais de uma vez.
- Confundir PIX manual com PIX online confirmado.
- Inflar relatorios usando `total` como recebido quando ha saldo pendente.
- Quebrar PDV se defaults de campos novos nao forem seguros.
- Quebrar pedidos antigos se campos novos forem obrigatorios sem default.

## 11. Plano de implementacao por fases

1. Criar ADR e migration nao destrutiva.
2. Adicionar configuracoes de entrada no `StoreSetting`.
3. Adicionar helpers financeiros para centavos/Decimal, modos e tipos de transacao.
4. Ajustar checkout para enviar apenas `paymentMode`.
5. Fazer gateway cobrar `depositAmount` para `DEPOSIT`.
6. Fazer webhook idempotente atualizar `PARTIALLY_PAID`.
7. Criar endpoint admin para registrar restante.
8. Atualizar loja, admin, caixa/financeiro e relatorios.
9. Criar testes automatizados e validar build/typecheck.
