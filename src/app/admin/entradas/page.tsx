import Link from "next/link";
import { requirePageRole } from "@/modules/users/access";
import { getDb } from "@/lib/db";
import { decryptSecret } from "@/modules/tickets/crypto";
import {
  manualTicketOptions,
  recentManualTickets,
} from "@/modules/tickets/admin";
import { ActionForm, Field } from "@/components/forms/action-form";
import { Pagination, parsePage } from "@/components/pagination";
import { cancelTicketAction, issueManualTicketAction } from "./actions";

export default async function TicketsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePageRole(["ADMIN"]);
  const page = parsePage((await searchParams).page);
  const [orders, options, manualTickets] = await Promise.all([
    getDb().order.findMany({
      where: { OR: [{ ticketsIssuedAt: { not: null } }, { status: "PAID" }] },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        event: { select: { name: true } },
        _count: { select: { tickets: true } },
      },
    }),
    manualTicketOptions(),
    recentManualTickets(page),
  ]);
  return (
    <section className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold">Entradas</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Consultá órdenes, emití entradas presenciales y revisá las entradas
          creadas manualmente.
        </p>
      </div>

      <section className="max-w-3xl rounded-xl border bg-card p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Emisión manual</h2>
        <p className="mb-6 mt-2 text-sm leading-6 text-muted-foreground">
          Para una venta presencial. Se descuenta una unidad disponible y queda
          registrado el motivo; el pago se registra fuera de la plataforma.
        </p>
        {options.length ? (
          <ActionForm
            action={issueManualTicketAction}
            resetOnSuccess
            submitLabel="Emitir entrada"
          >
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">
                Torneo y tipo de entrada
              </span>
              <select
                name="ticketTypeId"
                required
                className="min-h-11 w-full rounded-lg border bg-background px-3"
              >
                {options.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.event.name} — {type.name} · disponibles{" "}
                    {type.stock - type.sold - type.reserved}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Nombre del asistente"
              name="attendeeName"
              minLength={2}
              maxLength={100}
              required
            />
            <Field
              label="Motivo de emisión"
              name="reason"
              minLength={4}
              maxLength={250}
              placeholder="Ej.: venta en boletería"
              required
            />
          </ActionForm>
        ) : (
          <p className="rounded-lg bg-muted p-4 text-sm">
            No hay tipos de entrada activos con disponibilidad en torneos
            publicados y dentro del período de venta.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold">Entradas manuales</h2>
        {manualTickets.length ? (
          <div className="space-y-3">
            {manualTickets.slice(0, 20).map((ticket) => (
              <article
                key={ticket.id}
                className="min-w-0 rounded-xl border bg-card p-4 sm:flex sm:items-center sm:justify-between sm:gap-5"
              >
                <div className="min-w-0">
                  <p className="break-words font-semibold">
                    {ticket.attendeeName}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {ticket.event.name} · {ticket.ticketType.name} ·{" "}
                    {ticket.number}
                  </p>
                  <p className="mt-1 text-sm">
                    {ticket.status === "VALID"
                      ? "Válida"
                      : ticket.status === "USED"
                        ? "Utilizada"
                        : "Anulada"}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 sm:mt-0">
                  <Link
                    prefetch={false}
                    href={`/entrada/${decryptSecret(ticket.tokenEncrypted, `ticket:${ticket.id}`)}`}
                    className="inline-flex min-h-11 items-center rounded-lg border px-4 underline"
                  >
                    Abrir entrada
                  </Link>
                  {ticket.status === "VALID" && (
                    <ActionForm
                      action={cancelTicketAction}
                      submitLabel="Anular"
                      confirm={`¿Anular la entrada ${ticket.number}? Esta acción no se puede deshacer.`}
                    >
                      <input type="hidden" name="ticketId" value={ticket.id} />
                      <Field
                        label="Motivo de anulación"
                        name="reason"
                        minLength={4}
                        maxLength={250}
                        required
                      />
                    </ActionForm>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-muted-foreground">
            Todavía no hay entradas emitidas manualmente.
          </p>
        )}
        <Pagination
          page={page}
          hasNext={manualTickets.length > 20}
          basePath="/admin/entradas"
        />
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold">Órdenes con entradas</h2>
        {orders.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {orders.map((order) => (
              <article
                key={order.id}
                className="min-w-0 rounded-xl border bg-card p-5"
              >
                <h3 className="break-words text-lg font-semibold">
                  {order.event.name}
                </h3>
                <p className="my-3 break-words">
                  {order.firstName} {order.lastName}
                </p>
                <p>{order._count.tickets} entradas emitidas</p>
                <Link
                  className="mt-3 inline-flex min-h-11 items-center underline"
                  href={`/admin/entradas/${order.id}`}
                >
                  Ver entradas y envío
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-muted-foreground">
            Todavía no hay órdenes con entradas.
          </p>
        )}
      </section>
    </section>
  );
}
