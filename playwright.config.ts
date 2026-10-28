import "dotenv/config";
import { defineConfig } from "@playwright/test";
const withDatabase = process.env.E2E_DATABASE === "1";
if (
  withDatabase &&
  (!process.env.TEST_DATABASE_URL ||
    new URL(process.env.TEST_DATABASE_URL).pathname !== "/ticketera_test")
)
  throw new Error(
    "TEST_DATABASE_URL debe apuntar a la base aislada ticketera_test.",
  );
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  globalSetup: withDatabase ? "./tests/e2e/global-setup.ts" : undefined,
  use: { baseURL: "http://localhost:3107", trace: "retain-on-failure" },
  projects: [360, 390, 768, 1024, 1440].map((width) => ({
    name: `chromium-${width}`,
    use: { browserName: "chromium", viewport: { width, height: 900 } },
  })),
  webServer: {
    command: "node node_modules/next/dist/bin/next start --port 3107",
    url: "http://localhost:3107",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      APP_URL: "http://localhost:3107",
      TICKET_ENCRYPTION_KEY: "22".repeat(32),
      RESEND_API_KEY: "",
      ...(withDatabase
        ? {
            DATABASE_URL: process.env.TEST_DATABASE_URL!,
            DIRECT_URL: process.env.TEST_DATABASE_URL!,
          }
        : {}),
    },
  },
});
