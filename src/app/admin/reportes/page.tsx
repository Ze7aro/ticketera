import { requirePageRole } from "@/modules/users/access";
import { salesEvents } from "@/modules/reports/service";

export default async function ReportsPage() {
  await requirePageRole(["ADMIN"]);
  const events = await salesEvents();
  return (
    <section className="max-w-3xl">
      <h1 className="text-3xl font-semibold">Reportes y exportaciones</h1>
      <p className="mb-6 mt-3 text-sm leading-6 text-muted-foreground">
        Descargá listados para organizar ventas y acceso. Los archivos pueden
        contener datos personales; guardalos en un lugar seguro.
      </p>
      <form
        action="/api/admin/exports"
        method="get"
        className="rounded-xl border bg-card p-5 sm:p-7"
      >
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Torneo</span>
          <select
            name="eventId"
            defaultValue=""
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
        <fieldset className="mt-6 grid gap-3">
          <legend className="mb-2 text-sm font-medium">Elegí el archivo</legend>
          <button
            name="kind"
            value="orders"
            className="min-h-12 rounded-lg border px-4 text-left font-medium hover:bg-muted"
          >
            Órdenes y compradores (incluye DNI y contacto)
          </button>
          <button
            name="kind"
            value="tickets"
            className="min-h-12 rounded-lg border px-4 text-left font-medium hover:bg-muted"
          >
            Entradas y estado de acceso
          </button>
          <button
            name="kind"
            value="checkins"
            className="min-h-12 rounded-lg border px-4 text-left font-medium hover:bg-muted"
          >
            Historial de ingresos y validaciones
          </button>
        </fieldset>
      </form>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Los campos de texto se protegen contra fórmulas de hoja de cálculo. Cada
        solicitud de exportación queda registrada en auditoría.
      </p>
    </section>
  );
}
