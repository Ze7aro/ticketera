ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_REVIEW';
ALTER TABLE "Order" ADD COLUMN "reservationHeld" BOOLEAN NOT NULL DEFAULT true;
UPDATE "Order" SET "reservationHeld" = false WHERE "status" <> 'PENDING';
ALTER TABLE "Order" ADD COLUMN "paymentStartedAt" TIMESTAMPTZ(3), ADD COLUMN "paymentCheckoutUrl" TEXT, ADD COLUMN "lastReconciledAt" TIMESTAMPTZ(3);
ALTER TABLE "Payment" ADD COLUMN "applied" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "providerStatus" TEXT NOT NULL DEFAULT 'pending', ADD COLUMN "providerUpdatedAt" TIMESTAMPTZ(3), ADD COLUMN "reviewReason" TEXT;
UPDATE "Payment" SET "applied" = true WHERE "status" = 'APPROVED';
DROP INDEX "Payment_one_approved_per_order";
CREATE UNIQUE INDEX "Payment_one_applied_per_order" ON "Payment" ("orderId") WHERE "applied" = true;
-- Keep unexpected currencies for reconciliation without crediting the order.
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_amount_check";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_check" CHECK ("amountCents" >= 0);
