export function formatMoney(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0)
    throw new RangeError(
      "El importe debe ser un entero no negativo en centavos.",
    );
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(cents / 100);
}

export function formatEventDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}
