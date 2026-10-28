import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { PDFDocument } from "pdf-lib";
import { getDb } from "../../src/lib/db";
import { hashToken, issueCheckoutToken } from "../../src/modules/orders/tokens";
import { encryptSecret, decryptSecret } from "../../src/modules/tickets/crypto";
import { ensureOrderTickets } from "../../src/modules/tickets/issuance";
import { getOrderTickets, getTicket } from "../../src/modules/tickets/service";
import { ticketQr, ticketUrl } from "../../src/modules/tickets/presentation";
import { createTicketPdf } from "../../src/modules/tickets/pdf";
import { deliverEmail } from "../../src/modules/notifications/service";
import { GET as download } from "../../src/app/api/tickets/[token]/pdf/route";
const url = process.env.TEST_DATABASE_URL;
if (url && new URL(url).pathname !== "/ticketera_test")
  throw new Error("Usar ticketera_test.");
if (url) process.env.DATABASE_URL = url;
const api = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubEnv("TICKET_ENCRYPTION_KEY", "33".repeat(32));
  vi.stubEnv("AUTH_SECRET", "ticket-test-only-secret-32-characters");
  vi.stubEnv("APP_URL", "https://tickets.example.com");
  vi.stubEnv("RESEND_API_KEY", "re_test_only");
  vi.stubEnv("EMAIL_FROM", "entradas@example.com");
  api.mockReset();
  api.mockResolvedValue(Response.json({ id: randomUUID() }));
  vi.stubGlobal("fetch", api);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("credenciales de entrada", () => {
  it("cifra con IV aleatorio, autentica el contexto y detecta manipulación", () => {
    const token = issueCheckoutToken("fixture").token;
    const a = encryptSecret(token, "ticket:1"),
      b = encryptSecret(token, "ticket:1");
    expect(a).not.toBe(b);
    expect(a).not.toContain(token);
    expect(decryptSecret(a, "ticket:1")).toBe(token);
    expect(() => decryptSecret(a, "ticket:2")).toThrow();
    const parts = a.split(".");
    parts[3] = `${parts[3]![0] === "A" ? "B" : "A"}${parts[3]!.slice(1)}`;
    expect(() => decryptSecret(parts.join("."), "ticket:1")).toThrow();
  });
  it("el QR se decodifica y sólo contiene la URL con credencial aleatoria", async () => {
    const token = issueCheckoutToken("fixture").token;
    const png = PNG.sync.read(
      Buffer.from((await ticketQr(token)).split(",")[1]!, "base64"),
    );
    const decoded = jsQR(
      new Uint8ClampedArray(png.data),
      png.width,
      png.height,
    );
    expect(decoded?.data).toBe(ticketUrl(token));
    expect(decoded?.data).toMatch(
      /^https:\/\/tickets\.example\.com\/entrada\/[\w-]{43}$/,
    );
  });
});
describe.skipIf(!url)("emisión, descarga y envío transaccional", () => {
  afterAll(async () => {
    await getDb().$disconnect();
  });
  async function fixture(eventId?: string) {
    const event = eventId
      ? await getDb().event.findUniqueOrThrow({
          where: { id: eventId },
          include: { ticketTypes: true },
        })
      : await getDb().event.create({
          data: {
            slug: `ticket-${randomUUID()}`,
            name: "Torneo de karate · Copa Kenshukan",
            abbreviation: "TST",
            venue: "Polideportivo Municipal",
            address: "Av. San Martín 123, Buenos Aires",
            conditions:
              "Entrada válida para un único ingreso. Presentá este código en la puerta. Los menores deben asistir acompañados.",
            startsAt: new Date("2030-10-20T13:00:00Z"),
            status: "PUBLISHED",
            ticketTypes: {
              create: {
                name: "General",
                stock: 100,
                sold: 2,
                priceCents: 10000,
                salesStart: new Date("2020-01-01"),
                salesEnd: new Date("2030-10-20"),
              },
            },
          },
          include: { ticketTypes: true },
        });
    const token = issueCheckoutToken(event.id).token;
    const order = await getDb().order.create({
      data: {
        eventId: event.id,
        status: "PAID",
        paidAt: new Date(),
        reservationHeld: false,
        paymentStartedAt: new Date(),
        firstName: "María José",
        lastName: "Pérez",
        dni: "30123456",
        email: "buyer@example.com",
        phone: "1155551234",
        accessTokenHash: hashToken(token),
        totalCents: 20000,
        expiresAt: new Date(Date.now() + 600000),
        items: {
          create: {
            ticketTypeId: event.ticketTypes[0]!.id,
            ticketTypeName: "General",
            quantity: 2,
            unitPriceCents: 10000,
          },
        },
        payments: {
          create: {
            providerId: randomUUID(),
            status: "APPROVED",
            applied: true,
            amountCents: 20000,
            providerStatus: "approved",
          },
        },
      },
    });
    return { event, order, token };
  }
  async function issued() {
    const data = await fixture();
    await ensureOrderTickets(data.order.id);
    const links = await getOrderTickets(data.token);
    const job = await getDb().ticketEmail.findFirstOrThrow({
      where: { orderId: data.order.id },
    });
    return { ...data, links, job };
  }
  it("emisión simultánea produce una entrada por unidad y un único envío inicial", async () => {
    const { order, token } = await fixture();
    await Promise.all([
      ensureOrderTickets(order.id),
      ensureOrderTickets(order.id),
    ]);
    const tickets = await getDb().ticket.findMany({
      where: { orderId: order.id },
    });
    expect(tickets).toHaveLength(2);
    expect(new Set(tickets.map((ticket) => ticket.number)).size).toBe(2);
    const links = await getOrderTickets(token);
    expect(new Set(links.map((link) => link.token)).size).toBe(2);
    expect(tickets[0]!.tokenEncrypted).not.toContain(links[0]!.token);
    expect(tickets.map((ticket) => ticket.itemOrdinal).sort()).toEqual([1, 2]);
    expect(
      await getDb().ticketEmail.count({ where: { orderId: order.id } }),
    ).toBe(1);
    const before = links.map((link) => link.token);
    await ensureOrderTickets(order.id);
    expect((await getOrderTickets(token)).map((link) => link.token)).toEqual(
      before,
    );
  });
  it("dos órdenes y dos torneos con la misma sigla no duplican números", async () => {
    const a = await fixture(),
      b = await fixture(a.event.id),
      c = await fixture();
    await Promise.all([
      ensureOrderTickets(a.order.id),
      ensureOrderTickets(b.order.id),
    ]);
    await ensureOrderTickets(c.order.id);
    const tickets = await getDb().ticket.findMany({
      where: { orderId: { in: [a.order.id, b.order.id, c.order.id] } },
    });
    expect(new Set(tickets.map((ticket) => ticket.number)).size).toBe(6);
    expect(
      tickets.every((ticket) => /^TST-2030-\d{6,}$/.test(ticket.number)),
    ).toBe(true);
  });
  it("no emite una orden sin pago aplicado ni una orden pendiente", async () => {
    const { order } = await fixture();
    await getDb().payment.deleteMany({ where: { orderId: order.id } });
    await expect(ensureOrderTickets(order.id)).rejects.toMatchObject({
      code: "UNVERIFIED_ORDER",
    });
    expect(await getDb().ticket.count({ where: { orderId: order.id } })).toBe(
      0,
    );
    await getDb().order.update({
      where: { id: order.id },
      data: { status: "PENDING" },
    });
    await ensureOrderTickets(order.id);
    expect(await getDb().ticket.count({ where: { orderId: order.id } })).toBe(
      0,
    );
  });
  it("sin clave válida no deja emisión parcial ni marca de emisión", async () => {
    const { order } = await fixture();
    vi.stubEnv("TICKET_ENCRYPTION_KEY", "");
    await expect(ensureOrderTickets(order.id)).rejects.toThrow();
    expect(await getDb().ticket.count({ where: { orderId: order.id } })).toBe(
      0,
    );
    expect(
      (await getDb().order.findUniqueOrThrow({ where: { id: order.id } }))
        .ticketsIssuedAt,
    ).toBeNull();
  });
  it("acceso privado no expone DNI/email y tokens desconocidos no funcionan", async () => {
    const { links } = await issued();
    const ticket = await getTicket(links[0]!.token);
    expect(ticket?.usable).toBe(true);
    expect(ticket).not.toHaveProperty("email");
    expect(ticket).not.toHaveProperty("dni");
    expect(await getTicket(issueCheckoutToken("unknown").token)).toBeNull();
    expect(await getTicket(ticket!.number)).toBeNull();
  });
  it("PDF descargable con fuentes y QR, y condiciones extensas sin truncar páginas", async () => {
    const { links } = await issued();
    const ticket = (await getTicket(links[0]!.token))!;
    const pdf = await createTicketPdf(ticket);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
    await mkdir("tmp/pdfs", { recursive: true });
    await writeFile("tmp/pdfs/ticket-sample.pdf", pdf);
    const long = await createTicketPdf({
      ...ticket,
      event: {
        ...ticket.event,
        name: "Copa internacional de karate ".repeat(6),
        conditions:
          "Condición de acceso: respetar las indicaciones de la organización. ".repeat(
            80,
          ),
      },
    });
    expect((await PDFDocument.load(long)).getPageCount()).toBeGreaterThan(1);
    await writeFile("tmp/pdfs/ticket-long-sample.pdf", long);
    const response = await download(
      new Request("https://tickets.example.com"),
      { params: Promise.resolve({ token: links[0]!.token }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-type")).toBe("application/pdf");
  });
  it("no descarga ni muestra como válida una entrada anulada o un pago revertido", async () => {
    const { links, order, token } = await issued();
    await getDb().ticket.updateMany({
      where: { orderId: order.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: "Anulación de prueba",
      },
    });
    expect((await getTicket(links[0]!.token))?.usable).toBe(false);
    expect(
      (
        await download(new Request("https://tickets.example.com"), {
          params: Promise.resolve({ token: links[0]!.token }),
        })
      ).status,
    ).toBe(409);
    await getDb().order.update({
      where: { id: order.id },
      data: { status: "PAYMENT_REVIEW" },
    });
    expect(await getOrderTickets(token)).toEqual([]);
  });
  it("envío concurrente usa una sola solicitud y el mismo QR; no emite de nuevo", async () => {
    const { job, order, links } = await issued();
    await Promise.all([deliverEmail(job.id), deliverEmail(job.id)]);
    await deliverEmail(job.id);
    expect(api).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(api.mock.calls[0]![1]!.body));
    expect(payload.html).toContain(ticketUrl(links[0]!.token));
    expect(payload.to).toEqual(["buyer@example.com"]);
    expect(
      (api.mock.calls[0]![1]!.headers as Record<string, string>)[
        "Idempotency-Key"
      ],
    ).toBe(`tickets/${job.id}`);
    expect(await getDb().ticket.count({ where: { orderId: order.id } })).toBe(
      2,
    );
    const saved = await getDb().ticketEmail.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(saved.status).toBe("SENT");
    expect(saved.payloadEncrypted).not.toContain("buyer@example.com");
  });
  it("fallo de correo conserva pago y entradas y reintenta el mismo contenido", async () => {
    const { job, order, event } = await issued();
    api.mockRejectedValueOnce(new Error("timeout"));
    await deliverEmail(job.id);
    expect(
      (await getDb().order.findUniqueOrThrow({ where: { id: order.id } }))
        .status,
    ).toBe("PAID");
    expect(await getDb().ticket.count({ where: { orderId: order.id } })).toBe(
      2,
    );
    await getDb().event.update({
      where: { id: event.id },
      data: { name: "Nombre cambiado" },
    });
    await getDb().ticketEmail.update({
      where: { id: job.id },
      data: { nextAttemptAt: new Date(0) },
    });
    await deliverEmail(job.id);
    expect(api).toHaveBeenCalledTimes(2);
    expect(api.mock.calls[0]![1]!.body).toBe(api.mock.calls[1]![1]!.body);
    expect(
      (await getDb().ticketEmail.findUniqueOrThrow({ where: { id: job.id } }))
        .status,
    ).toBe("SENT");
  });
  it("envío incierto fuera de la ventana de idempotencia requiere revisión", async () => {
    const { job } = await issued();
    await getDb().ticketEmail.update({
      where: { id: job.id },
      data: {
        status: "SENDING",
        firstAttemptAt: new Date(Date.now() - 24 * 3600000),
        leaseUntil: new Date(0),
        attempts: 1,
      },
    });
    await deliverEmail(job.id);
    expect(api).not.toHaveBeenCalled();
    expect(
      (await getDb().ticketEmail.findUniqueOrThrow({ where: { id: job.id } }))
        .status,
    ).toBe("REVIEW");
  });
  it("sin Resend no hay llamadas externas; una compra revertida cancela el envío pendiente", async () => {
    const { job, order } = await issued();
    vi.stubEnv("RESEND_API_KEY", "");
    await deliverEmail(job.id);
    expect(api).not.toHaveBeenCalled();
    vi.stubEnv("RESEND_API_KEY", "re_test_only");
    await getDb().order.update({
      where: { id: order.id },
      data: { status: "PAYMENT_REVIEW" },
    });
    await deliverEmail(job.id);
    expect(api).not.toHaveBeenCalled();
    expect(
      (await getDb().ticketEmail.findUniqueOrThrow({ where: { id: job.id } }))
        .status,
    ).toBe("CANCELLED");
  });
});
