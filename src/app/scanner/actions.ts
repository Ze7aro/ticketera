"use server";

import { headers } from "next/headers";
import { checkOrigin } from "@/lib/origin";
import { consumeLimit } from "@/lib/rate-limit";
import { publicError } from "@/lib/errors";
import { requireRole } from "@/modules/users/access";
import {
  checkInTicketSchema,
  checkInTokenSchema,
  ticketSearchSchema,
  type CheckInFormState,
} from "@/modules/check-ins/validation";
import {
  extractScannedToken,
  registerCheckIn,
  searchTicketsForCheckIn,
} from "@/modules/check-ins/service";

async function authorizeAction() {
  const actor = await requireRole(["ADMIN", "CONTROLLER"]);
  checkOrigin((await headers()).get("origin"));
  return actor;
}

export async function searchTicketsAction(
  _state: CheckInFormState,
  form: FormData,
): Promise<CheckInFormState> {
  try {
    const actor = await authorizeAction();
    const input = ticketSearchSchema.parse({
      eventId: form.get("eventId"),
      query: form.get("query"),
    });
    await consumeLimit("ticket-search", actor.id, 30, 60);
    return {
      results: await searchTicketsForCheckIn(input.eventId, input.query),
    };
  } catch (error) {
    return { error: publicError(error).message };
  }
}

export async function checkInTicketAction(
  _state: CheckInFormState,
  form: FormData,
): Promise<CheckInFormState> {
  try {
    const actor = await authorizeAction();
    const input = checkInTicketSchema.parse({
      eventId: form.get("eventId"),
      ticketId: form.get("ticketId"),
    });
    await consumeLimit("ticket-checkin", actor.id, 60, 60);
    return {
      checkIn: await registerCheckIn(input.eventId, actor.id, {
        kind: "ticket",
        ticketId: input.ticketId,
      }),
    };
  } catch (error) {
    return { error: publicError(error).message };
  }
}

export async function scanTicketAction(
  _state: CheckInFormState,
  form: FormData,
): Promise<CheckInFormState> {
  try {
    const actor = await authorizeAction();
    const input = checkInTokenSchema.parse({
      eventId: form.get("eventId"),
      token: form.get("token"),
    });
    await consumeLimit("ticket-checkin", actor.id, 60, 60);
    const token = extractScannedToken(input.token);
    return {
      checkIn: await registerCheckIn(
        input.eventId,
        actor.id,
        token ? { kind: "token", token } : { kind: "invalid" },
      ),
    };
  } catch (error) {
    return { error: publicError(error).message };
  }
}
