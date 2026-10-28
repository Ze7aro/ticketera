import Link from "next/link";
import { listPublicEvents } from "@/modules/events/public";
import { formatEventDate } from "@/lib/format";
import { ArrowDown, CalendarDays, QrCode, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default async function HomePage() {
  const events = await listPublicEvents();
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      <section className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Nos encontramos en el tatami
          </p>
          <h1 className="max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            El próximo encuentro
            <br />
            <span className="text-primary">empieza acá.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-muted-foreground">
            Acompañá a tu dojo. Compartí la emoción del karate y viví cada
            torneo desde la tribuna.
          </p>
          <Button asChild className="mt-8">
            <a href="#torneos">
              Ver torneos <ArrowDown aria-hidden="true" size={16} />
            </a>
          </Button>
        </div>
        <div
          aria-hidden="true"
          className="relative isolate flex min-h-64 items-center justify-center overflow-hidden rounded-3xl bg-primary p-8 text-white sm:min-h-80"
        >
          <div className="absolute -right-8 -top-20 size-72 rounded-full border border-white/15" />
          <div className="absolute -bottom-24 -left-8 size-72 rounded-full border border-white/15" />
          <div className="relative w-full max-w-xs rotate-[-5deg] rounded-xl border border-white/30 bg-[#f7f5ed] p-7 text-primary shadow-xl">
            <div className="flex items-center justify-between border-b border-primary/20 pb-5">
              <span className="text-xs font-bold tracking-widest">
                KENSHUKAN
              </span>
              <Ticket size={24} />
            </div>
            <p className="mt-6 text-3xl font-bold tracking-tight">
              Un encuentro.
              <br />
              Todo tu dojo.
            </p>
            <div className="mt-7 flex items-center justify-between border-t border-dashed border-primary/30 pt-5">
              <span className="text-xs uppercase tracking-widest">
                Karate · Torneos
              </span>
              <span className="text-2xl">空手</span>
            </div>
          </div>
        </div>
      </section>
      <section id="torneos" className="scroll-mt-6 pb-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Agenda
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Próximos torneos
            </h2>
          </div>
          <span className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            {events.length ? "Agenda abierta" : "Próximamente"}
          </span>
        </div>
        {events.length ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {events.map((event) => (
              <article
                key={event.slug}
                className="min-w-0 rounded-xl border bg-card p-6"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  {event.status === "SALES_PAUSED"
                    ? "Ventas pausadas"
                    : "Torneo de karate"}
                </p>
                <h3 className="mt-3 break-words text-2xl font-semibold">
                  {event.name}
                </h3>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  {formatEventDate(event.startsAt, event.timezone)}
                  <br />
                  {event.venue}
                </p>
                <Button asChild className="mt-5">
                  <Link href={`/eventos/${event.slug}`}>
                    Ver torneo y entradas
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CalendarDays size={25} />}
            title="Estamos preparando el próximo encuentro"
          >
            <p>
              Los torneos y sus entradas estarán disponibles en este espacio
              cuando se habilite la venta.
            </p>
          </EmptyState>
        )}
      </section>
      <section
        aria-label="Una experiencia simple"
        className="grid gap-7 border-t py-10 sm:grid-cols-3"
      >
        {[
          {
            icon: Users,
            title: "Cerca de tu dojo",
            description: "Un lugar para acompañar y compartir.",
          },
          {
            icon: Ticket,
            title: "Entradas digitales",
            description: "La información de tu acceso, en tu celular.",
          },
          {
            icon: QrCode,
            title: "Ingreso con QR",
            description: "Una entrada individual para cada asistente.",
          },
        ].map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex gap-3">
            <Icon
              aria-hidden="true"
              className="mt-1 shrink-0 text-primary"
              size={20}
            />
            <div>
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
