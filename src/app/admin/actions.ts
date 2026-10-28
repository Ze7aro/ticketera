"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { publicError } from "@/lib/errors";
import { checkOrigin } from "@/lib/origin";
import { consumeLimit } from "@/lib/rate-limit";
import type { FormState } from "@/lib/form-state";
import { requireRole } from "@/modules/users/access";
import { saveEvent, changeEventStatus } from "@/modules/events/service";
import { saveTicketType } from "@/modules/ticket-types/service";
import { createController, updateController } from "@/modules/users/service";
async function execute(work: () => Promise<FormState>): Promise<FormState> {
  try {
    checkOrigin((await headers()).get("origin"));
    const actor = await requireRole(["ADMIN"]);
    await consumeLimit("admin-write", actor.id, 60, 60);
    return await work();
  } catch (error) {
    return { error: publicError(error).message };
  }
}
export async function eventAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  return execute(async () => {
    const id = await saveEvent(
      Object.fromEntries(form),
      form.get("id") ? String(form.get("id")) : undefined,
      String(form.get("updatedAt") ?? ""),
    );
    revalidatePath("/admin/torneos");
    revalidatePath(`/admin/torneos/${id}`);
    return { success: "Torneo guardado.", redirectTo: `/admin/torneos/${id}` };
  });
}
export async function statusAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  return execute(async () => {
    await changeEventStatus(Object.fromEntries(form));
    revalidatePath("/admin/torneos");
    revalidatePath(`/admin/torneos/${form.get("id")}`);
    return { success: "Estado actualizado." };
  });
}
export async function ticketTypeAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  return execute(async () => {
    await saveTicketType(
      String(form.get("eventId") ?? ""),
      { ...Object.fromEntries(form), active: form.get("active") === "on" },
      form.get("id") ? String(form.get("id")) : undefined,
      String(form.get("updatedAt") ?? ""),
    );
    revalidatePath(`/admin/torneos/${form.get("eventId")}`);
    return { success: "Tipo de entrada guardado." };
  });
}
export async function createControllerAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  return execute(async () => {
    await createController(Object.fromEntries(form));
    revalidatePath("/admin/usuarios");
    return {
      success:
        "Controlador creado. Compartí la contraseña por un canal privado.",
    };
  });
}
export async function updateControllerAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  return execute(async () => {
    await updateController({
      ...Object.fromEntries(form),
      active: form.get("active") === "on",
    });
    revalidatePath("/admin/usuarios");
    return {
      success:
        "Usuario actualizado. Sus sesiones anteriores quedaron invalidadas.",
    };
  });
}
