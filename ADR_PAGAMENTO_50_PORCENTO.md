# ADR - Pagamento com Entrada de 50%

Data: 07/07/2026

## Decisao

Implementar pagamento com entrada como modo `DEPOSIT`, mantendo `Order` com campos consolidados e `PaymentTransaction` como trilha auditavel.

## 1. Estados de pagamento

- `PENDING`: nada aprovado ainda.
- `PARTIALLY_PAID`: entrada aprovada, saldo pendente.
- `PAID`: valor integral recebido.
- `FAILED`: falha de pagamento.
- `CANCELED`: pedido cancelado.
- `REFUNDED`: pagamento estornado.

## 2. Campos novos

Em `Order`:

- `paymentMode`: `FULL` ou `DEPOSIT`.
- `depositPercent`.
- `depositAmount`.
- `remainingAmount`.
- `amountPaid`.
- `amountDue`.
- `remainingPaymentStatus`.
- `remainingPaidAt`.

Em `PaymentTransaction`:

- `type`: `FULL_PAYMENT`, `DEPOSIT_PAYMENT`, `REMAINING_PAYMENT`, `REFUND`.
- `idempotencyKey`.
- `paidAt`.

Em `StoreSetting`:

- `depositEnabled`.
- `depositPercent`.
- `depositRequiredMethods`.
- `allowPayRestOnDelivery`.
- `depositLabel`.

## 3. Regras de calculo

O frontend envia somente a intencao `paymentMode`. O backend recalcula o total final e calcula:

- `depositAmount = roundToCents(total * depositPercent / 100)`.
- `remainingAmount = total - depositAmount`.
- Para `FULL`: entrada zero, saldo zero apos pagamento integral.

Dinheiro e tratado sempre em centavos para calculo, e gravado como Decimal no Prisma.

## 4. Fluxo do webhook

Webhook localiza a transacao por `provider + externalId`, usa `type` e aplica regras idempotentes:

- `DEPOSIT_PAYMENT` aprovado: `amountPaid = depositAmount`, `amountDue = remainingAmount`, `paymentStatus = PARTIALLY_PAID`.
- `FULL_PAYMENT` aprovado: `amountPaid = total`, `amountDue = 0`, `paymentStatus = PAID`.
- `REMAINING_PAYMENT` aprovado: quita saldo, `paymentStatus = PAID`.

## 5. Fluxo do pagamento restante

Admin/caixa usa endpoint protegido `POST /api/admin/orders/:orderId/pay-remaining`. O backend valida tenant, permissao, saldo pendente e valor maximo. A transacao `REMAINING_PAYMENT` e criada com chave idempotente e, se houver turno aberto, registra `CashTransaction`.

## 6. Registro no caixa

Entrada online nao entra como dinheiro fisico no caixa. Pagamento restante registrado no admin entra no turno aberto conforme metodo escolhido. Se nao houver turno aberto, a transacao financeira e registrada sem `CashTransaction`, mantendo o comportamento tolerante do sistema.

## 7. Relatorios

Relatorios passam a separar:

- total vendido: `total`;
- total recebido: `amountPaid` ou pagamentos de invoice;
- entrada recebida: `depositAmount` quando `PARTIALLY_PAID`/`PAID`;
- saldo pendente: `amountDue`;
- saldo recebido: transacoes `REMAINING_PAYMENT` pagas.

## 8. Compatibilidade

Pedidos antigos sem campos novos sao tratados como `FULL`. Defaults nao destrutivos evitam quebra de queries existentes, PDV, dashboard e relatorios.

## 9. Migracao

Migration aditiva, sem remover ou alterar dados existentes. Defaults seguros sao usados em campos novos. Nenhum reset de banco e necessario.
