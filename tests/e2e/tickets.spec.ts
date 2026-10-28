import "dotenv/config";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PNG } from "pngjs";
import jsQR from "jsqr";
function database() {
  const url = process.env.TEST_DATABASE_URL!;
  if (new URL(url).pathname !== "/ticketera_test")
    throw new Error("Usar ticketera_test.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}
test.describe("entradas digitales", () => {
  test.skip(process.env.E2E_DATABASE !== "1", "Requiere PostgreSQL aislado.");
  test("orden confirmada, QR individual, PDF e invalidación", async ({
    page,
  }, info) => {
    const db = database();
    try {
      const event = await db.event.create({
        data: {
          slug: `e2e-ticket-${randomUUID()}`,
          name: "Copa Kenshukan · Entradas digitales",
          abbreviation: "TKT",
          venue: "Polideportivo Municipal",
          address: "Av. San Martín 123",
          status: "PUBLISHED",
          startsAt: new Date("2030-10-20T13:00:00Z"),
          ticketTypes: {
            create: {
              name: "General",
              priceCents: 10000,
              stock: 10,
              sold: 2,
              salesStart: new Date("2020-01-01"),
              salesEnd: new Date("2030-10-20"),
            },
          },
        },
        include: { ticketTypes: true },
      });
      const token = randomBytes(32).toString("base64url");
      const order = await db.order.create({
        data: {
          eventId: event.id,
          status: "PAID",
          paidAt: new Date(),
          reservationHeld: false,
          paymentStartedAt: new Date(),
          firstName: "María José",
          lastName: "Pérez",
          email: "private@example.com",
          dni: "30123456",
          phone: "1155551234",
          totalCents: 20000,
          accessTokenHash: createHash("sha256").update(token).digest("hex"),
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
            },
          },
        },
      });
      await page.goto(`/checkout/${token}`);
      const links = page.getByRole("link", { name: /^Ver entrada TKT/ });
      await expect(links).toHaveCount(2);
      const first = await links.first().getAttribute("href");
      expect(first).not.toBe(await links.last().getAttribute("href"));
      await links.first().click();
      await expect(
        page.getByText("Entrada válida", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("María José Pérez", { exact: true }),
      ).toBeVisible();
      await expect(page.locator("body")).not.toContainText("30123456");
      await expect(page.locator("body")).not.toContainText(
        "private@example.com",
      );
      const qr = page.getByAltText("Código QR individual de esta entrada");
      const bytes = Buffer.from(
        (await qr.getAttribute("src"))!.split(",")[1]!,
        "base64",
      );
      const png = PNG.sync.read(bytes);
      expect(
        jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data,
      ).toBe(page.url());
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/ticket-${info.project.name}.png`,
        fullPage: true,
      });
      const pendingDownload = page.waitForEvent("download");
      await page.getByRole("link", { name: "Descargar PDF" }).click();
      const download = await pendingDownload;
      const file = `test-results/ticket-${info.project.name}.pdf`;
      await download.saveAs(file);
      expect((await readFile(file)).subarray(0, 5).toString()).toBe("%PDF-");
      await page.emulateMedia({ media: "print" });
      await expect(page.locator("header")).toBeHidden();
      await expect(
        page.getByRole("link", { name: "Descargar PDF" }),
      ).toBeHidden();
      await page.screenshot({
        path: `test-results/ticket-print-${info.project.name}.png`,
        fullPage: true,
      });
      await page.emulateMedia({ media: "screen" });
      await db.ticket.updateMany({
        where: { orderId: order.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "Anulación de prueba E2E",
        },
      });
      await page.reload();
      await expect(
        page.getByText("Entrada anulada", { exact: true }),
      ).toBeVisible();
      await expect(qr).toHaveCount(0);
      const ticketToken = first!.split("/").pop()!;
      expect(
        (await page.request.get(`/api/tickets/${ticketToken}/pdf`)).status(),
      ).toBe(409);
    } finally {
      await db.$disconnect();
    }
  });
  test("credenciales desconocidas y acceso restringido al panel de entradas", async ({
    page,
    browser,
  }) => {
    await page.goto(`/entrada/${"z".repeat(43)}`);
    await expect(
      page.getByRole("heading", { name: "No encontramos esta página" }),
    ).toBeVisible();
    expect(
      (await page.request.get(`/api/tickets/${"z".repeat(43)}/pdf`)).status(),
    ).toBe(404);
    const context = await browser.newContext({
      storageState: "tests/.auth/controller.json",
    });
    try {
      const controller = await context.newPage();
      await controller.goto("http://localhost:3107/admin/entradas");
      await expect(controller).toHaveURL(/\/scanner$/);
    } finally {
      await context.close();
    }
  });
});
