import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env")) throw new Error(".env ya existe. No se sobrescribió.");
const password = randomBytes(24).toString("hex");
const adminPassword = randomBytes(18).toString("base64url");
writeFileSync(
  ".env",
  [
    `POSTGRES_PASSWORD=${password}`,
    `DATABASE_URL=postgresql://ticketera:${password}@localhost:54329/ticketera`,
    `DIRECT_URL=postgresql://ticketera:${password}@localhost:54329/ticketera`,
    `TEST_DATABASE_URL=postgresql://ticketera:${password}@localhost:54329/ticketera_test`,
    `AUTH_SECRET=${randomBytes(48).toString("base64url")}`,
    `TICKET_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}`,
    "APP_URL=http://localhost:3000",
    "DEFAULT_TIMEZONE=America/Argentina/Buenos_Aires",
    "ADMIN_EMAIL=admin@kenshukan.local",
    `ADMIN_PASSWORD=${adminPassword}`,
    "",
  ].join("\n"),
  { mode: 0o600 },
);
console.info(
  ".env local creado con claves aleatorias. Las credenciales no se imprimen; consultalas en ese archivo.",
);
