import Link from "next/link";
import { requirePageRole } from "@/modules/users/access";
import { salesEvents, searchSales } from "@/modules/reports/service";
import {
  reportFilterSchema,
  type ReportFilters,
} from "@/modules/reports/validation";
import { Pagination } from "@/components/pagination";
import { formatMoney } from "@/lib/format";

const statusLabels = {
  PENDING: "Pendiente",
  PAID: "Pagada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  EXPIRED: "Vencida",
  PAYMENT_REVIEW: "En revisión",
};

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    eventId?: string;
    query?: string;
    status?: string;
    page?: string;
  }>;
}) {
  await requirePageRole(["ADMIN"]);
  const params = await searchParams;
  const parsed = reportFilterSchema.safeParse({
    ...(typeof params.eventId === "string" && params.eventId
      ? { eventId: params.eventId }
      : {}),
    ...(typeof params.query === "string" && params.query
      ? { query: params.query }
      : {}),
    ...(typeof params.status === "string" && params.status
      ? { status: params.status }
      : {}),
    page: params.page,
  });
  const filters: ReportFilters = parsed.success
    ? parsed.data
    : { eventId: undefined, query: undefined, page: 1 };
  const [events, result] = await Promise.all([
    salesEvents(),
    searchSales(filters),
  ]);
  const queryState = {
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
    ...(filters.query ? { query: filters.query } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  return (
    <section>
      <h1 className="text-3xl font-semibold">Ventas y órdenes</h1>
      <p className="mb-6 mt-3 text-sm text-muted-foreground">
        {result.count.toLocaleString("es-AR")} órdenes. Buscá por comprador,
        DNI, email, referencia o número de entrada.
      </p>
      <form
        method="get"
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Buscar</span>
          <input
            name="query"
            defaultValue={filters.query ?? ""}
            maxLength={100}
            placeholder="Nombre, email, DNI o número"
            className="min-h-12 w-full rounded-lg border bg-background px-3"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Torneo</span>
          <select
            name="eventId"
            defaultValue={filters.eventId ?? ""}
            className="min-h-12 w-full rounded-lg border bg-background px-3"
          >
            <option value="">Todos los torneos</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Estado</span>
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="min-h-12 w-full rounded-lg border bg-background px-3"
          >
            <option value="">Todos los estados</option>
            {Object.entries(statusLabels).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground">
            Aplicar filtros
          </button>
          <Link
            href="/admin/ventas"
            className="inline-flex min-h-12 items-center rounded-lg border px-4"
          >
            Limpiar
          </Link>
        </div>
      </form>

      {result.orders.length ? (
        <div className="mt-5 grid gap-3">
          {result.orders.map((order) => (
            <article
              key={order.id}
              className="min-w-0 rounded-xl border bg-card p-4 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-5"
            >
              <div className="min-w-0">
                <h2 className="break-words font-semibold">
                  {order.firstName} {order.lastName}
                </h2>
                <p className="mt-1 break-all text-sm text-muted-foreground">
                  {order.email}
                </p>
                <p className="mt-2 text-sm">
                  {order.event.name} · {order._count.tickets} entradas
                </p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  {order.id}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 sm:mt-0 sm:justify-end">
                <div className="sm:text-right">
                  <p className="font-semibold">
                    {formatMoney(order.totalCents)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {statusLabels[order.status]}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {order.createdAt.toLocaleDateString("es-AR")}
                  </p>
                </div>
                <Link
                  href={`/admin/entradas/${order.id}`}
                  className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium underline"
                >
                  Ver orden
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed p-8 text-muted-foreground">
          No encontramos órdenes con esos filtros.
        </p>
      )}
      <Pagination
        page={filters.page}
        hasNext={result.hasNext}
        basePath="/admin/ventas"
        query={queryState}
      />
    </section>
  );
}
