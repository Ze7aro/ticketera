import Link from "next/link";
import { requirePageRole } from "@/modules/users/access";
import { listAuditEntries } from "@/modules/reports/service";
import { auditFilterSchema } from "@/modules/reports/validation";
import { Pagination } from "@/components/pagination";

const actionLabels: Record<string, string> = {
  EVENT_CREATED: "Torneo creado",
  EVENT_UPDATED: "Torneo editado",
  EVENT_PUBLISHED: "Torneo publicado",
  EVENT_SALES_PAUSED: "Ventas pausadas",
  EVENT_FINISHED: "Torneo finalizado",
  TICKET_TYPE_CREATED: "Tipo de entrada creado",
  TICKET_TYPE_UPDATED: "Tipo de entrada editado",
  MANUAL_TICKET_ISSUED: "Entrada emitida manualmente",
  TICKET_CANCELLED: "Entrada anulada",
  CONTROLLER_CREATED: "Controlador creado",
  CONTROLLER_ENABLED: "Controlador habilitado",
  CONTROLLER_DISABLED: "Controlador desactivado",
  CONTROLLER_PASSWORD_CHANGED: "Contraseña de controlador actualizada",
  PAYMENT_RECONCILED: "Pago conciliado",
  TICKETS_EMAIL_REQUESTED: "Reenvío de entradas solicitado",
  REPORT_EXPORT_REQUESTED: "Exportación solicitada",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePageRole(["ADMIN"]);
  const params = await searchParams;
  const parsed = auditFilterSchema.safeParse({ page: params.page });
  const page = parsed.success ? parsed.data.page : 1;
  const rows = await listAuditEntries(page);
  const entries = rows.slice(0, 20);
  return (
    <section>
      <h1 className="text-3xl font-semibold">Auditoría</h1>
      <p className="mb-6 mt-3 text-sm text-muted-foreground">
        Cambios administrativos, conciliaciones y solicitudes de exportación.
      </p>
      {entries.length ? (
        <div className="space-y-3">
          {entries.map((entry) => {
            const target =
              entry.entityType === "Event" ? (
                <Link
                  href={`/admin/torneos/${entry.entityId}`}
                  className="break-all font-mono text-xs underline"
                >
                  {entry.entityId}
                </Link>
              ) : entry.entityType === "Order" ? (
                <Link
                  href={`/admin/entradas/${entry.entityId}`}
                  className="break-all font-mono text-xs underline"
                >
                  {entry.entityId}
                </Link>
              ) : (
                <span className="break-all font-mono text-xs">
                  {entry.entityId}
                </span>
              );
            return (
              <article
                key={entry.id}
                className="min-w-0 rounded-xl border bg-card p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold">
                      {actionLabels[entry.action] ??
                        entry.action.replaceAll("_", " ")}
                    </h2>
                    <p className="mt-1 break-words text-sm text-muted-foreground">
                      {entry.user.name} · {entry.user.email}
                    </p>
                  </div>
                  <time
                    dateTime={entry.createdAt.toISOString()}
                    className="text-xs text-muted-foreground"
                  >
                    {entry.createdAt.toLocaleString("es-AR", {
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                </div>
                <p className="mt-3 text-sm">
                  {entry.entityType}: {target}
                </p>
                {entry.reason && (
                  <p className="mt-2 break-words text-sm text-muted-foreground">
                    {entry.reason}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-muted-foreground">
          Todavía no hay acciones registradas.
        </p>
      )}
      <Pagination
        page={page}
        hasNext={rows.length > 20}
        basePath="/admin/auditoria"
      />
    </section>
  );
}
