"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkOrigin } from "@/lib/origin";
import { publicError } from "@/lib/errors";
import { consumeLimit } from "@/lib/rate-limit";
import type { FormState } from "@/lib/form-state";
import { tokenSchema } from "@/modules/orders/validation";
import { startPayment, reconcileByToken } from "@/modules/payments/service";
async function authorize(form: FormData, operation: string) {
  checkOrigin((await headers()).get("origin"));
  const token = tokenSchema.parse(form.get("token"));
  await consumeLimit(`payment-${operation}-global`, "all", 100, 60);
  await consumeLimit(`payment-${operation}`, token, 5, 60);
  return token;
}
export async function startPaymentAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  let url: string;
  try {
    url = await startPayment(await authorize(form, "start"));
  } catch (error) {
    return { error: publicError(error).message };
  }
  redirect(url);
}
export async function reconcilePaymentAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const token = await authorize(form, "refresh");
    await reconcileByToken(token);
    revalidatePath(`/checkout/${token}`);
    return { success: "Estado consultado en Mercado Pago." };
  } catch (error) {
    return { error: publicError(error).message };
  }
}
