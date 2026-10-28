import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "../../src/lib/db";
import {
  createPendingOrder,
  expireReservations,
  getOrderSummary,
} from "../../src/modules/orders/service";
import {
  issueCheckoutToken,
  hashToken,
  verifyCheckoutToken,
} from "../../src/modules/orders/tokens";
import { checkoutSchema } from "../../src/modules/orders/validation";
import { getPublicEvent } from "../../src/modules/events/public";
process.env.AUTH_SECRET ??= "test-only-order-secret-at-least-32-characters";
const url = process.env.TEST_DATABASE_URL;
if (url && new URL(url).pathname !== "/ticketera_test")
  throw new Error("Usar ticketera_test.");
if (url) process.env.DATABASE_URL = url;
async function fixture(stock = 10) {
  const event = await getDb().event.create({
    data: {
      name: "Orden integración",
      slug: `orders-${randomUUID()}`,
      abbreviation: "ORD",
      venue: "Estadio",
      address: "Calle 123",
      startsAt: new Date("2030-10-01T12:00:00Z"),
      status: "PUBLISHED",
      ticketTypes: {
        create: {
          name: "General",
          stock,
          priceCents: 125050,
          maxPerOrder: 6,
          salesStart: new Date("2020-01-01T00:00:00Z"),
          salesEnd: new Date("2030-10-01T11:00:00Z"),
        },
      },
    },
    include: { ticketTypes: true },
  });
  const type = event.ticketTypes[0]!;
  const input = {
    eventId: event.id,
    ...issueCheckoutToken(event.id),
    firstName: "Ana",
    lastName: "Pérez",
    dni: "30123456",
    email: "ana@example.com",
    phone: "+54 11 5555 1234",
    items: [
      { ticketTypeId: type.id, quantity: 2, quotedPriceCents: type.priceCents },
    ],
  };
  return { event, type, input };
}
describe.skipIf(!url)("órdenes transaccionales", () => {
  afterAll(async () => {
    await getDb().$disconnect();
  });
  it("recalcula total, reserva sin vender, guarda precios históricos y sólo hash del acceso", async () => {
    const { input, type } = await fixture();
    const result = await createPendingOrder(input);
    const order = await getDb().order.findUniqueOrThrow({
      where: { id: result.orderId },
      include: { items: true, tickets: true },
    });
    expect(order.totalCents).toBe(250100);
    expect(order.status).toBe("PENDING");
    expect(order.accessTokenHash).toBe(hashToken(input.token));
    expect(order.tickets).toHaveLength(0);
    expect(order.items[0]?.ticketTypeName).toBe("General");
    const updated = await getDb().ticketType.findUniqueOrThrow({
      where: { id: type.id },
    });
    expect(updated.reserved).toBe(2);
    expect(updated.sold).toBe(0);
    const summary = await getOrderSummary(input.token);
    expect(summary).not.toHaveProperty("email");
    expect(summary).not.toHaveProperty("dni");
    expect(
      await getOrderSummary(issueCheckoutToken(input.eventId).token),
    ).toBeNull();
  });
  it("reenvíos concurrentes producen una sola orden y una sola reserva", async () => {
    const { input, type } = await fixture();
    const results = await Promise.all([
      createPendingOrder(input),
      createPendingOrder(input),
    ]);
    expect(results[0]?.orderId).toBe(results[1]?.orderId);
    expect(
      (await getDb().ticketType.findUniqueOrThrow({ where: { id: type.id } }))
        .reserved,
    ).toBe(2);
    await expect(
      createPendingOrder({ ...input, firstName: "Otra" }),
    ).rejects.toMatchObject({ code: "FORM_REUSED" });
  });
  it("dos compradores no pueden reservar la última entrada", async () => {
    const { input, type } = await fixture(1);
    input.items[0]!.quantity = 1;
    const second = { ...input, ...issueCheckoutToken(input.eventId) };
    const results = await Promise.allSettled([
      createPendingOrder(input),
      createPendingOrder(second),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      (await getDb().ticketType.findUniqueOrThrow({ where: { id: type.id } }))
        .reserved,
    ).toBe(1);
  });
  it("libera reservas vencidas una sola vez aun bajo concurrencia", async () => {
    const { input, type } = await fixture();
    const order = await createPendingOrder(input);
    await getDb().order.update({
      where: { id: order.orderId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await Promise.all([
      expireReservations(input.eventId),
      expireReservations(input.eventId),
    ]);
    expect(
      (await getDb().ticketType.findUniqueOrThrow({ where: { id: type.id } }))
        .reserved,
    ).toBe(0);
    expect((await getOrderSummary(input.token))?.status).toBe("EXPIRED");
    expect((await createPendingOrder(input)).orderId).toBe(order.orderId);
    expect(
      (await getDb().ticketType.findUniqueOrThrow({ where: { id: type.id } }))
        .reserved,
    ).toBe(0);
  });
  it("no libera órdenes con preferencia de pago sin conciliación", async () => {
    const { input, type } = await fixture();
    const order = await createPendingOrder(input);
    await getDb().order.update({
      where: { id: order.orderId },
      data: {
        expiresAt: new Date(Date.now() - 1000),
        preferenceId: randomUUID(),
      },
    });
    await expireReservations(input.eventId);
    expect(
      (await getDb().ticketType.findUniqueOrThrow({ where: { id: type.id } }))
        .reserved,
    ).toBe(2);
  });
  it("rechaza precio cambiado, límite de cantidad y tipo de otro torneo sin reservar", async () => {
    const { input, type } = await fixture();
    await expect(
      createPendingOrder({
        ...input,
        items: [{ ...input.items[0], quotedPriceCents: 1 }],
      }),
    ).rejects.toMatchObject({ code: "PRICE_CHANGED" });
    await expect(
      createPendingOrder({
        ...input,
        items: [{ ...input.items[0], quantity: 7 }],
      }),
    ).rejects.toMatchObject({ code: "QUANTITY_LIMIT" });
    const other = await fixture();
    await expect(
      createPendingOrder({
        ...input,
        items: [{ ...input.items[0], ticketTypeId: other.type.id }],
      }),
    ).rejects.toMatchObject({ code: "TYPE_UNAVAILABLE" });
    expect(
      (await getDb().ticketType.findUniqueOrThrow({ where: { id: type.id } }))
        .reserved,
    ).toBe(0);
  });
  it("rechaza torneos pausados y períodos cerrados", async () => {
    const { input, type } = await fixture();
    await getDb().event.update({
      where: { id: input.eventId },
      data: { status: "SALES_PAUSED" },
    });
    await expect(createPendingOrder(input)).rejects.toMatchObject({
      code: "SALES_CLOSED",
    });
    await getDb().event.update({
      where: { id: input.eventId },
      data: { status: "PUBLISHED" },
    });
    await getDb().ticketType.update({
      where: { id: type.id },
      data: { salesEnd: new Date("2025-01-01T00:00:00Z") },
    });
    await expect(createPendingOrder(input)).rejects.toMatchObject({
      code: "TYPE_UNAVAILABLE",
    });
  });
  it("oculta borradores y no publica datos de compradores", async () => {
    const { event } = await fixture();
    await getDb().event.update({
      where: { id: event.id },
      data: { status: "DRAFT" },
    });
    expect(await getPublicEvent(event.slug)).toBeNull();
  });
});
describe("credenciales y entradas de compra", () => {
  it("token aleatorio firmado, sin datos personales y ligado al torneo", () => {
    const a = issueCheckoutToken("event-a"),
      b = issueCheckoutToken("event-a");
    expect(a.token).not.toBe(b.token);
    expect(a.token).toHaveLength(43);
    expect(() =>
      verifyCheckoutToken({ eventId: "event-a", ...a }),
    ).not.toThrow();
    expect(() => verifyCheckoutToken({ eventId: "event-b", ...a })).toThrow();
    expect(() =>
      verifyCheckoutToken(
        { eventId: "event-a", ...a },
        a.issuedAt + 31 * 60000,
      ),
    ).toThrow();
  });
  it("rechaza cantidades negativas, duplicadas y totales enviados por el navegador", () => {
    const input = {
      eventId: "cmg12345678901234567890123",
      ...issueCheckoutToken("cmg12345678901234567890123"),
      firstName: "Ana",
      lastName: "Pérez",
      dni: "30123456",
      email: "ana@example.com",
      phone: "1155551234",
      items: [
        {
          ticketTypeId: "cmg12345678901234567890124",
          quantity: 1,
          quotedPriceCents: 100,
        },
      ],
    };
    expect(checkoutSchema.safeParse(input).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...input, totalCents: 1 }).success).toBe(
      false,
    );
    expect(
      checkoutSchema.safeParse({
        ...input,
        items: [...input.items, ...input.items],
      }).success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({
        ...input,
        items: [{ ...input.items[0], quantity: -1 }],
      }).success,
    ).toBe(false);
  });
});
