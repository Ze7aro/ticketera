import { z } from "zod";
import { idSchema, emailSchema } from "../users/validation";
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const checkoutSchema = z
  .object({
    eventId: idSchema,
    token: tokenSchema,
    issuedAt: z.number().int().positive(),
    signature: tokenSchema,
    firstName: z.string().trim().min(2).max(80),
    lastName: z.string().trim().min(2).max(80),
    dni: z
      .string()
      .trim()
      .regex(/^\d{7,8}$/, "Ingresá un DNI de 7 u 8 dígitos, sin puntos."),
    email: emailSchema,
    phone: z
      .string()
      .trim()
      .regex(/^\+?[\d ()-]{8,25}$/)
      .refine((value) => value.replace(/\D/g, "").length >= 8),
    items: z
      .array(
        z
          .object({
            ticketTypeId: idSchema,
            quantity: z.number().int().min(1).max(100),
            quotedPriceCents: z.number().int().min(0).max(2147483647),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      new Set(value.items.map((item) => item.ticketTypeId)).size !==
      value.items.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "No repitas tipos de entrada.",
      });
    if (value.items.reduce((sum, item) => sum + item.quantity, 0) > 100)
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "El máximo total es de 100 entradas por orden.",
      });
  });
export type CheckoutInput = z.infer<typeof checkoutSchema>;
