import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { getPublicEvent } from "@/modules/events/public";
import { issueCheckoutToken } from "@/modules/orders/tokens";
import { PurchaseForm } from "@/components/orders/purchase-form";
import { formatEventDate } from "@/lib/format";
export const metadata = { title: "Entradas del torneo" };
export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const event = await getPublicEvent((await params).slug);
  if (!event) notFound();
  const now = event.asOf;
  const open = event.status === "PUBLISHED";
  return (
    <article className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <Link
        href="/#torneos"
        className="mb-5 inline-flex min-h-11 items-center text-sm underline"
      >
        Volver a torneos
      </Link>
      <p className="text-xs font-bold uppercase tracking-widest text-primary">
        Torneo de karate
      </p>
      <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-5xl">
        {event.name}
      </h1>
      <div className="my-6 space-y-3 text-sm leading-6 text-muted-foreground">
        <p className="flex gap-3">
          <CalendarDays aria-hidden="true" className="shrink-0" size={20} />
          {formatEventDate(event.startsAt, event.timezone)}
        </p>
        <p className="flex gap-3">
          <MapPin aria-hidden="true" className="shrink-0" size={20} />
          <span>
            {event.venue}
            <br />
            {event.address}
          </span>
        </p>
      </div>
      {event.description && (
        <p className="mb-8 whitespace-pre-wrap break-words leading-7">
          {event.description}
        </p>
      )}
      <section className="my-8 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Condiciones de acceso</h2>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
          {event.conditions}
        </p>
      </section>
      {open && event.ticketTypes.length > 0 ? (
        <PurchaseForm
          eventId={event.id}
          ticketTypes={event.ticketTypes}
          credential={issueCheckoutToken(event.id)}
          now={now}
        />
      ) : (
        <p role="status" className="rounded-xl border bg-muted p-6">
          {event.status === "SALES_PAUSED"
            ? "Las ventas están pausadas. Volvé a consultar más adelante."
            : event.status === "FINISHED"
              ? "El torneo finalizó y la venta de entradas está cerrada."
              : "Todavía no hay entradas disponibles para este torneo."}
        </p>
      )}
    </article>
  );
}
