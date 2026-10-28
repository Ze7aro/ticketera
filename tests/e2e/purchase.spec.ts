import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test.describe("venta pública sin cuenta", () => {
  test.skip(process.env.E2E_DATABASE !== "1", "Requiere PostgreSQL de prueba.");
  test("selección, comprador y orden pendiente; el retorno no confirma pagos", async ({
    page,
  }, info) => {
    const email = `buyer-${randomUUID()}@example.com`;
    await page.goto("/eventos/e2e-copa-publica");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Copa pública de prueba",
    );
    await expect(
      page.getByRole("button", { name: "Crear orden pendiente" }),
    ).toBeDisabled();
    await page
      .getByLabel("Cantidad de General", { exact: true })
      .selectOption("2");
    await page.getByLabel("Nombre", { exact: true }).fill("Ana");
    await page.getByLabel("Apellido", { exact: true }).fill("Pérez");
    await page.getByLabel("DNI", { exact: true }).fill("30123456");
    await page.getByLabel("Teléfono", { exact: true }).fill("1155551234");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await expect(page.getByText(/Total:/)).toContainText("5.000,00");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/checkout-${info.project.name}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Crear orden pendiente" }).click();
    await expect(page).toHaveURL(/\/checkout\/[A-Za-z0-9_-]{43}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Orden pendiente de pago",
    );
    await expect(page.locator("body")).not.toContainText(email);
    await expect(page.locator("body")).not.toContainText("30123456");
    await page.goto(`${page.url()}?status=approved&collection_status=approved`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Orden pendiente de pago",
    );
    await expect(page.getByText(/Total:/)).toContainText("5.000,00");
  });
  test("un token desconocido no permite consultar una orden", async ({
    page,
  }) => {
    await page.goto(`/checkout/${"a".repeat(43)}`);
    await expect(
      page.getByRole("heading", { name: "No encontramos esta página" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Orden pendiente de pago" }),
    ).toHaveCount(0);
    await expect(page.locator("meta[name=robots]").first()).toHaveAttribute(
      "content",
      /noindex/,
    );
  });
});
