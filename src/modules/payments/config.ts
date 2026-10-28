import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
const schema = z.object({
  TICKET_ENCRYPTION_KEY: z.string().regex(/^[a-f0-9]{64}$/i),
  MERCADOPAGO_ACCESS_TOKEN: z.string().min(10),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().min(16),
  MERCADOPAGO_COLLECTOR_ID: z.string().regex(/^\d+$/),
  MERCADOPAGO_MODE: z.enum(["test", "live"]),
  APP_URL: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
    );
  }),
});
export function paymentsConfigured() {
  return schema.safeParse(process.env).success;
}
export function paymentConfig() {
  const result = schema.safeParse(process.env);
  if (!result.success)
    throw new AppError(
      "PAYMENTS_DISABLED",
      "El pago online todavía no está habilitado.",
      503,
    );
  return { ...result.data, APP_URL: new URL(result.data.APP_URL).origin };
}
