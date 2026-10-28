import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { localToUtc } from "@/lib/dates";
import { transaction, assertUnchanged } from "@/lib/transaction";
import { requireRole } from "@/modules/users/access";
import { idSchema } from "@/modules/users/validation";
import { eventSchema, eventStatuses } from "./validation";
export async function listEvents(page: number) {
  await requireRole(["ADMIN"]);
  const current = z.number().int().min(1).max(100000).parse(page);
  return getDb().event.findMany({
    orderBy: [{ startsAt: "desc" }, { id: "asc" }],
    skip: (current - 1) * 20,
    take: 21,
    include: { _count: { select: { ticketTypes: true } } },
  });
}
export async function getEvent(id: string) {
  await requireRole(["ADMIN"]);
  return getDb().event.findUnique({
    where: { id: idSchema.parse(id) },
    include: { ticketTypes: { orderBy: { createdAt: "asc" } } },
  });
}
export async function saveEvent(
  input: unknown,
  id?: string,
  updatedAt?: string,
) {
  const actor = await requireRole(["ADMIN"]);
  const values = eventSchema.parse(input);
  const data = {
    ...values,
    startsAt: localToUtc(values.startsAt, values.timezone),
  };
  if (id) idSchema.parse(id);
  return transaction(async (tx) => {
    if (id) {
      const previous = await tx.event.findUniqueOrThrow({
        where: { id },
        include: { _count: { select: { tickets: true } }, ticketTypes: true },
      });
      assertUnchanged(previous.updatedAt, updatedAt ?? "");
      if (previous.status === "FINISHED")
        throw new AppError(
          "FINISHED",
          "No se puede editar un torneo finalizado.",
        );
      if (
        previous._count.tickets > 0 &&
        (previous.abbreviation !== data.abbreviation ||
          previous.slug !== data.slug ||
          previous.startsAt.getUTCFullYear() !== data.startsAt.getUTCFullYear())
      )
        throw new AppError(
          "ISSUED_TICKETS",
          "Con entradas emitidas no se puede cambiar la sigla, el enlace ni el año.",
        );
    }
    const event = id
      ? await tx.event.update({ where: { id }, data })
      : await tx.event.create({ data });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: id ? "EVENT_UPDATED" : "EVENT_CREATED",
        entityType: "Event",
        entityId: event.id,
      },
    });
    return event.id;
  });
}
export async function changeEventStatus(input: unknown) {
  const actor = await requireRole(["ADMIN"]);
  const { id, status, updatedAt } = z
    .object({
      id: idSchema,
      status: z.enum(eventStatuses),
      updatedAt: z.iso.datetime(),
    })
    .parse(input);
  await transaction(async (tx) => {
    const event = await tx.event.findUniqueOrThrow({
      where: { id },
      include: { ticketTypes: true },
    });
    assertUnchanged(event.updatedAt, updatedAt);
    if (event.status === "FINISHED")
      throw new AppError("FINISHED", "El torneo ya está finalizado.");
    if (status === "PUBLISHED") {
      if (event.startsAt <= new Date())
        throw new AppError(
          "PAST_EVENT",
          "No se puede publicar un torneo que ya comenzó.",
        );
      if (
        !event.ticketTypes.some(
          (type) =>
            type.active &&
            type.stock > type.sold + type.reserved &&
            type.salesEnd > new Date(),
        )
      )
        throw new AppError(
          "NO_TICKETS",
          "Creá y activá al menos un tipo de entrada con stock y fechas vigentes antes de publicar.",
        );
    }
    if (status === "DRAFT" && event.status !== "DRAFT")
      throw new AppError(
        "TRANSITION",
        "Un torneo publicado puede pausarse o finalizarse, pero no volver a borrador.",
      );
    if (status === "SALES_PAUSED" && event.status !== "PUBLISHED")
      throw new AppError(
        "TRANSITION",
        "Sólo se pueden pausar ventas de un torneo publicado.",
      );
    await tx.event.update({ where: { id }, data: { status } });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: `EVENT_${status}`,
        entityType: "Event",
        entityId: id,
      },
    });
  });
}
