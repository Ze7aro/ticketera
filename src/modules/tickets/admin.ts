import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { AppError } from "@/lib/errors";
import { transaction } from "@/lib/transaction";
import { getDb } from "@/lib/db";
import { hashToken } from "@/modules/orders/tokens";
import { requireRole } from "@/modules/users/access";
import { cancelTicketSchema, manualTicketSchema } from "./admin-validation";
import { encryptSecret } from "./crypto";
import { reserveTicketNumbers } from "./numbering";

export async function manualTicketOptions() {
  await requireRole(["ADMIN"]);
  const types = await getDb().ticketType.findMany({
    where: {
      active: true,
      event: { status: "PUBLISHED" },
    },
    orderBy: [{ event: { startsAt: "desc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      stock: true,
      sold: true,
      reserved: true,
      salesStart: true,
      salesEnd: true,
      event: { select: { id: true, name: true } },
    },
  });
  const now = new Date();
  return types.filter(
    (type) =>
      type.stock > type.sold + type.reserved &&
      type.salesStart <= now &&
      type.salesEnd >= now,
  );
}

export async function recentManualTickets(page = 1) {
  await requireRole(["ADMIN"]);
  if (!Number.isInteger(page) || page < 1 || page > 100000)
    throw new AppError("INVALID_PAGE", "La página solicitada no es válida.");
  return getDb().ticket.findMany({
    where: { orderId: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 20,
    take: 21,
    select: {
      id: true,
      number: true,
      tokenEncrypted: true,
      attendeeName: true,
      status: true,
      createdAt: true,
      event: { select: { name: true } },
      ticketType: { select: { name: true } },
    },
  });
}

export async function issueManualTicket(actorId: string, input: unknown) {
  const values = manualTicketSchema.parse(input);
  return transaction(async (tx) => {
    const type = await tx.ticketType.findUnique({
      where: { id: values.ticketTypeId },
      include: { event: true },
    });
    if (
      !type ||
      !type.active ||
      type.event.status !== "PUBLISHED" ||
      type.salesStart > new Date() ||
      type.salesEnd < new Date()
    )
      throw new AppError(
        "TICKET_TYPE_UNAVAILABLE",
        "El torneo o tipo de entrada no está disponible para venta manual.",
        409,
      );
    if (type.stock - type.sold - type.reserved < 1)
      throw new AppError(
        "OUT_OF_STOCK",
        "No queda disponibilidad para emitir otra entrada.",
        409,
      );

    const allocation = await reserveTicketNumbers(tx, type.event, 1);
    const id = randomUUID();
    const token = randomBytes(32).toString("base64url");
    const number = `${allocation.prefix}-${String(allocation.firstSequence).padStart(6, "0")}`;
    await tx.ticketType.update({
      where: { id: type.id },
      data: { sold: { increment: 1 } },
    });
    await tx.ticket.create({
      data: {
        id,
        eventId: type.eventId,
        ticketTypeId: type.id,
        sequence: allocation.firstSequence,
        number,
        tokenHash: hashToken(token),
        tokenEncrypted: encryptSecret(token, `ticket:${id}`),
        attendeeName: values.attendeeName,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "MANUAL_TICKET_ISSUED",
        entityType: "Ticket",
        entityId: id,
        reason: values.reason,
      },
    });
    return { id, number };
  });
}

export async function cancelTicket(actorId: string, input: unknown) {
  const values = cancelTicketSchema.parse(input);
  return transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id: values.ticketId },
      select: { id: true, number: true, status: true, orderId: true },
    });
    if (!ticket)
      throw new AppError("NOT_FOUND", "No encontramos la entrada.", 404);
    if (ticket.status !== "VALID")
      throw new AppError(
        "TICKET_NOT_CANCELLABLE",
        "Sólo se pueden anular entradas vigentes que todavía no fueron utilizadas.",
        409,
      );
    const updated = await tx.ticket.updateMany({
      where: { id: ticket.id, status: "VALID" },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: values.reason,
      },
    });
    if (updated.count !== 1)
      throw new AppError(
        "TICKET_NOT_CANCELLABLE",
        "La entrada cambió de estado. Actualizá la página e intentá nuevamente.",
        409,
      );
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "TICKET_CANCELLED",
        entityType: "Ticket",
        entityId: ticket.id,
        reason: values.reason,
      },
    });
    return { number: ticket.number, orderId: ticket.orderId };
  });
}
