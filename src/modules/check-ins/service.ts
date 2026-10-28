import "server-only";
import { getDb } from "@/lib/db";
import { transaction } from "@/lib/transaction";
import { AppError } from "@/lib/errors";
import { hashToken } from "@/modules/orders/tokens";
import { tokenSchema } from "@/modules/orders/validation";
import type { CheckInResultView, TicketSearchView } from "./validation";

function tokenFromScan(value: string) {
  const raw = value.trim();
  let candidate = raw;
  if (raw.includes("://")) {
    try {
      const url = new URL(raw);
      const match = /^\/entrada\/([A-Za-z0-9_-]{43})\/?$/.exec(url.pathname);
      candidate = match?.[1] ?? "";
    } catch {
      candidate = "";
    }
  }
  const parsed = tokenSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export async function listCheckInEvents() {
  return getDb().event.findMany({
    where: { status: { in: ["PUBLISHED", "SALES_PAUSED", "FINISHED"] } },
    orderBy: [{ startsAt: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      startsAt: true,
      timezone: true,
      venue: true,
    },
  });
}

export async function searchTicketsForCheckIn(
  eventId: string,
  query: string,
): Promise<TicketSearchView[]> {
  const event = await getDb().event.findFirst({
    where: {
      id: eventId,
      status: { in: ["PUBLISHED", "SALES_PAUSED", "FINISHED"] },
    },
    select: { id: true },
  });
  if (!event)
    throw new AppError(
      "EVENT_UNAVAILABLE",
      "Este torneo no está disponible para control de acceso.",
      404,
    );
  const normalized = query.trim();
  const numeric = /^[A-Za-z0-9-]{3,32}$/.test(normalized);
  const searchCondition = numeric
    ? {
        OR: [
          {
            number: {
              equals: normalized.toUpperCase(),
              mode: "insensitive" as const,
            },
          },
          {
            attendeeName: {
              contains: normalized,
              mode: "insensitive" as const,
            },
          },
        ],
      }
    : { attendeeName: { contains: normalized, mode: "insensitive" as const } };
  const tickets = await getDb().ticket.findMany({
    where: {
      eventId,
      AND: [
        { OR: [{ orderId: null }, { order: { status: "PAID" } }] },
        searchCondition,
      ],
    },
    orderBy: [{ attendeeName: "asc" }, { number: "asc" }],
    take: 10,
    select: {
      id: true,
      number: true,
      attendeeName: true,
      status: true,
      ticketType: { select: { name: true } },
      orderItem: { select: { ticketTypeName: true } },
    },
  });
  return tickets.map((ticket) => ({
    id: ticket.id,
    number: ticket.number,
    attendeeName: ticket.attendeeName,
    ticketType: ticket.orderItem?.ticketTypeName ?? ticket.ticketType.name,
    status: ticket.status,
  }));
}

type CheckInTarget =
  | { kind: "token"; token: string }
  | { kind: "invalid" }
  | { kind: "ticket"; ticketId: string };

export async function registerCheckIn(
  eventId: string,
  userId: string,
  target: CheckInTarget,
): Promise<CheckInResultView> {
  return transaction(async (tx) => {
    const event = await tx.event.findFirst({
      where: {
        id: eventId,
        status: { in: ["PUBLISHED", "SALES_PAUSED", "FINISHED"] },
      },
      select: { id: true },
    });
    if (!event)
      throw new AppError(
        "EVENT_UNAVAILABLE",
        "Este torneo no está disponible para control de acceso.",
        404,
      );
    const tokenHash = target.kind === "token" ? hashToken(target.token) : null;
    const ticket =
      target.kind === "invalid"
        ? null
        : await tx.ticket.findUnique({
            where:
              target.kind === "token"
                ? { tokenHash: tokenHash! }
                : { id: target.ticketId },
            select: {
              id: true,
              eventId: true,
              number: true,
              attendeeName: true,
              status: true,
              order: { select: { status: true } },
              ticketType: { select: { name: true } },
              orderItem: { select: { ticketTypeName: true } },
            },
          });

    const view =
      ticket && ticket.eventId === eventId
        ? {
            ticketNumber: ticket.number,
            attendeeName: ticket.attendeeName,
            ticketType:
              ticket.orderItem?.ticketTypeName ?? ticket.ticketType.name,
          }
        : {};
    let result: CheckInResultView["result"] = "INVALID";

    if (ticket) {
      if (ticket.eventId !== eventId) result = "WRONG_EVENT";
      else if (ticket.status === "CANCELLED") result = "CANCELLED";
      else if (ticket.status === "USED") result = "ALREADY_USED";
      else if (ticket.order && ticket.order.status !== "PAID")
        result = "INVALID";
      else {
        const changed = await tx.ticket.updateMany({
          where: { id: ticket.id, eventId, status: "VALID" },
          data: { status: "USED", usedAt: new Date() },
        });
        if (changed.count === 1) result = "ACCEPTED";
        else {
          const current = await tx.ticket.findUnique({
            where: { id: ticket.id },
            select: { status: true },
          });
          result =
            current?.status === "USED"
              ? "ALREADY_USED"
              : current?.status === "CANCELLED"
                ? "CANCELLED"
                : "INVALID";
        }
      }
    }

    await tx.checkIn.create({
      data: {
        eventId,
        ticketId: ticket?.id,
        userId,
        result,
      },
    });
    return { result, ...view };
  });
}

export function extractScannedToken(value: string) {
  return tokenFromScan(value);
}
