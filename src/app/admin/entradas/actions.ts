"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/modules/users/access";
import { checkOrigin } from "@/lib/origin";
import { transaction } from "@/lib/transaction";
import { consumeLimit } from "@/lib/rate-limit";
import { AppError, publicError } from "@/lib/errors";
import type { FormState } from "@/lib/form-state";
import { deliverEmail } from "@/modules/notifications/service";
import { cancelTicket, issueManualTicket } from "@/modules/tickets/admin";

export async function issueManualTicketAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const actor = await requireRole(["ADMIN"]);
    checkOrigin((await headers()).get("origin"));
    await consumeLimit("manual-ticket-issue", actor.id, 20, 3600);
    const ticket = await issueManualTicket(actor.id, {
      ticketTypeId: form.get("ticketTypeId"),
      attendeeName: form.get("attendeeName"),
      reason: form.get("reason"),
    });
    revalidatePath("/admin/entradas");
    revalidatePath("/admin");
    return {
      success: `Entrada ${ticket.number} emitida. Ya aparece en el listado de entradas manuales.`,
    };
  } catch (error) {
    return { error: publicError(error).message };
  }
}

export async function cancelTicketAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const actor = await requireRole(["ADMIN"]);
    checkOrigin((await headers()).get("origin"));
    await consumeLimit("ticket-cancel", actor.id, 30, 3600);
    const ticket = await cancelTicket(actor.id, {
      ticketId: form.get("ticketId"),
      reason: form.get("reason"),
    });
    revalidatePath("/admin/entradas");
    if (ticket.orderId) revalidatePath(`/admin/entradas/${ticket.orderId}`);
    revalidatePath("/admin/ventas");
    revalidatePath("/admin");
    return { success: `Entrada ${ticket.number} anulada.` };
  } catch (error) {
    return { error: publicError(error).message };
  }
}

export async function resendTicketsAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const actor = await requireRole(["ADMIN"]);
    checkOrigin((await headers()).get("origin"));
    const orderId = z.cuid().parse(form.get("orderId"));
    const requestId = z.uuid().parse(form.get("requestId"));
    await consumeLimit("email-resend-admin", actor.id, 20, 3600);
    await consumeLimit("email-resend-order", orderId, 3, 3600);
    const job = await transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          tickets: { where: { status: "VALID" }, select: { id: true } },
        },
      });
      if (
        order?.status !== "PAID" ||
        !order.ticketsIssuedAt ||
        !order.tickets.length
      )
        throw new AppError(
          "INVALID_ORDER",
          "La orden no tiene entradas válidas para reenviar.",
          409,
        );
      const existing = await tx.ticketEmail.findUnique({
        where: { requestKey: `resend:${orderId}:${requestId}` },
      });
      if (existing) return existing;
      const created = await tx.ticketEmail.create({
        data: { orderId, requestKey: `resend:${orderId}:${requestId}` },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "TICKETS_EMAIL_REQUESTED",
          entityType: "Order",
          entityId: orderId,
          reason: "Reenvío solicitado por administrador",
        },
      });
      return created;
    });
    await deliverEmail(job.id);
    revalidatePath(`/admin/entradas/${orderId}`);
    return {
      success: "Solicitud registrada. Consultá abajo el estado del envío.",
    };
  } catch (error) {
    return { error: publicError(error).message };
  }
}
