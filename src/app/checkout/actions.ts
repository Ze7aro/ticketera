"use server";
import { headers } from "next/headers";
import { checkOrigin } from "@/lib/origin";
import { publicError } from "@/lib/errors";
import { consumeLimit } from "@/lib/rate-limit";
import type { FormState } from "@/lib/form-state";
import { checkoutSchema } from "@/modules/orders/validation";
import { verifyCheckoutToken } from "@/modules/orders/tokens";
import { createPendingOrder } from "@/modules/orders/service";
export async function checkoutAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const requestHeaders = await headers();
    checkOrigin(requestHeaders.get("origin"));
    const raw = form.get("payload");
    if (typeof raw !== "string" || raw.length > 16000)
      return { error: "Revisá los datos de la compra." };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { error: "Revisá los datos de la compra." };
    }
    const input = checkoutSchema.parse(parsed);
    verifyCheckoutToken(input);
    await consumeLimit("checkout-global", "all", 300, 900);
    await consumeLimit("checkout-buyer", input.email, 5, 900);
    if (process.env.VERCEL === "1")
      await consumeLimit(
        "checkout-ip",
        requestHeaders.get("x-vercel-forwarded-for") ?? "unknown",
        30,
        900,
      );
    const order = await createPendingOrder(input);
    return {
      success: "Orden pendiente creada.",
      redirectTo: `/checkout/${order.token}`,
    };
  } catch (error) {
    return { error: publicError(error).message };
  }
}
