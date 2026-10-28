import { AppError } from "../../lib/errors";
import type { CheckoutInput } from "./validation";
export type SellableType = {
  id: string;
  eventId: string;
  name: string;
  active: boolean;
  priceCents: number;
  stock: number;
  sold: number;
  reserved: number;
  maxPerOrder: number;
  salesStart: Date;
  salesEnd: Date;
};
export function calculateOrder(
  event: { id: string; status: string; startsAt: Date },
  types: SellableType[],
  items: CheckoutInput["items"],
  now: Date,
) {
  if (event.status !== "PUBLISHED")
    throw new AppError(
      "SALES_CLOSED",
      "Las ventas de este torneo no están habilitadas.",
    );
  let totalCents = 0;
  let expiresAt = now.getTime() + 15 * 60000;
  const lines = items.map((item) => {
    const type = types.find(
      (type) => type.id === item.ticketTypeId && type.eventId === event.id,
    );
    if (!type || !type.active || type.salesStart > now || type.salesEnd <= now)
      throw new AppError(
        "TYPE_UNAVAILABLE",
        "Una de las entradas no está disponible en este período.",
      );
    if (item.quantity > type.maxPerOrder)
      throw new AppError(
        "QUANTITY_LIMIT",
        `El máximo para ${type.name} es ${type.maxPerOrder}.`,
      );
    if (item.quantity > type.stock - type.sold - type.reserved)
      throw new AppError(
        "SOLD_OUT",
        "No quedan suficientes entradas. Actualizá la disponibilidad.",
        409,
      );
    if (item.quotedPriceCents !== type.priceCents)
      throw new AppError(
        "PRICE_CHANGED",
        "El precio cambió. Recargá el torneo y revisá el nuevo total antes de continuar.",
        409,
      );
    totalCents += type.priceCents * item.quantity;
    expiresAt = Math.min(expiresAt, type.salesEnd.getTime());
    return {
      ticketTypeId: type.id,
      ticketTypeName: type.name,
      quantity: item.quantity,
      unitPriceCents: type.priceCents,
    };
  });
  if (!Number.isSafeInteger(totalCents) || totalCents > 2147483647)
    throw new AppError(
      "TOTAL_LIMIT",
      "El importe supera el máximo permitido para una orden.",
    );
  return { totalCents, expiresAt: new Date(expiresAt), lines };
}
