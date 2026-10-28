import "server-only";
import { DateTime } from "luxon";
import type { Prisma } from "@/generated/prisma/client";

export async function reserveTicketNumbers(
  tx: Prisma.TransactionClient,
  event: {
    id: string;
    abbreviation: string;
    startsAt: Date;
    timezone: string;
    ticketNumberPrefix: string | null;
  },
  count: number,
) {
  const prefix =
    event.ticketNumberPrefix ??
    `${event.abbreviation}-${DateTime.fromJSDate(event.startsAt).setZone(event.timezone).year}`;
  const series = await tx.ticketSeries.upsert({
    where: { prefix },
    create: { prefix, nextNumber: count + 1 },
    update: { nextNumber: { increment: count } },
  });
  await tx.event.update({
    where: { id: event.id },
    data: {
      ticketNumberPrefix: prefix,
      nextTicketNumber: { increment: count },
    },
  });
  return {
    prefix,
    firstSequence: series.nextNumber - count,
  };
}
