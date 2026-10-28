import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../src/lib/db";
import {
  createPendingOrder,
  expireReservations,
} from "../../src/modules/orders/service";
import { issueCheckoutToken } from "../../src/modules/orders/tokens";
import {
  startPayment,
  syncPayment,
  reconcileOrder,
} from "../../src/modules/payments/service";
import { verifyPaymentSignature } from "../../src/modules/payments/signature";
import { safeCheckoutUrl } from "../../src/modules/payments/provider";
import { POST } from "../../src/app/api/payments/webhook/route";
import { GET as cron } from "../../src/app/api/payments/reconcile/route";
const url = process.env.TEST_DATABASE_URL;
if (url && new URL(url).pathname !== "/ticketera_test")
  throw new Error("Usar ticketera_test.");
if (url) process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ||= "test-only-order-secret-at-least-32-characters";
const secret = "test-only-webhook-secret-32-characters";
function signedHeaders(id: string, timestamp = Date.now()) {
  const ts = String(timestamp),
    requestId = randomUUID();
  const hash = createHmac("sha256", secret)
    .update(`id:${id};request-id:${requestId};ts:${ts};`)
    .digest("hex");
  return new Headers({
    "x-request-id": requestId,
    "x-signature": `ts=${ts},v1=${hash}`,
  });
}
describe("firma y redirección de pagos", () => {
  it("acepta segundos y milisegundos; rechaza firma inválida, ID cambiado y replay viejo", () => {
    expect(() =>
      verifyPaymentSignature(signedHeaders("123"), "123", secret),
    ).not.toThrow();
    expect(() =>
      verifyPaymentSignature(
        signedHeaders("123", Math.floor(Date.now() / 1000)),
        "123",
        secret,
      ),
    ).not.toThrow();
    expect(() =>
      verifyPaymentSignature(signedHeaders("123"), "124", secret),
    ).toThrow();
    expect(() =>
      verifyPaymentSignature(
        signedHeaders("123", Date.now() - 360000),
        "123",
        secret,
      ),
    ).toThrow();
    expect(() =>
      verifyPaymentSignature(new Headers(), "123", secret),
    ).toThrow();
  });
  it("no permite redirecciones fuera de Mercado Pago ni credenciales en la URL", () => {
    expect(
      safeCheckoutUrl(
        "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test",
      ),
    ).toContain("mercadopago");
    for (const value of [
      "https://evil.example",
      "https://www.mercadopago.com.ar.evil.example",
      "javascript:alert(1)",
      "https://user@www.mercadopago.com.ar/pay",
    ])
      expect(() => safeCheckoutUrl(value)).toThrow();
  });
});
describe.skipIf(!url)("pagos con PostgreSQL y proveedor simulado", () => {
  const remote = new Map<string, Record<string, unknown>>();
  const fetchMock = vi.fn<typeof fetch>();
  let preferenceCalls = 0;
  let lastPreference: Record<string, unknown>;
  beforeEach(() => {
    vi.stubEnv("TICKET_ENCRYPTION_KEY", "11".repeat(32));
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("APP_URL", "https://tickets.example.com");
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "TEST-only-provider-token");
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", secret);
    vi.stubEnv("MERCADOPAGO_COLLECTOR_ID", "12345");
    vi.stubEnv("MERCADOPAGO_MODE", "test");
    remote.clear();
    preferenceCalls = 0;
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input, init) => {
      const request = new URL(String(input));
      expect(request.origin).toBe("https://api.mercadopago.com");
      if (request.pathname === "/checkout/preferences") {
        preferenceCalls++;
        lastPreference = JSON.parse(String(init?.body));
        return Response.json({
          id: randomUUID(),
          collector_id: 12345,
          init_point:
            "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test",
          sandbox_init_point:
            "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=test",
        });
      }
      if (request.pathname === "/v1/payments/search") {
        const results = [...remote.values()].filter(
          (payment) =>
            payment.external_reference ===
            request.searchParams.get("external_reference"),
        );
        return Response.json({ results, paging: { total: results.length } });
      }
      const payment = remote.get(request.pathname.split("/").pop()!);
      return payment
        ? Response.json(payment)
        : new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await getDb().$disconnect();
  });
  async function fixture() {
    const event = await getDb().event.create({
      data: {
        slug: `payments-${randomUUID()}`,
        name: "Copa pagos",
        abbreviation: "PAY",
        venue: "Estadio",
        address: "Calle 123",
        startsAt: new Date("2030-10-01T12:00:00Z"),
        status: "PUBLISHED",
        ticketTypes: {
          create: {
            name: "General",
            priceCents: 125050,
            stock: 2,
            maxPerOrder: 2,
            salesStart: new Date("2020-01-01"),
            salesEnd: new Date("2030-10-01"),
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
      email: "ana@example.com",
      dni: "30123456",
      phone: "1155551234",
      items: [
        {
          ticketTypeId: type.id,
          quantity: 2,
          quotedPriceCents: type.priceCents,
        },
      ],
    };
    const order = await createPendingOrder(input);
    return { ...order, input, event, type };
  }
  function payment(orderId: string, overrides: Record<string, unknown> = {}) {
    const value = {
      id: String(Math.floor(Math.random() * 1e12)),
      external_reference: orderId,
      collector_id: 12345,
      live_mode: false,
      currency_id: "ARS",
      transaction_amount: 2501,
      transaction_amount_refunded: 0,
      status: "approved",
      date_last_updated: new Date().toISOString(),
      ...overrides,
    };
    remote.set(String(value.id), value);
    return value;
  }
  async function stock(id: string) {
    const type = await getDb().ticketType.findUniqueOrThrow({ where: { id } });
    return [type.reserved, type.sold];
  }
  async function expire(id: string) {
    await getDb().order.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 6 * 60000) },
    });
  }
  it("crea una sola preferencia concurrente, usa precios del servidor y reutiliza el enlace", async () => {
    const order = await fixture();
    const result = await Promise.allSettled([
      startPayment(order.token),
      startPayment(order.token),
    ]);
    expect(result.some((item) => item.status === "fulfilled")).toBe(true);
    expect(preferenceCalls).toBe(1);
    expect(lastPreference.external_reference).toBe(order.orderId);
    expect(lastPreference.items).toEqual([
      expect.objectContaining({
        quantity: 2,
        unit_price: 1250.5,
        currency_id: "ARS",
      }),
    ]);
    expect(lastPreference).toMatchObject({
      binary_mode: true,
      expires: true,
      notification_url: "https://tickets.example.com/api/payments/webhook",
    });
    expect(await startPayment(order.token)).toContain("sandbox.mercadopago");
    expect(preferenceCalls).toBe(1);
  });
  it("un fallo ambiguo no vuelve a crear preferencias ni libera stock sin conciliar", async () => {
    const order = await fixture();
    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    await expect(startPayment(order.token)).rejects.toMatchObject({
      code: "PAYMENT_PROVIDER",
    });
    await expect(startPayment(order.token)).rejects.toMatchObject({
      code: "PAYMENT_PROCESSING",
    });
    await expire(order.orderId);
    await expireReservations(order.event.id);
    expect(await stock(order.type.id)).toEqual([2, 0]);
    await reconcileOrder(order.orderId);
    expect(await stock(order.type.id)).toEqual([0, 0]);
  });
  it("webhooks concurrentes aprobados confirman una vez y un retorno inventado no se usa", async () => {
    const order = await fixture();
    await startPayment(order.token);
    const value = payment(order.orderId);
    const requests = Array.from(
      { length: 2 },
      () =>
        new Request(
          `https://tickets.example.com/api/payments/webhook?data.id=${value.id}&type=payment`,
          {
            method: "POST",
            headers: signedHeaders(value.id),
            body: JSON.stringify({ status: "rejected", transaction_amount: 1 }),
          },
        ),
    );
    const responses = await Promise.all(requests.map(POST));
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await stock(order.type.id)).toEqual([0, 2]);
    expect(
      (await getDb().order.findUniqueOrThrow({ where: { id: order.orderId } }))
        .status,
    ).toBe("PAID");
    expect(
      await getDb().payment.count({ where: { orderId: order.orderId } }),
    ).toBe(1);
  });
  it("no consulta al proveedor con firma falsa y rechaza cron no autorizado", async () => {
    const response = await POST(
      new Request(
        "https://tickets.example.com/api/payments/webhook?data.id=123&type=payment",
        { method: "POST" },
      ),
    );
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      (
        await cron(
          new Request("https://tickets.example.com/api/payments/reconcile"),
        )
      ).status,
    ).toBe(401);
  });
  it("un error de Mercado Pago responde reintentable y conserva la reserva", async () => {
    const order = await fixture();
    await startPayment(order.token);
    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    expect(
      (
        await POST(
          new Request(
            "https://tickets.example.com/api/payments/webhook?data.id=123&type=payment",
            { method: "POST", headers: signedHeaders("123") },
          ),
        )
      ).status,
    ).toBe(503);
    expect(await stock(order.type.id)).toEqual([2, 0]);
  });
  it("un rechazo permite reintentar y sólo libera la reserva vencida tras conciliar", async () => {
    const order = await fixture();
    await startPayment(order.token);
    const value = payment(order.orderId, { status: "rejected" });
    await syncPayment(value.id);
    expect(await stock(order.type.id)).toEqual([2, 0]);
    await startPayment(order.token);
    expect(preferenceCalls).toBe(1);
    await expire(order.orderId);
    await Promise.all([
      reconcileOrder(order.orderId),
      reconcileOrder(order.orderId),
    ]);
    expect(await stock(order.type.id)).toEqual([0, 0]);
    expect(
      (await getDb().order.findUniqueOrThrow({ where: { id: order.orderId } }))
        .status,
    ).toBe("REJECTED");
  });
  it("retiene pagos en proceso y ante fallas de conciliación", async () => {
    const order = await fixture();
    await startPayment(order.token);
    payment(order.orderId, { status: "in_process" });
    await expire(order.orderId);
    await reconcileOrder(order.orderId);
    expect(await stock(order.type.id)).toEqual([2, 0]);
    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    await expect(reconcileOrder(order.orderId)).rejects.toThrow();
    expect(await stock(order.type.id)).toEqual([2, 0]);
  });
  it.each([{ transaction_amount: 1 }, { currency_id: "USD" }])(
    "no acredita importes o monedas diferentes: %j",
    async (overrides) => {
      const order = await fixture();
      await startPayment(order.token);
      const value = payment(order.orderId, overrides);
      await syncPayment(value.id);
      expect(await stock(order.type.id)).toEqual([2, 0]);
      expect(
        (
          await getDb().order.findUniqueOrThrow({
            where: { id: order.orderId },
          })
        ).status,
      ).toBe("PAYMENT_REVIEW");
    },
  );
  it.each([{ collector_id: 999 }, { live_mode: true }])(
    "rechaza otra cuenta o ambiente: %j",
    async (overrides) => {
      const order = await fixture();
      await startPayment(order.token);
      const value = payment(order.orderId, overrides);
      await expect(syncPayment(value.id)).rejects.toMatchObject({
        code: "PAYMENT_ACCOUNT",
      });
      expect(await stock(order.type.id)).toEqual([2, 0]);
    },
  );
  it("pago tardío vuelve a comprobar stock; si se vendió no sobrevende", async () => {
    const order = await fixture();
    await startPayment(order.token);
    await expire(order.orderId);
    await reconcileOrder(order.orderId);
    await createPendingOrder({
      ...order.input,
      ...issueCheckoutToken(order.event.id),
    });
    const value = payment(order.orderId);
    await syncPayment(value.id);
    expect(await stock(order.type.id)).toEqual([2, 0]);
    expect(
      (
        await getDb().payment.findUniqueOrThrow({
          where: { providerId: value.id },
        })
      ).reviewReason,
    ).toBe("LATE_PAYMENT_NO_STOCK");
  });
  it("pago tardío con stock disponible confirma sin reserva negativa", async () => {
    const order = await fixture();
    await startPayment(order.token);
    await expire(order.orderId);
    await reconcileOrder(order.orderId);
    const value = payment(order.orderId);
    await syncPayment(value.id);
    expect(await stock(order.type.id)).toEqual([0, 2]);
  });
  it("un segundo pago aprobado queda para revisión sin duplicar venta", async () => {
    const order = await fixture();
    await startPayment(order.token);
    const a = payment(order.orderId),
      b = payment(order.orderId);
    await Promise.all([syncPayment(a.id), syncPayment(b.id)]);
    expect(await stock(order.type.id)).toEqual([0, 2]);
    const saved = await getDb().payment.findMany({
      where: { orderId: order.orderId },
    });
    expect(saved.filter((item) => item.applied)).toHaveLength(1);
    expect(
      saved.filter((item) => item.reviewReason === "DUPLICATE_PAYMENT"),
    ).toHaveLength(1);
  });
  it("ignora notificaciones antiguas y registra reembolso sin revender automáticamente", async () => {
    const order = await fixture();
    await startPayment(order.token);
    const value = payment(order.orderId);
    await syncPayment(value.id);
    remote.set(value.id, {
      ...value,
      status: "pending",
      date_last_updated: new Date(Date.now() - 10000).toISOString(),
    });
    await syncPayment(value.id);
    expect(
      (await getDb().order.findUniqueOrThrow({ where: { id: order.orderId } }))
        .status,
    ).toBe("PAID");
    remote.set(value.id, {
      ...value,
      status: "refunded",
      date_last_updated: new Date(Date.now() + 1000).toISOString(),
    });
    await syncPayment(value.id);
    expect(
      (await getDb().order.findUniqueOrThrow({ where: { id: order.orderId } }))
        .status,
    ).toBe("PAYMENT_REVIEW");
    expect(await stock(order.type.id)).toEqual([0, 2]);
  });
  it("reembolsar un pago duplicado no revoca el pago aplicado de la compra", async () => {
    const order = await fixture();
    await startPayment(order.token);
    const first = payment(order.orderId);
    await syncPayment(first.id);
    const duplicate = payment(order.orderId);
    await syncPayment(duplicate.id);
    remote.set(duplicate.id, {
      ...duplicate,
      status: "refunded",
      date_last_updated: new Date(Date.now() + 1000).toISOString(),
    });
    await syncPayment(duplicate.id);
    expect(
      (await getDb().order.findUniqueOrThrow({ where: { id: order.orderId } }))
        .status,
    ).toBe("PAID");
    expect(await stock(order.type.id)).toEqual([0, 2]);
  });
  it("consulta por ID un intento conocido aunque la búsqueda no lo devuelva", async () => {
    const order = await fixture();
    await startPayment(order.token);
    const value = payment(order.orderId, { status: "pending" });
    await syncPayment(value.id);
    remote.set(value.id, {
      ...value,
      status: "approved",
      date_last_updated: new Date(Date.now() + 1000).toISOString(),
    });
    fetchMock.mockResolvedValueOnce(
      Response.json({ results: [], paging: { total: 0 } }),
    );
    await reconcileOrder(order.orderId);
    expect(await stock(order.type.id)).toEqual([0, 2]);
  });
  it("no inicia cobros sin configuración ni para órdenes vencidas", async () => {
    const order = await fixture();
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "");
    await expect(startPayment(order.token)).rejects.toMatchObject({
      code: "PAYMENTS_DISABLED",
    });
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "TEST-only-provider-token");
    await expire(order.orderId);
    await expect(startPayment(order.token)).rejects.toMatchObject({
      code: "PAYMENT_CLOSED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
