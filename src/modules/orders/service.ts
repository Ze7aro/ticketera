import "server-only";
import { getDb } from "@/lib/db";
import { transaction } from "@/lib/transaction";
import { AppError } from "@/lib/errors";
import { checkoutSchema, tokenSchema, type CheckoutInput } from "./validation";
import { verifyCheckoutToken, hashToken, requestFingerprint } from "./tokens";
import { calculateOrder } from "./policy";
import { ensureOrderTickets } from "@/modules/tickets/issuance";

export async function expireReservations(eventId: string) {
  // An in-flight preference is held too: network failure is not proof of no payment.
  for (let batch = 0; batch < 10; batch++) {
    const count = await transaction(async (tx) => {
      const expired = await tx.order.findMany({
        where: {
          eventId,
          status: "PENDING",
          preferenceId: null,
          paymentStartedAt: null,
          reservationHeld: true,
          expiresAt: { lte: new Date() },
        },
        include: { items: true },
        take: 100,
        orderBy: { id: "asc" },
      });
      for (const order of expired) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "EXPIRED", reservationHeld: false },
        });
        for (const item of order.items)
          await tx.ticketType.update({
            where: { id: item.ticketTypeId },
            data: { reserved: { decrement: item.quantity } },
          });
      }
      return expired.length;
    });
    if (count < 100) break;
  }
}
function existingResult(
  order: { id: string; requestHash: string | null },
  input: CheckoutInput,
) {
  if (order.requestHash !== requestFingerprint(input))
    throw new AppError(
      "FORM_REUSED",
      "Este formulario ya generó una orden con otros datos. Abrí el torneo para comenzar otra.",
      409,
    );
  return { orderId: order.id, token: input.token };
}
export async function createPendingOrder(raw: unknown) {
  const input = checkoutSchema.parse(raw);
  verifyCheckoutToken(input);
  const accessTokenHash = hashToken(input.token);
  await expireReservations(input.eventId);
  try {
    return await transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { accessTokenHash },
      });
      if (existing) return existingResult(existing, input);
      const event = await tx.event.findUnique({ where: { id: input.eventId } });
      if (!event)
        throw new AppError("NOT_FOUND", "No encontramos el torneo.", 404);
      const types = await tx.ticketType.findMany({
        where: {
          eventId: event.id,
          id: { in: input.items.map((item) => item.ticketTypeId) },
        },
      });
      const calculated = calculateOrder(event, types, input.items, new Date());
      for (const line of calculated.lines)
        await tx.ticketType.update({
          where: { id: line.ticketTypeId },
          data: { reserved: { increment: line.quantity } },
        });
      const order = await tx.order.create({
        data: {
          eventId: event.id,
          firstName: input.firstName,
          lastName: input.lastName,
          dni: input.dni,
          email: input.email,
          phone: input.phone,
          totalCents: calculated.totalCents,
          expiresAt: calculated.expiresAt,
          accessTokenHash,
          requestHash: requestFingerprint(input),
          items: { create: calculated.lines },
        },
      });
      return { orderId: order.id, token: input.token };
    });
  } catch (error) {
    // Concurrent duplicate requests can race on the unique credential.
    if (
      error instanceof AppError &&
      ["DUPLICATE", "CONFLICT"].includes(error.code)
    ) {
      const existing = await getDb().order.findUnique({
        where: { accessTokenHash },
      });
      if (existing) return existingResult(existing, input);
    }
    throw error;
  }
}
export async function getOrderSummary(rawToken: string) {
  const token = tokenSchema.safeParse(rawToken);
  if (!token.success) return null;
  const where = { accessTokenHash: hashToken(token.data) };
  const identity = await getDb().order.findUnique({
    where,
    select: {
      id: true,
      eventId: true,
      status: true,
      ticketsIssuedAt: true,
      payments: {
        where: { applied: true, status: "APPROVED", reviewReason: null },
        select: { id: true },
      },
    },
  });
  if (!identity) return null;
  if (
    identity.status === "PAID" &&
    !identity.ticketsIssuedAt &&
    identity.payments.length
  )
    await ensureOrderTickets(identity.id);
  await expireReservations(identity.eventId);
  return getDb().order.findUnique({
    where,
    select: {
      id: true,
      status: true,
      totalCents: true,
      expiresAt: true,
      paymentStartedAt: true,
      notifications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
      payments: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { status: true },
      },
      event: {
        select: {
          name: true,
          slug: true,
          startsAt: true,
          timezone: true,
          venue: true,
        },
      },
      items: {
        select: {
          id: true,
          ticketTypeName: true,
          quantity: true,
          unitPriceCents: true,
        },
      },
    },
  });
}
