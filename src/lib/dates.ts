import { DateTime, IANAZone } from "luxon";
import { z } from "zod";
export const timezoneSchema = z
  .string()
  .max(100)
  .refine((zone) => IANAZone.isValidZone(zone), "Zona horaria inválida.");
export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha y hora inválidas.");
export function localToUtc(value: string, timezone: string) {
  const date = DateTime.fromISO(value, { zone: timezone });
  if (
    !date.isValid ||
    date.toFormat("yyyy-MM-dd'T'HH:mm") !== value ||
    date.getPossibleOffsets().length !== 1
  )
    throw new Error("INVALID_LOCAL_DATE");
  return date.toUTC().toJSDate();
}
export function utcToLocal(value: Date, timezone: string) {
  return DateTime.fromJSDate(value, { zone: timezone }).toFormat(
    "yyyy-MM-dd'T'HH:mm",
  );
}
