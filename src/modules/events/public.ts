import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { expireReservations } from "@/modules/orders/service";
export async function listPublicEvents() {
  if (!process.env.DATABASE_URL) return [];
  return getDb().event.findMany({
    where: {
      status: { in: ["PUBLISHED", "SALES_PAUSED"] },
    },
    select: {
      slug: true,
      name: true,
      venue: true,
      startsAt: true,
      timezone: true,
      status: true,
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 50,
  });
}
export async function getPublicEvent(slug: string) {
  if (
    !z
      .string()
      .min(3)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .safeParse(slug).success
  )
    return null;
  const identity = await getDb().event.findFirst({
    where: { slug, status: { not: "DRAFT" } },
    select: { id: true },
  });
  if (!identity) return null;
  await expireReservations(identity.id);
  const event = await getDb().event.findFirst({
    where: { id: identity.id, status: { not: "DRAFT" } },
    include: {
      ticketTypes: {
        where: { active: true },
        orderBy: [{ priceCents: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!event) return null;
  return {
    ...event,
    asOf: Date.now(),
    ticketTypes: event.ticketTypes.map((type) => ({
      id: type.id,
      name: type.name,
      priceCents: type.priceCents,
      available: type.stock - type.sold - type.reserved,
      maxPerOrder: type.maxPerOrder,
      salesStart: type.salesStart.toISOString(),
      salesEnd: type.salesEnd.toISOString(),
    })),
  };
}
