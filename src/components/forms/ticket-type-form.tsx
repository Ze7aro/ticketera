import type { TicketType } from "@/generated/prisma/client";
import { ActionForm, Field, Checkbox } from "@/components/forms/action-form";
import { ticketTypeAction } from "@/app/admin/actions";
import { utcToLocal } from "@/lib/dates";
export function TicketTypeForm({
  eventId,
  timezone,
  ticketType,
  disabled,
}: {
  eventId: string;
  timezone: string;
  ticketType?: TicketType;
  disabled: boolean;
}) {
  return (
    <ActionForm
      action={ticketTypeAction}
      resetOnSuccess={!ticketType}
      submitLabel={ticketType ? "Guardar entrada" : "Agregar tipo de entrada"}
      disabled={disabled}
    >
      <input type="hidden" name="eventId" value={eventId} />
      {ticketType && (
        <>
          <input type="hidden" name="id" value={ticketType.id} />
          <input
            type="hidden"
            name="updatedAt"
            value={ticketType.updatedAt.toISOString()}
          />
        </>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Nombre de la entrada"
          name="name"
          defaultValue={ticketType?.name}
          minLength={2}
          maxLength={100}
          required
        />
        <Field
          label="Precio en pesos (ARS)"
          name="price"
          inputMode="decimal"
          defaultValue={
            ticketType ? (ticketType.priceCents / 100).toFixed(2) : ""
          }
          hint="Hasta dos decimales. No uses separador de miles."
          required
        />
        <Field
          label="Stock total"
          name="stock"
          type="number"
          min={ticketType ? ticketType.sold + ticketType.reserved : 0}
          max={1000000}
          step={1}
          defaultValue={ticketType?.stock ?? 100}
          required
        />
        <Field
          label="Máximo por compra"
          name="maxPerOrder"
          type="number"
          min={1}
          max={100}
          step={1}
          defaultValue={ticketType?.maxPerOrder ?? 6}
          required
        />
        <Field
          label="Inicio de venta"
          name="salesStart"
          type="datetime-local"
          defaultValue={
            ticketType ? utcToLocal(ticketType.salesStart, timezone) : ""
          }
          required
        />
        <Field
          label="Cierre de venta"
          name="salesEnd"
          type="datetime-local"
          defaultValue={
            ticketType ? utcToLocal(ticketType.salesEnd, timezone) : ""
          }
          required
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Horarios en {timezone}. Se puede vender durante el torneo; el cierre
        debe ser posterior al inicio de la venta.
      </p>
      <Checkbox
        label="Tipo de entrada activo"
        name="active"
        defaultChecked={ticketType?.active ?? false}
      />
    </ActionForm>
  );
}
