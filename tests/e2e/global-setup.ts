import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
export default async function setup() {
  await mkdir("tests/.auth", { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const role of ["admin", "controller"]) {
      const page = await browser.newPage();
      await page.goto("http://localhost:3107/auth/login");
      await page
        .getByLabel("Email", { exact: true })
        .fill(`${role}@test.kenshukan.local`);
      await page
        .getByLabel("Contraseña", { exact: true })
        .fill("Test-only-password-2026!");
      await page.getByRole("button", { name: "Ingresar", exact: true }).click();
      await expect(page).toHaveURL(
        new RegExp(role === "admin" ? "/admin$" : "/scanner$"),
        { timeout: 20000 },
      );
      const cookie = (await page.context().cookies()).find((value) =>
        value.name.includes("session-token"),
      );
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe("Lax");
      await page.context().storageState({ path: `tests/.auth/${role}.json` });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
