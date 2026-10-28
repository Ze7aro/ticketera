import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { z } from "zod";
import { hashPassword } from "../src/modules/users/password";
import { emailSchema, passwordSchema } from "../src/modules/users/validation";

const env = z
  .object({
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//),
    ADMIN_EMAIL: emailSchema,
    ADMIN_PASSWORD: passwordSchema,
  })
  .parse(process.env);
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
try {
  const existing = await db.user.findUnique({
    where: { email: env.ADMIN_EMAIL },
  });
  if (existing && existing.role !== "ADMIN")
    throw new Error("ADMIN_EMAIL pertenece a un controlador.");
  if (!existing)
    await db.user.create({
      data: {
        email: env.ADMIN_EMAIL,
        name: "Administración Kenshukan",
        role: "ADMIN",
        passwordHash: await hashPassword(env.ADMIN_PASSWORD),
      },
    });
  await db.event.upsert({
    where: { slug: "torneo-de-ejemplo" },
    update: {},
    create: {
      slug: "torneo-de-ejemplo",
      name: "Torneo de ejemplo",
      abbreviation: "KEN",
      description:
        "Borrador inicial. Configurar datos reales antes de publicar.",
      venue: "A confirmar",
      address: "A confirmar",
      startsAt: new Date("2027-01-01T12:00:00Z"),
      status: "DRAFT",
      ticketTypes: {
        create: {
          name: "General",
          priceCents: 1000000,
          stock: 100,
          maxPerOrder: 6,
          active: false,
          salesStart: new Date("2026-12-01T00:00:00Z"),
          salesEnd: new Date("2026-12-31T23:59:00Z"),
        },
      },
    },
  });
  console.info(
    "Seed completado. El administrador existente y su contraseña no se modifican.",
  );
} catch {
  console.error(
    "No se pudo ejecutar el seed. Revisar conexión, migraciones y configuración del administrador.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
