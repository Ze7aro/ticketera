ALTER TABLE "Order" ADD COLUMN "requestHash" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "ticketTypeName" TEXT NOT NULL DEFAULT '';
UPDATE "OrderItem" SET "ticketTypeName" = "TicketType"."name" FROM "TicketType" WHERE "OrderItem"."ticketTypeId" = "TicketType"."id";
CREATE INDEX "Order_eventId_status_expiresAt_idx" ON "Order"("eventId", "status", "expiresAt");
