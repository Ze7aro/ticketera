import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { transaction } from "@/lib/transaction";
import { hashToken } from "@/modules/orders/tokens";
import { encryptSecret } from "./crypto";
import { reserveTicketNumbers } from "./numbering";
export async function issueTickets(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { event: true, items: true, tickets: true, payments: true },
  });
  if (order.status !== "PAID" || order.ticketsIssuedAt) return;
  if (
    !order.payments.some(
      (payment) =>
        payment.applied &&
        payment.status === "APPROVED" &&
        !payment.reviewReason,
    )
  )
    throw new AppError(
      "UNVERIFIED_ORDER",
      "La orden no tiene un pago confirmado.",
      409,
    );
  // Existing tickets are preserved; this also safely recovers legacy paid orders.
  const missing = order.items.flatMap((item) =>
    Array.from({ length: item.quantity }, (_, index) => ({
      item,
      ordinal: index + 1,
    })).filter(
      ({ ordinal }) =>
        !order.tickets.some(
          (ticket) =>
            ticket.orderItemId === item.id && ticket.itemOrdinal === ordinal,
        ),
    ),
  );
  if (missing.length) {
    // Shared per prefix: tournaments with the same abbreviation/year cannot collide.
    const { prefix, firstSequence } = await reserveTicketNumbers(
      tx,
      order.event,
      missing.length,
    );
    const data = missing.map(({ item, ordinal }, offset) => {
      const id = randomUUID(),
        token = randomBytes(32).toString("base64url");
      const sequence = firstSequence + offset;
      return {
        id,
        eventId: order.eventId,
        orderId,
        orderItemId: item.id,
        ticketTypeId: item.ticketTypeId,
        itemOrdinal: ordinal,
        sequence,
        number: `${prefix}-${String(sequence).padStart(6, "0")}`,
        tokenHash: hashToken(token),
        tokenEncrypted: encryptSecret(token, `ticket:${id}`),
        attendeeName: `${order.firstName} ${order.lastName}`,
      };
    });
    await tx.ticket.createMany({ data });
  }
  await tx.order.update({
    where: { id: orderId },
    data: { ticketsIssuedAt: new Date() },
  });
  await tx.ticketEmail.upsert({
    where: { requestKey: `initial:${orderId}` },
    create: { orderId, requestKey: `initial:${orderId}` },
    update: {},
  });
}
export async function ensureOrderTickets(orderId: string) {
  await transaction((tx) => issueTickets(tx, orderId));
}
