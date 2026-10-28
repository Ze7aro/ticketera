import "dotenv/config";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
test.describe("estados de pago", () => {
  test.skip(process.env.E2E_DATABASE !== "1", "Requiere PostgreSQL aislado.");
  let paidToken: string;
  let reviewToken: string;
  test.beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL!;
    if (new URL(url).pathname !== "/ticketera_test")
      throw new Error("Usar ticketera_test.");
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    try {
      const event = await db.event.create({
        data: {
          slug: `e2e-pagos-${randomUUID()}`,
          name: "Copa de conciliación",
          abbreviation: "PAY",
          venue: "Polideportivo",
          address: "Calle 123",
          startsAt: new Date("2030-10-20T13:00:00Z"),
          status: "PUBLISHED",
          ticketTypes: {
            create: {
              name: "General",
              priceCents: 10000,
              stock: 10,
              sold: 1,
              reserved: 1,
              salesStart: new Date("2020-01-01"),
              salesEnd: new Date("2030-10-01"),
            },
          },
        },
        include: { ticketTypes: true },
      });
      for (const status of ["PAID", "PAYMENT_REVIEW"] as const) {
        const token = randomBytes(32).toString("base64url");
        if (status === "PAID") paidToken = token;
        else reviewToken = token;
        await db.order.create({
          data: {
            eventId: event.id,
            status,
            firstName: "Test",
            lastName: "Privado",
            email: "private-buyer@example.com",
            dni: "30123456",
            phone: "1155551234",
            totalCents: 10000,
            accessTokenHash: createHash("sha256").update(token).digest("hex"),
            expiresAt: new Date(Date.now() + 600000),
            paidAt: status === "PAID" ? new Date() : null,
            reservationHeld: status !== "PAID",
            paymentStartedAt: new Date(),
            items: {
              create: {
                ticketTypeId: event.ticketTypes[0]!.id,
                ticketTypeName: "General",
                quantity: 1,
                unitPriceCents: 10000,
              },
            },
          },
        });
      }
    } finally {
      await db.$disconnect();
    }
  });
  test("aprobado y revisión muestran estados claros sin datos privados", async ({
    page,
  }, info) => {
    await page.goto(`/checkout/${paidToken}?status=rejected`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Pago aprobado",
    );
    await expect(
      page.getByText(/este resumen no es una entrada/),
    ).toBeVisible();
    await page.goto(`/checkout/${reviewToken}?status=approved`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Pago en revisión",
    );
    await expect(page.getByText(/No vuelvas a pagar/)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      "private-buyer@example.com",
    );
    await expect(page.locator("body")).not.toContainText("30123456");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/payment-review-${info.project.name}.png`,
      fullPage: true,
    });
  });
  test("administrador consulta el panel de conciliación", async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      storageState: "tests/.auth/admin.json",
      viewport: info.project.use.viewport,
    });
    try {
      const page = await context.newPage();
      await page.goto("http://localhost:3107/admin/pagos");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Pagos y conciliación",
      );
      await expect(
        page.getByText(/El cobro permanece deshabilitado/),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/payment-admin-${info.project.name}.png`,
        fullPage: true,
      });
    } finally {
      await context.close();
    }
  });
  test("controlador no puede abrir conciliación", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "tests/.auth/controller.json",
    });
    try {
      const page = await context.newPage();
      await page.goto("http://localhost:3107/admin/pagos");
      await expect(page).toHaveURL(/\/scanner$/);
    } finally {
      await context.close();
    }
  });
});
