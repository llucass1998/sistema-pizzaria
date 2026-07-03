-- Add financial state fields to orders without touching existing data.
DO $$ BEGIN
    ALTER TABLE "Order"
    ADD COLUMN "paymentMethod" TEXT,
    ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "paidAt" TIMESTAMP(3);
EXCEPTION
    WHEN OTHERS THEN null;
END $$;
