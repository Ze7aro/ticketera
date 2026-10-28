import { z } from "zod";
import { idSchema } from "@/modules/users/validation";

export const checkInEventSchema = idSchema;

export const ticketSearchSchema = z.object({
  eventId: idSchema,
  query: z.string().trim().min(3).max(100),
});

export const checkInTicketSchema = z.object({
  eventId: idSchema,
  ticketId: idSchema,
});

export const checkInTokenSchema = z.object({
  eventId: idSchema,
  token: z.string().trim().min(1).max(2048),
});

export type CheckInResultView = {
  result: "ACCEPTED" | "ALREADY_USED" | "INVALID" | "CANCELLED" | "WRONG_EVENT";
  ticketNumber?: string;
  attendeeName?: string;
  ticketType?: string;
};

export type TicketSearchView = {
  id: string;
  number: string;
  attendeeName: string;
  ticketType: string;
  status: "VALID" | "USED" | "CANCELLED";
};

export type CheckInFormState = {
  error?: string;
  success?: string;
  results?: TicketSearchView[];
  checkIn?: CheckInResultView;
};
