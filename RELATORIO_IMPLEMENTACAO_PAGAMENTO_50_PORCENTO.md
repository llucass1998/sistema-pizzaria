# Relatorio de Implementacao - Pagamento com Entrada de 50%

Data: 07/07/2026

## 1. Estado inicial

O sistema ja possuia checkout, PIX manual, gateway MOCK/Mercado Pago, webhook idempotente, `Order.paymentStatus`, `PaymentTransaction`, invoice, caixa e relatorios. Nao havia fluxo profissional para cobrar entrada e deixar saldo pendente.

## 2. Decisao tecnica adotada

Foi adotado modelo hibrido: campos consolidados no `Order` para leitura rapida e `PaymentTransaction` como trilha auditavel por pagamento.

## 3. Campos adicionados

`Order`: `paymentMode`, `depositPercent`, `depositAmount`, `remainingAmount`, `amountPaid`, `amountDue`, `remainingPaymentStatus`, `remainingPaidAt`.

`PaymentTransaction`: `type`, `idempotencyKey`, `paidAt`.

`StoreSetting`: `gatewayEnabled`, `depositEnabled`, `depositPercent`, `depositRequiredMethods`, `allowPayRestOnDelivery`, `depositLabel`.

## 4. Migration criada

Migration aditiva: `prisma/migrations/20260707190000_deposit_payment_50/migration.sql`. Ela nao remove campos, nao apaga dados e usa defaults seguros.

## 5. StoreSetting/settings

Admin agora pode ativar gateway online, ativar entrada, definir percentual, metodos permitidos, permitir restante na entrega/retirada e editar texto exibido no checkout.

## 6. Checkout

O checkout exibe a opcao de pagar total ou entrada quando `depositEnabled` e gateway online estao ativos para o metodo escolhido. O frontend envia somente `paymentMode`; nao envia valores finais confiaveis.

## 7. Calculo da entrada

O backend recalcula o pedido inteiro e usa helper em centavos para calcular entrada e saldo. O default e 50%, com validacao maior que 0 e menor que 100.

## 8. Gateway

`PaymentGatewayService` recebeu `paymentMode`, `transactionType` e metadata. Para `DEPOSIT`, cobra apenas `depositAmount`. Fluxos `FULL`, `MOCK` e Mercado Pago continuam compatíveis.

## 9. Webhook

Webhook identifica `FULL_PAYMENT`, `DEPOSIT_PAYMENT` e `REMAINING_PAYMENT`. Entrada aprovada marca `PARTIALLY_PAID`; pagamento integral marca `PAID`. Duplicidade nao soma novamente quando a transacao ja esta paga.

## 10. PARTIALLY_PAID

Pedido com entrada aprovada fica com `amountPaid`, `amountDue`, `paymentStatus=PARTIALLY_PAID` e `remainingPaymentStatus=PENDING`.

## 11. Acompanhamento do pedido

`OrderStatusPage` mostra card de pagamento pendente, pago integral ou entrada paga com saldo restante e instrucao para pagar ao entregador/balcao.

## 12. Admin pedidos

`OrdersPage` recebeu filtro financeiro, badges de pagamento e valores de entrada/saldo em pedidos parcialmente pagos.

## 13. Registro do restante

Novo endpoint: `POST /api/admin/orders/:orderId/pay-remaining`. Valida tenant, permissao, saldo, valor maximo e duplicidade. Cria `PaymentTransaction` do tipo `REMAINING_PAYMENT`, `Payment` na invoice e `CashTransaction` se houver turno aberto.

## 14. Caixa

Pagamento do restante entra no caixa quando existe turno aberto. Entrada online nao e misturada com dinheiro fisico.

## 15. Financeiro

Relatorio gerencial passou a expor total vendido, total recebido, entradas recebidas, restantes recebidos, saldo a receber, pedidos parcialmente pagos e pagos.

## 16. Relatorios

`ReportsPage` exibe cards de entradas recebidas, restantes recebidos e saldo a receber. CSV do resumo inclui os campos novos.

## 17. PIX manual vs PIX online

PIX manual continua existindo e nao marca pedido automaticamente como pago. Entrada fica condicionada a gateway online ativo e metodo permitido. O admin mostra recomendacao de usar Mercado Pago/online para entrada.

## 18. Testes automatizados

Criado `backend-src/services/orderFinancial.service.spec.ts` para calculo em centavos, percentual de entrada, normalizacao de modo e tipo de transacao.

## 19. Testes manuais realizados

Validados via Docker/curl:

- `http://127.0.0.1/` retornou 200.
- `/api/status` retornou 200.
- `/api/public/resolve-store` retornou loja ativa, sem manutencao indevida, e novos campos de entrada.
- `/api/configuracoes`, `/api/products`, `/api/categorias` retornaram 200.

## 20. Typecheck

`npm run typecheck:strict`: passou.

## 21. Build

`npm run build`: passou.

## 22. Docker/WSL

Executado:

- `docker compose ps`
- `docker compose build api`
- `docker compose build web`
- `docker compose up -d --build`
- `docker compose ps`

Resultado: `pizzaria_api` healthy, `pizzaria_web` rodando na porta 80, banco healthy.

## 23. Fluxo antigo

`paymentMode` default `FULL` preserva pedidos antigos e checkout integral. PDV segue criando pedidos pagos integralmente.

## 24. Loja publica

Curls publicos responderam 200. `resolve-store` confirmou `isMaintenance=false`.

## 25. Admin

Admin recebeu configuracao de pagamentos e Pedidos Live recebeu badges/modal de restante.

## 26. Pendencias

- `npm run test:e2e` nao executou testes porque nao existem arquivos em `tests/e2e/**/*.spec.ts`.
- Revisao profunda de DRE/Fluxo legado ainda deve migrar todos os calculos antigos para `amountPaid/amountDue`; o resumo gerencial novo ja separa recebido e pendente.
- Validacao visual Playwright navegada do fluxo 50% completo depende de credencial/gateway online ou fixture E2E especifica.
