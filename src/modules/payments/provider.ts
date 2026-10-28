import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { paymentConfig } from "./config";
const id = z
  .union([
    z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    z.string().regex(/^\d+$/),
  ])
  .transform(String);
export const providerPaymentSchema = z.object({
  id,
  external_reference: z.string().nullable(),
  collector_id: id,
  live_mode: z.boolean(),
  currency_id: z.string().length(3),
  transaction_amount: z.number().nonnegative().max(21474836.47),
  transaction_amount_refunded: z.number().nonnegative().default(0),
  status: z.enum([
    "pending",
    "approved",
    "authorized",
    "in_process",
    "in_mediation",
    "rejected",
    "cancelled",
    "refunded",
    "charged_back",
  ]),
  date_last_updated: z.iso.datetime({ offset: true }),
});
export type ProviderPayment = z.infer<typeof providerPaymentSchema>;
export async function mpRequest(
  path: string,
  body?: unknown,
): Promise<unknown> {
  const config = paymentConfig();
  try {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${config.MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Provider unavailable");
    return await response.json();
  } catch {
    throw new AppError(
      "PAYMENT_PROVIDER",
      "No pudimos consultar Mercado Pago. Intentá actualizar el estado en unos minutos.",
      503,
    );
  }
}
export async function fetchPayment(paymentId: string) {
  if (!/^\d{1,30}$/.test(paymentId))
    throw new AppError("INVALID_PAYMENT", "Pago inválido.");
  const payment = providerPaymentSchema.parse(
    await mpRequest(`/v1/payments/${paymentId}`),
  );
  if (payment.id !== paymentId)
    throw new AppError("INVALID_PAYMENT", "Pago inválido.", 502);
  return payment;
}
export async function searchPayments(orderId: string) {
  const results: ProviderPayment[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const params = new URLSearchParams({
      external_reference: orderId,
      limit: "100",
      offset: String(offset),
      sort: "date_created",
      criteria: "asc",
    });
    const page = z
      .object({
        paging: z.object({ total: z.number().int().nonnegative() }),
        results: z.array(providerPaymentSchema),
      })
      .parse(await mpRequest(`/v1/payments/search?${params}`));
    // Fetch each payment directly; search is only discovery, never approval evidence.
    for (const result of page.results)
      results.push(await fetchPayment(result.id));
    if (offset + page.results.length >= page.paging.total) return results;
    if (!page.results.length) break;
  }
  throw new AppError(
    "PAYMENT_PROVIDER",
    "La conciliación requiere revisión del administrador.",
    503,
  );
}
export function safeCheckoutUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    ![
      "www.mercadopago.com.ar",
      "sandbox.mercadopago.com.ar",
      "sandbox.mercadopago.com",
    ].includes(url.hostname)
  )
    throw new AppError("INVALID_CHECKOUT", "No pudimos abrir el pago.", 502);
  return url.href;
}
