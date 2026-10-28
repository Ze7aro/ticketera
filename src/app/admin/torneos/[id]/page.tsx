import { requirePageRole } from "@/modules/users/access";
import { notFound } from "next/navigation";
import { getEvent } from "@/modules/events/service";
import { idSchema } from "@/modules/users/validation";
import { eventLabels } from "@/modules/events/validation";
import { EventForm } from "@/components/forms/event-form";
import { TicketTypeForm } from "@/components/forms/ticket-type-form";
import { ActionForm } from "@/components/forms/action-form";
import { statusAction } from "@/app/admin/actions";
import { formatMoney } from "@/lib/format";
export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(["ADMIN"]);
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const event = await getEvent(id);
  if (!event) notFound();
  const finished = event.status === "FINISHED";
  const transitions = finished
    ? []
    : [
        ...(event.status === "DRAFT" || event.status === "SALES_PAUSED"
          ? [{ status: "PUBLISHED", label: "Publicar torneo" }]
          : []),
        ...(event.status === "PUBLISHED"
          ? [{ status: "SALES_PAUSED", label: "Pausar ventas" }]
          : []),
        { status: "FINISHED", label: "Finalizar torneo" },
      ];
  return (
    <div className="space-y-10">
      <section>
        <p className="mb-3 text-sm font-semibold text-primary">
          {eventLabels[event.status]}
        </p>
        <h1 className="break-words text-3xl font-semibold">{event.name}</h1>
        <div className="mt-5 flex flex-wrap gap-4">
          {transitions.map(({ status, label }) => (
            <ActionForm
              key={status}
              action={statusAction}
              submitLabel={label}
              confirm={
                status === "FINISHED"
                  ? "¿Finalizar el torneo? Se cerrarán las ventas y no se podrá volver a editar."
                  : undefined
              }
            >
              <input type="hidden" name="id" value={id} />
              <input
                type="hidden"
                name="updatedAt"
                value={event.updatedAt.toISOString()}
              />
              <input type="hidden" name="status" value={status} />
            </ActionForm>
          ))}
        </div>
      </section>
      <section className="max-w-3xl rounded-xl border bg-card p-5 sm:p-7">
        <h2 className="mb-6 text-xl font-semibold">Datos del torneo</h2>
        <EventForm event={event} />
      </section>
      <section>
        <h2 className="mb-5 text-2xl font-semibold">Tipos de entrada</h2>
        <div className="space-y-4">
          {event.ticketTypes.map((type) => (
            <details key={type.id} className="rounded-xl border bg-card p-5">
              <summary className="min-h-11 cursor-pointer break-words font-semibold">
                {type.name} · {formatMoney(type.priceCents)} ·{" "}
                {type.active ? "Activa" : "Inactiva"}
              </summary>
              <p className="mb-5 mt-3 text-sm text-muted-foreground">
                Stock: {type.stock} · Vendidas: {type.sold} · Reservadas:{" "}
                {type.reserved}
              </p>
              <TicketTypeForm
                key={type.updatedAt.toISOString()}
                eventId={id}
                timezone={event.timezone}
                ticketType={type}
                disabled={finished}
              />
            </details>
          ))}
        </div>
        {!finished && (
          <div className="mt-6 rounded-xl border bg-card p-5 sm:p-7">
            <h3 className="mb-6 text-lg font-semibold">
              Nuevo tipo de entrada
            </h3>
            <TicketTypeForm
              eventId={id}
              timezone={event.timezone}
              disabled={false}
            />
          </div>
        )}
      </section>
    </div>
  );
}
