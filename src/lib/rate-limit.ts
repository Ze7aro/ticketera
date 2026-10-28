import "server-only";
import { createHmac } from "node:crypto";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";

export async function consumeLimit(
  scope: string,
  identity: string,
  limit: number,
  seconds: number,
) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Configuración de autenticación incompleta.");
  const key = createHmac("sha256", secret)
    .update(`${scope}:${identity}`)
    .digest("hex");
  const db = getDb();
  // Atomic, shared across server instances; no process-local counters.
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt")
    VALUES (${key}, 1, NOW() + ${seconds} * INTERVAL '1 second')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."expiresAt" <= NOW() THEN 1 ELSE LEAST("RateLimit"."count" + 1, 1000000) END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= NOW() THEN NOW() + ${seconds} * INTERVAL '1 second' ELSE "RateLimit"."expiresAt" END
    RETURNING "count"`;
  await db.$executeRaw`DELETE FROM "RateLimit" WHERE "key" IN (SELECT "key" FROM "RateLimit" WHERE "expiresAt" < NOW() LIMIT 100)`;
  if (!rows[0] || rows[0].count > limit)
    throw new AppError(
      "RATE_LIMITED",
      "Demasiados intentos. Esperá unos minutos e intentá nuevamente.",
      429,
    );
}
