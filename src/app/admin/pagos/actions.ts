"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/modules/users/access";
import { checkOrigin } from "@/lib/origin";
import { getDb } from "@/lib/db";
import { consumeLimit } from "@/lib/rate-limit";
import { publicError } from "@/lib/errors";
import type { FormState } from "@/lib/form-state";
import { reconcileOrder } from "@/modules/payments/service";
export async function reconcileAdminAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const actor = await requireRole(["ADMIN"]);
    checkOrigin((await headers()).get("origin"));
    const orderId = z.cuid().parse(form.get("orderId"));
    await consumeLimit("admin-reconcile", actor.id, 20, 60);
    await reconcileOrder(orderId);
    await getDb().auditLog.create({
      data: {
        userId: actor.id,
        action: "PAYMENT_RECONCILED",
        entityType: "Order",
        entityId: orderId,
      },
    });
    revalidatePath("/admin/pagos");
    return { success: "Pago consultado en Mercado Pago." };
  } catch (error) {
    return { error: publicError(error).message };
  }
}
