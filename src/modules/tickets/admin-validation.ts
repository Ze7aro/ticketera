import { z } from "zod";
import { idSchema } from "@/modules/users/validation";

export const manualTicketSchema = z.object({
  ticketTypeId: idSchema,
  attendeeName: z.string().trim().min(2).max(100),
  reason: z.string().trim().min(4).max(250),
});

export const cancelTicketSchema = z.object({
  ticketId: idSchema,
  reason: z.string().trim().min(4).max(250),
});
