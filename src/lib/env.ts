import "server-only";
import { z } from "zod";

const databaseSchema = z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//),
});

export function getDatabaseEnv() {
  const result = databaseSchema.safeParse(process.env);
  if (!result.success)
    throw new Error("Configuración de PostgreSQL ausente o inválida.");
  return result.data;
}
