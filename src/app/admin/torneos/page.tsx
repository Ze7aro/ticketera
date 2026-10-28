import { requirePageRole } from "@/modules/users/access";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { listEvents } from "@/modules/events/service";
import { eventLabels } from "@/modules/events/validation";
import { formatEventDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Pagination, parsePage } from "@/components/pagination";
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePageRole(["ADMIN"]);
  const page = parsePage((await searchParams).page);
  const events = await listEvents(page);
  return (
    <section>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Torneos</h1>
        <Button asChild>
          <Link href="/admin/torneos/nuevo">Crear torneo</Link>
        </Button>
      </div>
      {events.length === 0 ? (
        <EmptyState icon={<CalendarDays />} title="Todavía no hay torneos">
          <p>Creá el primer torneo y luego configurá sus tipos de entrada.</p>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.slice(0, 20).map((event) => (
            <article
              key={event.id}
              className="min-w-0 rounded-xl border bg-card p-5"
            >
              <p className="mb-3 inline-block rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                {eventLabels[event.status]}
              </p>
              <h2 className="break-words text-xl font-semibold">
                {event.name}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {formatEventDate(event.startsAt, event.timezone)}
                <br />
                {event.venue}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {event._count.ticketTypes} tipos de entrada
              </p>
              <Link
                href={`/admin/torneos/${event.id}`}
                className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline"
              >
                Administrar torneo
              </Link>
            </article>
          ))}
        </div>
      )}
      <Pagination
        page={page}
        hasNext={events.length > 20}
        basePath="/admin/torneos"
      />
    </section>
  );
}
