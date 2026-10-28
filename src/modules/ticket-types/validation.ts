import { z } from "zod";
import { localDateSchema } from "../../lib/dates";
export const priceSchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,7}([.,]\d{1,2})?$/,
    "Ingresá un precio en pesos, con hasta dos decimales.",
  )
  .transform((value) => {
    const [whole, fraction = ""] = value.replace(",", ".").split(".");
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  });
const integer = (max: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(0).max(max));
export const ticketTypeSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    price: priceSchema,
    stock: integer(1000000),
    maxPerOrder: integer(100).refine((n) => n > 0),
    salesStart: localDateSchema,
    salesEnd: localDateSchema,
    active: z.boolean(),
  })
  .refine((data) => data.salesStart < data.salesEnd, {
    path: ["salesEnd"],
    message: "El cierre debe ser posterior al inicio.",
  });
