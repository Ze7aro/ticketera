import { z } from "zod";
import { idSchema } from "@/modules/users/validation";

const optionalId = z
  .union([z.literal(""), idSchema])
  .optional()
  .transform((value) => value || undefined);

export const reportFilterSchema = z.object({
  eventId: optionalId,
  query: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  status: z
    .enum([
      "PENDING",
      "PAID",
      "REJECTED",
      "CANCELLED",
      "EXPIRED",
      "PAYMENT_REVIEW",
    ])
    .optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});

export const exportSchema = z.object({
  kind: z.enum(["orders", "tickets", "checkins"]),
  eventId: optionalId,
});

export const auditFilterSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
});

export type ReportFilters = z.infer<typeof reportFilterSchema>;
