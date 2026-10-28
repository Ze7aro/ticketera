import type { Event } from "@/generated/prisma/client";
import { ActionForm, Field, TextArea } from "@/components/forms/action-form";
import { eventAction } from "@/app/admin/actions";
import { utcToLocal } from "@/lib/dates";
export function EventForm({ event }: { event?: Event }) {
  return (
    <ActionForm
      action={eventAction}
      disabled={event?.status === "FINISHED"}
      submitLabel={event ? "Guardar torneo" : "Crear borrador"}
    >
      {event && (
        <>
          <input type="hidden" name="id" value={event.id} />
          <input
            type="hidden"
            name="updatedAt"
            value={event.updatedAt.toISOString()}
          />
        </>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Nombre del torneo"
          name="name"
          defaultValue={event?.name}
          minLength={3}
          maxLength={150}
          required
        />
        <Field
          label="Enlace del torneo"
          name="slug"
          defaultValue={event?.slug}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          minLength={3}
          maxLength={100}
          hint="Ejemplo: copa-kenshukan-2027. Usá letras minúsculas, números y guiones."
          required
        />
        <Field
          label="Sigla para las entradas"
          name="abbreviation"
          defaultValue={event?.abbreviation ?? "KEN"}
          pattern="[A-Za-z]{2,8}"
          maxLength={8}
          required
        />
        <Field
          label="Fecha y hora del torneo"
          name="startsAt"
          type="datetime-local"
          defaultValue={event ? utcToLocal(event.startsAt, event.timezone) : ""}
          required
        />
        <Field
          label="Zona horaria"
          name="timezone"
          defaultValue={event?.timezone ?? "America/Argentina/Buenos_Aires"}
          hint="La fecha y hora se interpretan en esta zona IANA."
          maxLength={100}
          required
        />
        <Field
          label="Lugar"
          name="venue"
          defaultValue={event?.venue}
          minLength={3}
          maxLength={200}
          required
        />
      </div>
      <Field
        label="Dirección"
        name="address"
        defaultValue={event?.address}
        minLength={3}
        maxLength={300}
        required
      />
      <TextArea
        label="Descripción"
        name="description"
        defaultValue={event?.description}
        maxLength={5000}
      />
      <TextArea
        label="Condiciones de acceso"
        name="conditions"
        defaultValue={
          event?.conditions ??
          "Entrada válida para un único ingreso. No compartir el código QR."
        }
        minLength={5}
        maxLength={2000}
        required
      />
    </ActionForm>
  );
}
