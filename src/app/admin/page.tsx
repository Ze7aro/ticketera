import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Clock3,
  DollarSign,
  FileDown,
  LogIn,
  Search,
  Ticket,
  Users,
} from "lucide-react";
import { requirePageRole } from "@/modules/users/access";
import { dashboardMetrics } from "@/modules/reports/service";
import { reportFilterSchema } from "@/modules/reports/validation";
import { formatMoney } from "@/lib/format";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  await requirePageRole(["ADMIN"]);
  const params = await searchParams;
  const parsed = reportFilterSchema.safeParse({
    eventId: typeof params.eventId === "string" ? params.eventId : "",
  });
  const eventId = parsed.success ? parsed.data.eventId : undefined;
  const { events, metrics } = await dashboardMetrics(eventId);
  const number = (value: number) => value.toLocaleString("es-AR");
  const cards = [
    {
      label: "Entradas vendidas",
      value: number(metrics.soldTickets),
      note: "Confirmadas o emitidas manualmente",
      Icon: Ticket,
    },
    {
      label: "Disponibles",
      value: number(metrics.availableTickets),
      note: "Tipos activos en torneos publicados, menos reservas",
      Icon: CalendarDays,
    },
    {
      label: "Recaudación aprobada",
      value: formatMoney(metrics.revenueCents),
      note: "Pagos aprobados y aplicados",
      Icon: DollarSign,
    },
    {
      label: "Pagos pendientes",
      value: number(metrics.pendingOrders),
      note: "Órdenes con pago iniciado",
      Icon: Clock3,
    },
    {
      label: "Ingresos registrados",
      value: number(metrics.usedTickets),
      note: "Entradas utilizadas",
      Icon: LogIn,
    },
    {
      label: "Asistencia",
      value: `${metrics.attendancePercent}%`,
      note: "Ingresos sobre entradas activas",
      Icon: Users,
    },
  ];
  const links = [
    {
      href: "/admin/ventas",
      title: "Buscar ventas",
      text: "Filtrá órdenes por torneo, estado, comprador o número de entrada.",
      Icon: Search,
    },
    {
      href: "/admin/reportes",
      title: "Exportar información",
      text: "Descargá órdenes, entradas o ingresos en formato CSV.",
      Icon: FileDown,
    },
    {
      href: "/admin/auditoria",
      title: "Consultar auditoría",
      text: "Revisá quién realizó cambios y solicitudes administrativas.",
      Icon: ClipboardList,
    },
  ];

  return (
    <section>
      <h1 className="text-3xl font-semibold tracking-tight">Resumen</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Ventas, disponibilidad y accesos registrados en tus torneos.
      </p>
      <form method="get" className="my-6 flex flex-wrap items-end gap-3">
        <label className="block min-w-56 flex-1 sm:max-w-md">
          <span className="mb-2 block text-sm font-medium">Torneo</span>
          <select
            name="eventId"
            defaultValue={eventId ?? ""}
            className="min-h-12 w-full rounded-lg border bg-card px-3"
          >
            <option value="">Todos los torneos</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </label>
        <button className="inline-flex min-h-12 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground">
          Ver resumen
        </button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, note, Icon }) => (
          <article
            key={label}
            className="min-w-0 rounded-xl border bg-card p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-medium text-muted-foreground">
                {label}
              </h2>
              <Icon aria-hidden="true" className="shrink-0 text-primary" />
            </div>
            <p className="mt-3 break-words text-2xl font-semibold">{value}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {note}
            </p>
          </article>
        ))}
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {links.map(({ href, title, text, Icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border bg-card p-5 hover:border-primary"
          >
            <Icon aria-hidden="true" className="mb-3 text-primary" />
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {text}
            </p>
          </Link>
        ))}
        <Link
          href="/admin/torneos"
          className="rounded-xl border bg-card p-5 hover:border-primary"
        >
          <CalendarDays aria-hidden="true" className="mb-3 text-primary" />
          <h2 className="font-semibold">Torneos y entradas</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Configurá fechas, lugares, precios y disponibilidad.
          </p>
        </Link>
        <Link
          href="/admin/usuarios"
          className="rounded-xl border bg-card p-5 hover:border-primary"
        >
          <Users aria-hidden="true" className="mb-3 text-primary" />
          <h2 className="font-semibold">Controladores</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Administrá los accesos del equipo de ingreso.
          </p>
        </Link>
      </div>
    </section>
  );
}
