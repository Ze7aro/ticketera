ALTER TABLE "Event" ADD COLUMN "ticketNumberPrefix" TEXT;
ALTER TABLE "Order" ADD COLUMN "ticketsIssuedAt" TIMESTAMPTZ(3);
CREATE TABLE "TicketSeries" ("prefix" TEXT PRIMARY KEY, "nextNumber" INTEGER NOT NULL DEFAULT 1 CHECK ("nextNumber" > 0));
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'REVIEW', 'CANCELLED');
CREATE TABLE "TicketEmail" (
  "id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "requestKey" TEXT NOT NULL UNIQUE, "status" "EmailStatus" NOT NULL DEFAULT 'PENDING', "payloadEncrypted" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" >= 0), "firstAttemptAt" TIMESTAMPTZ(3),
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "leaseUntil" TIMESTAMPTZ(3), "leaseToken" TEXT,
  "sentAt" TIMESTAMPTZ(3), "providerId" TEXT, "lastErrorCode" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "TicketEmail_status_nextAttemptAt_idx" ON "TicketEmail"("status", "nextAttemptAt");
CREATE INDEX "TicketEmail_orderId_createdAt_idx" ON "TicketEmail"("orderId", "createdAt");
