import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("las rutas privadas requieren sesión", async ({ page }) => {
  for (const route of [
    "/admin",
    "/admin/torneos",
    "/admin/usuarios",
    "/scanner",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/auth\/login$/);
  }
});

test.describe("administración con PostgreSQL", () => {
  test.skip(
    process.env.E2E_DATABASE !== "1",
    "Requiere la base de pruebas aislada.",
  );
  test.use({ storageState: "tests/.auth/admin.json" });
  test("crear, editar, publicar, pausar y finalizar torneo", async ({
    page,
    browser,
  }, info) => {
    const slug = `copa-${randomUUID()}`;
    const submitted = page.waitForRequest(
      (request) =>
        request.method() === "POST" && !!request.headers()["next-action"],
    );
    await page.goto("/admin/torneos/nuevo");
    await page
      .getByLabel("Nombre del torneo", { exact: true })
      .fill("Copa de prueba");
    await page.getByLabel("Enlace del torneo", { exact: true }).fill(slug);
    await page
      .getByLabel("Fecha y hora del torneo", { exact: true })
      .fill("2030-10-20T10:00");
    await page
      .getByLabel("Lugar", { exact: true })
      .fill("Polideportivo Kenshukan");
    await page
      .getByLabel("Dirección", { exact: true })
      .fill("Avenida del Deporte 123");
    await page
      .getByRole("button", { name: "Crear borrador", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/torneos\/c[a-z0-9]+$/, {
      timeout: 15000,
    });
    const submittedRequest = await submitted;
    const restricted = await browser.newContext({
      storageState: "tests/.auth/controller.json",
    });
    const denied = await restricted.request.post(submittedRequest.url(), {
      headers: {
        "next-action": submittedRequest.headers()["next-action"]!,
        "content-type": submittedRequest.headers()["content-type"]!,
        origin: "http://localhost:3107",
      },
      data: submittedRequest.postDataBuffer()!,
    });
    expect(await denied.text()).toContain("No tenés permisos");
    await restricted.close();
    await page
      .getByRole("button", { name: "Publicar torneo", exact: true })
      .click();
    await expect(
      page.getByRole("alert", { name: "Error del formulario" }),
    ).toContainText("Creá y activá");
    await page
      .getByLabel("Nombre de la entrada", { exact: true })
      .fill("General");
    await page
      .getByLabel("Precio en pesos (ARS)", { exact: true })
      .fill("1234,50");
    await page
      .getByLabel("Inicio de venta", { exact: true })
      .fill("2030-09-01T10:00");
    await page
      .getByLabel("Cierre de venta", { exact: true })
      .fill("2030-10-20T09:00");
    await page.getByLabel("Tipo de entrada activo", { exact: true }).check();
    await page
      .getByRole("button", { name: "Agregar tipo de entrada", exact: true })
      .click();
    await expect(page.locator("summary")).toContainText("General");
    await page
      .getByLabel("Nombre del torneo", { exact: true })
      .fill("Copa actualizada");
    await page
      .getByRole("button", { name: "Guardar torneo", exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Copa actualizada",
    );
    await page
      .getByRole("button", { name: "Publicar torneo", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Pausar ventas", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/admin-${info.project.name}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Pausar ventas", exact: true })
      .click();
    await expect(
      page.getByText("Ventas pausadas", { exact: true }),
    ).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Finalizar torneo", exact: true })
      .click();
    await expect(page.getByText("Finalizado", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Guardar torneo", exact: true }),
    ).toBeDisabled();
  });
  test("crear controlador y desactivar su acceso", async ({
    page,
    browser,
  }) => {
    await page.goto("/admin/usuarios");
    await page
      .locator("summary")
      .filter({ hasText: "Crear controlador" })
      .click();
    const email = `control-${randomUUID()}@example.com`;
    await page.getByLabel("Nombre", { exact: true }).fill("Controlador nuevo");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page
      .getByLabel("Contraseña inicial", { exact: true })
      .fill("Test-only-password-long!");
    await page
      .getByRole("button", { name: "Crear controlador", exact: true })
      .click();
    const card = page.locator("article").filter({ hasText: email });
    // Password hashing can exceed Playwright's default 5s on a busy local host.
    await expect(card).toBeVisible({ timeout: 20000 });
    const controllerPage = await browser.newPage();
    await controllerPage.goto("http://localhost:3107/auth/login");
    await controllerPage.getByLabel("Email", { exact: true }).fill(email);
    await controllerPage
      .getByLabel("Contraseña", { exact: true })
      .fill("Test-only-password-long!");
    await controllerPage
      .getByRole("button", { name: "Ingresar", exact: true })
      .click();
    await expect(controllerPage).toHaveURL(/\/scanner$/);
    await card.getByLabel("Permitir acceso").uncheck();
    page.once("dialog", (dialog) => dialog.accept());
    await card.getByRole("button", { name: "Actualizar controlador" }).click();
    await expect(card.getByText("Desactivado", { exact: true })).toBeVisible();
    await controllerPage.goto("http://localhost:3107/scanner");
    await expect(controllerPage).toHaveURL(/\/auth\/login$/);
    await controllerPage.close();
  });
});

test.describe("controlador", () => {
  test.skip(
    process.env.E2E_DATABASE !== "1",
    "Requiere la base de pruebas aislada.",
  );
  test.use({ storageState: "tests/.auth/controller.json" });
  test("puede acceder a scanner, pero no a administración", async ({
    page,
  }) => {
    for (const route of [
      "/admin",
      "/admin/torneos",
      "/admin/torneos/nuevo",
      "/admin/usuarios",
    ]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/scanner$/);
      await expect(
        page.getByRole("heading", { name: "Control de acceso", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Crear borrador", exact: true }),
      ).toHaveCount(0);
    }
  });
});
