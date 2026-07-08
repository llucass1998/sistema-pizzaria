ALTER TABLE "Order"
  ADD COLUMN "paymentMode" TEXT NOT NULL DEFAULT 'FULL',
  ADD COLUMN "depositPercent" DECIMAL(65,30),
  ADD COLUMN "depositAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "remainingAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "amountPaid" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "amountDue" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "remainingPaymentStatus" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN "remainingPaidAt" TIMESTAMP(3);

ALTER TABLE "PaymentTransaction"
  ADD COLUMN "type" TEXT NOT NULL DEFAULT 'FULL_PAYMENT',
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3);

ALTER TABLE "StoreSetting"
  ADD COLUMN "gatewayEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "depositEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "depositPercent" DECIMAL(65,30) NOT NULL DEFAULT 50,
  ADD COLUMN "depositRequiredMethods" TEXT NOT NULL DEFAULT 'PIX_ONLINE,CARD_ONLINE,MERCADOPAGO',
  ADD COLUMN "allowPayRestOnDelivery" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "depositLabel" TEXT NOT NULL DEFAULT 'Pague 50% agora e o restante na entrega.';

CREATE UNIQUE INDEX "PaymentTransaction_tenantId_idempotencyKey_key"
  ON "PaymentTransaction"("tenantId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX "PaymentTransaction_tenantId_type_status_idx"
  ON "PaymentTransaction"("tenantId", "type", "status");
