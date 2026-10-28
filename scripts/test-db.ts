import "dotenv/config";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/modules/users/password";

const source = new URL(process.env.DATABASE_URL ?? "");
const target = new URL(process.env.TEST_DATABASE_URL ?? "");
if (
  !["localhost", "127.0.0.1"].includes(source.hostname) ||
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  target.pathname !== "/ticketera_test" ||
  source.pathname === target.pathname
)
  throw new Error(
    "Este script sólo prepara ticketera_test en PostgreSQL local, separado de la base de desarrollo.",
  );
const admin = new Client({ connectionString: source.toString() });
await admin.connect();
try {
  if (
    !(
      await admin.query(
        "SELECT 1 FROM pg_database WHERE datname = 'ticketera_test'",
      )
    ).rowCount
  )
    await admin.query('CREATE DATABASE "ticketera_test"');
} finally {
  await admin.end();
}
execFileSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: target.toString(),
      DIRECT_URL: target.toString(),
    },
  },
);
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: target.toString() }),
});
try {
  const passwordHash = await hashPassword("Test-only-password-2026!");
  for (const role of ["ADMIN", "CONTROLLER"] as const) {
    const email = `${role.toLowerCase()}@test.kenshukan.local`;
    await db.user.upsert({
      where: { email },
      create: {
        email,
        name: role === "ADMIN" ? "Admin de prueba" : "Control de prueba",
        role,
        passwordHash,
      },
      update: { active: true, passwordHash, sessionVersion: { increment: 1 } },
    });
  }
  const publicEvent = await db.event.upsert({
    where: { slug: "e2e-copa-publica" },
    create: {
      slug: "e2e-copa-publica",
      name: "Copa pública de prueba",
      abbreviation: "E2E",
      venue: "Polideportivo",
      address: "Calle del Deporte 123",
      status: "PUBLISHED",
      startsAt: new Date("2030-10-20T13:00:00Z"),
    },
    update: { status: "PUBLISHED" },
  });
  await db.ticketType.upsert({
    where: { eventId_name: { eventId: publicEvent.id, name: "General" } },
    create: {
      eventId: publicEvent.id,
      name: "General",
      priceCents: 250000,
      stock: 10000,
      maxPerOrder: 6,
      active: true,
      salesStart: new Date("2020-01-01T00:00:00Z"),
      salesEnd: new Date("2030-10-20T12:00:00Z"),
    },
    update: { active: true, priceCents: 250000 },
  });
  await db.rateLimit.deleteMany();
  console.info("Base de pruebas aislada preparada.");
} finally {
  await db.$disconnect();
}
