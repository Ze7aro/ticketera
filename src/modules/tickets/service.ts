import "server-only";
import { getDb } from "@/lib/db";
import { hashToken } from "@/modules/orders/tokens";
import { tokenSchema } from "@/modules/orders/validation";
import { decryptSecret } from "./crypto";
export async function getTicket(rawToken: string) {
  const token = tokenSchema.safeParse(rawToken);
  if (!token.success) return null;
  const ticket = await getDb().ticket.findUnique({
    where: { tokenHash: hashToken(token.data) },
    select: {
      id: true,
      number: true,
      status: true,
      attendeeName: true,
      order: { select: { status: true } },
      event: {
        select: {
          name: true,
          startsAt: true,
          timezone: true,
          venue: true,
          address: true,
          conditions: true,
        },
      },
      ticketType: { select: { name: true } },
      orderItem: { select: { ticketTypeName: true } },
    },
  });
  if (!ticket) return null;
  return {
    ...ticket,
    typeName: ticket.orderItem?.ticketTypeName ?? ticket.ticketType.name,
    usable:
      ticket.status === "VALID" &&
      (!ticket.order || ticket.order.status === "PAID"),
    token: token.data,
  };
}
export type TicketView = NonNullable<Awaited<ReturnType<typeof getTicket>>>;
export async function getOrderTickets(rawToken: string) {
  const token = tokenSchema.safeParse(rawToken);
  if (!token.success) return [];
  const order = await getDb().order.findUnique({
    where: { accessTokenHash: hashToken(token.data) },
    select: {
      status: true,
      tickets: {
        orderBy: { sequence: "asc" },
        select: { id: true, number: true, tokenEncrypted: true, status: true },
      },
    },
  });
  if (order?.status !== "PAID") return [];
  return order.tickets.map((ticket) => ({
    number: ticket.number,
    status: ticket.status,
    token: decryptSecret(ticket.tokenEncrypted, `ticket:${ticket.id}`),
  }));
}
