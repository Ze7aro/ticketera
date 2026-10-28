import "server-only";
import { AppError } from "@/lib/errors";
import { localToUtc } from "@/lib/dates";
import { transaction, assertUnchanged } from "@/lib/transaction";
import { requireRole } from "@/modules/users/access";
import { idSchema } from "@/modules/users/validation";
import { ticketTypeSchema } from "./validation";
export async function saveTicketType(
  eventId: string,
  input: unknown,
  id?: string,
  updatedAt?: string,
) {
  const actor = await requireRole(["ADMIN"]);
  idSchema.parse(eventId);
  if (id) idSchema.parse(id);
  const { price, salesStart, salesEnd, ...values } =
    ticketTypeSchema.parse(input);
  await transaction(async (tx) => {
    const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
    if (event.status === "FINISHED")
      throw new AppError(
        "FINISHED",
        "No se pueden modificar entradas de un torneo finalizado.",
      );
    let start: Date, end: Date;
    try {
      start = localToUtc(salesStart, event.timezone);
      end = localToUtc(salesEnd, event.timezone);
    } catch {
      throw new AppError(
        "INVALID_DATE",
        "La fecha u hora no es válida en la zona del torneo.",
      );
    }
    if (start >= end)
      throw new AppError(
        "SALE_DATES",
        "El cierre debe ser posterior al inicio de la venta.",
      );
    if (id) {
      const previous = await tx.ticketType.findUniqueOrThrow({ where: { id } });
      if (previous.eventId !== eventId)
        throw new AppError(
          "NOT_FOUND",
          "No encontramos el tipo de entrada.",
          404,
        );
      assertUnchanged(previous.updatedAt, updatedAt ?? "");
      if (values.stock < previous.sold + previous.reserved)
        throw new AppError(
          "STOCK_COMMITTED",
          "El stock no puede ser menor que las entradas vendidas y reservadas.",
        );
    }
    const data = {
      ...values,
      priceCents: price,
      salesStart: start,
      salesEnd: end,
    };
    const type = id
      ? await tx.ticketType.update({ where: { id }, data })
      : await tx.ticketType.create({ data: { ...data, eventId } });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: id ? "TICKET_TYPE_UPDATED" : "TICKET_TYPE_CREATED",
        entityType: "TicketType",
        entityId: type.id,
      },
    });
  });
}
