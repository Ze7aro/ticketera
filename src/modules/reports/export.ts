import "server-only";
import { getDb } from "@/lib/db";

const batchSize = 500;
type CsvRecord = { id: string };

function cell(value: unknown) {
  let text = value instanceof Date ? value.toISOString() : String(value ?? "");
  if (/^[\t\r\n ]*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csvStream<T extends CsvRecord>(
  headings: string[],
  fetchPage: (cursor?: string) => Promise<T[]>,
  values: (row: T) => unknown[],
) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(`\uFEFF${headings.map(cell).join(",")}\r\n`),
        );
        let cursor: string | undefined;
        for (;;) {
          const rows = await fetchPage(cursor);
          if (!rows.length) break;
          const csv = rows
            .map((row) => values(row).map(cell).join(","))
            .join("\r\n");
          controller.enqueue(encoder.encode(`${csv}\r\n`));
          cursor = rows.at(-1)!.id;
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export function exportOrdersCsv(eventId?: string) {
  return csvStream(
    [
      "torneo",
      "orden",
      "estado",
      "nombre",
      "apellido",
      "dni",
      "email",
      "telefono",
      "importe_centavos",
      "moneda",
      "fecha_creacion_utc",
      "fecha_pago_utc",
    ],
    (cursor) =>
      getDb().order.findMany({
        where: eventId ? { eventId } : {},
        orderBy: { id: "asc" },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          status: true,
          firstName: true,
          lastName: true,
          dni: true,
          email: true,
          phone: true,
          totalCents: true,
          currency: true,
          createdAt: true,
          paidAt: true,
          event: { select: { name: true } },
        },
      }),
    (order) => [
      order.event.name,
      order.id,
      order.status,
      order.firstName,
      order.lastName,
      order.dni,
      order.email,
      order.phone,
      order.totalCents,
      order.currency,
      order.createdAt,
      order.paidAt,
    ],
  );
}

export function exportTicketsCsv(eventId?: string) {
  return csvStream(
    [
      "torneo",
      "numero_entrada",
      "asistente",
      "tipo_entrada",
      "estado",
      "fecha_ingreso_utc",
      "fecha_anulacion_utc",
      "motivo_anulacion",
      "orden",
      "estado_orden",
    ],
    (cursor) =>
      getDb().ticket.findMany({
        where: eventId ? { eventId } : {},
        orderBy: { id: "asc" },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          number: true,
          attendeeName: true,
          status: true,
          usedAt: true,
          cancelledAt: true,
          cancellationReason: true,
          event: { select: { name: true } },
          ticketType: { select: { name: true } },
          orderItem: { select: { ticketTypeName: true } },
          order: { select: { id: true, status: true } },
        },
      }),
    (ticket) => [
      ticket.event.name,
      ticket.number,
      ticket.attendeeName,
      ticket.orderItem?.ticketTypeName ?? ticket.ticketType.name,
      ticket.status,
      ticket.usedAt,
      ticket.cancelledAt,
      ticket.cancellationReason,
      ticket.order?.id,
      ticket.order?.status,
    ],
  );
}

export function exportCheckInsCsv(eventId?: string) {
  return csvStream(
    [
      "torneo",
      "numero_entrada",
      "asistente",
      "resultado",
      "controlador",
      "email_controlador",
      "fecha_ingreso_utc",
    ],
    (cursor) =>
      getDb().checkIn.findMany({
        where: eventId ? { eventId } : {},
        orderBy: { id: "asc" },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          result: true,
          createdAt: true,
          event: { select: { name: true } },
          ticket: { select: { number: true, attendeeName: true } },
          user: { select: { name: true, email: true } },
        },
      }),
    (checkIn) => [
      checkIn.event.name,
      checkIn.ticket?.number,
      checkIn.ticket?.attendeeName,
      checkIn.result,
      checkIn.user.name,
      checkIn.user.email,
      checkIn.createdAt,
    ],
  );
}
