import { z } from "zod";
import { localDateSchema, localToUtc, timezoneSchema } from "../../lib/dates";
export const eventStatuses = [
  "DRAFT",
  "PUBLISHED",
  "SALES_PAUSED",
  "FINISHED",
] as const;
export const eventSchema = z
  .object({
    name: z.string().trim().min(3).max(150),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    abbreviation: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2,8}$/),
    description: z.string().trim().max(5000),
    venue: z.string().trim().min(3).max(200),
    address: z.string().trim().min(3).max(300),
    startsAt: localDateSchema,
    timezone: timezoneSchema,
    conditions: z.string().trim().min(5).max(2000),
  })
  .superRefine((value, ctx) => {
    try {
      localToUtc(value.startsAt, value.timezone);
    } catch {
      ctx.addIssue({
        code: "custom",
        path: ["startsAt"],
        message: "La hora no existe o es ambigua en esa zona horaria.",
      });
    }
  });
export const eventLabels: Record<(typeof eventStatuses)[number], string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  SALES_PAUSED: "Ventas pausadas",
  FINISHED: "Finalizado",
};
