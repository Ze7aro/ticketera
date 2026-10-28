import { test, expect } from "@playwright/test";

test("portada accesible, responsive y sin enlaces de venta ficticios", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/");
  const nonces = await page
    .locator("script")
    .evaluateAll((scripts) => scripts.map((script) => script.nonce ?? ""));
  expect(nonces.length).toBeGreaterThan(0);
  expect(
    nonces.every(
      (nonce) =>
        nonce.length > 0 &&
        response?.headers()["content-security-policy"]?.includes(nonce),
    ),
  ).toBe(true);
  expect(response?.headers()["content-security-policy"]).toContain("'nonce-");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "El próximo encuentro",
  );
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Saltar al contenido" }),
  ).toBeFocused();
  await page.getByRole("link", { name: "Ver torneos" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Próximos torneos",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const bounds = await page
    .getByRole("link", { name: "Ver torneos" })
    .boundingBox();
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `test-results/home-${page.viewportSize()?.width}.png`,
    fullPage: true,
  });
});

test("ruta desconocida ofrece regreso al inicio", async ({ page }) => {
  const response = await page.goto("/no-existe");
  expect(response?.status()).toBe(404);
  await page.getByRole("link", { name: "Volver al inicio" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
