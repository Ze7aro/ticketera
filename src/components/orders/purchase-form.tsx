"use client";
import { useState } from "react";
import { ActionForm, Field } from "@/components/forms/action-form";
import { checkoutAction } from "@/app/checkout/actions";
import { formatMoney } from "@/lib/format";
export type PublicTicketType = {
  id: string;
  name: string;
  priceCents: number;
  available: number;
  maxPerOrder: number;
  salesStart: string;
  salesEnd: string;
};
export function PurchaseForm({
  eventId,
  ticketTypes,
  credential,
  now,
}: {
  eventId: string;
  ticketTypes: PublicTicketType[];
  credential: { token: string; issuedAt: number; signature: string };
  now: number;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [buyer, setBuyer] = useState({
    firstName: "",
    lastName: "",
    dni: "",
    email: "",
    phone: "",
  });
  const items = ticketTypes
    .filter((type) => (quantities[type.id] ?? 0) > 0)
    .map((type) => ({
      ticketTypeId: type.id,
      quantity: quantities[type.id]!,
      quotedPriceCents: type.priceCents,
    }));
  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.quotedPriceCents,
    0,
  );
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <ActionForm
      action={checkoutAction}
      submitLabel="Crear orden pendiente"
      submitDisabled={quantity === 0 || quantity > 100}
      className="space-y-6"
    >
      <input
        type="hidden"
        name="payload"
        value={JSON.stringify({ eventId, ...credential, ...buyer, items })}
      />
      <h2 className="text-2xl font-semibold">Elegí tus entradas</h2>
      <div className="space-y-4">
        {ticketTypes.map((type) => {
          const onSale =
            new Date(type.salesStart).getTime() <= now &&
            new Date(type.salesEnd).getTime() > now;
          const max = onSale ? Math.min(type.available, type.maxPerOrder) : 0;
          const status =
            new Date(type.salesStart).getTime() > now
              ? "Venta aún no iniciada"
              : !onSale
                ? "Venta cerrada"
                : max === 0
                  ? "Agotadas"
                  : `${type.available} disponibles · Máximo ${type.maxPerOrder} por compra`;
          return (
            <article key={type.id} className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{type.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{status}</p>
                </div>
                <p className="font-semibold text-primary">
                  {formatMoney(type.priceCents)}
                </p>
              </div>
              <label
                htmlFor={`quantity-${type.id}`}
                className="mt-4 block text-sm font-semibold"
              >
                Cantidad de {type.name}
              </label>
              <select
                id={`quantity-${type.id}`}
                value={quantities[type.id] ?? 0}
                onChange={(event) =>
                  setQuantities((previous) => ({
                    ...previous,
                    [type.id]: Number(event.target.value),
                  }))
                }
                disabled={!max}
                className="mt-2 min-h-11 w-full rounded-lg border bg-background px-3"
              >
                {Array.from({ length: max + 1 }, (_, n) => (
                  <option value={n} key={n}>
                    {n}
                  </option>
                ))}
              </select>
            </article>
          );
        })}
      </div>
      <div className="rounded-xl border bg-muted p-5" aria-live="polite">
        <p>{quantity} entradas seleccionadas</p>
        <p className="mt-2 text-xl font-semibold">
          Total: {formatMoney(total)}
        </p>
        {quantity > 100 && (
          <p className="mt-2 text-sm text-red-900">
            El máximo total es de 100 entradas por orden.
          </p>
        )}
      </div>
      <h2 className="pt-4 text-2xl font-semibold">Datos del comprador</h2>
      <p className="text-sm text-muted-foreground">
        No necesitás crear una cuenta. Usaremos estos datos para identificar tu
        orden.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Nombre"
          name="firstName"
          autoComplete="given-name"
          minLength={2}
          maxLength={80}
          required
          value={buyer.firstName}
          onChange={(event) =>
            setBuyer({ ...buyer, firstName: event.target.value })
          }
        />
        <Field
          label="Apellido"
          name="lastName"
          autoComplete="family-name"
          minLength={2}
          maxLength={80}
          required
          value={buyer.lastName}
          onChange={(event) =>
            setBuyer({ ...buyer, lastName: event.target.value })
          }
        />
        <Field
          label="DNI"
          name="dni"
          inputMode="numeric"
          pattern="[0-9]{7,8}"
          maxLength={8}
          hint="Sin puntos ni espacios."
          required
          value={buyer.dni}
          onChange={(event) => setBuyer({ ...buyer, dni: event.target.value })}
        />
        <Field
          label="Teléfono"
          name="phone"
          type="tel"
          autoComplete="tel"
          minLength={8}
          maxLength={25}
          required
          value={buyer.phone}
          onChange={(event) =>
            setBuyer({ ...buyer, phone: event.target.value })
          }
        />
      </div>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        required
        value={buyer.email}
        onChange={(event) => setBuyer({ ...buyer, email: event.target.value })}
      />
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        La orden reservará tus entradas hasta 15 minutos. En el siguiente paso
        podrás pagar con Mercado Pago si está habilitado. Crear la orden no
        confirma una compra ni permite ingresar al torneo.
      </p>
    </ActionForm>
  );
}
