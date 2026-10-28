import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/modules/users/access";
import { getDb } from "@/lib/db";
import { decryptSecret } from "@/modules/tickets/crypto";
import { ActionForm, Field } from "@/components/forms/action-form";
import { cancelTicketAction, resendTicketsAction } from "../actions";
import { emailConfigured } from "@/modules/notifications/service";
const statuses = {
  PENDING: "Pendiente",
  SENDING: "En proceso",
  SENT: "Aceptado por el proveedor",
  REVIEW: "Requiere revisión",
  CANCELLED: "Cancelado",
};
export default async function OrderTicketsAdminPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await requirePageRole(["ADMIN"]);
  const { orderId } = await params;
  const order = await getDb().order.findUnique({
    where: { id: orderId },
    include: {
      event: { select: { name: true, timezone: true } },
      tickets: {
        orderBy: { sequence: "asc" },
        include: {
          checkIns: {
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { user: { select: { name: true } } },
          },
        },
      },
      notifications: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!order) notFound();
  return (
    <section className="max-w-3xl">
      <Link
        href="/admin/entradas"
        className="inline-flex min-h-11 items-center underline"
      >
        Volver a entradas
      </Link>
      <h1 className="my-4 break-words text-3xl font-semibold">
        {order.event.name}
      </h1>
      <p className="break-words">
        {order.firstName} {order.lastName}
      </p>
      <p className="my-3 break-all text-sm">Destino del email: {order.email}</p>
      <ul className="my-6 space-y-3">
        {order.tickets.map((ticket) => (
          <li key={ticket.id} className="rounded-lg border bg-card p-4">
            <Link
              prefetch={false}
              href={`/entrada/${decryptSecret(ticket.tokenEncrypted, `ticket:${ticket.id}`)}`}
              className="inline-flex min-h-11 items-center break-all underline"
            >
              Entrada {ticket.number}
            </Link>
            <p className="text-sm">
              {ticket.status === "VALID"
                ? "Válida"
                : ticket.status === "USED"
                  ? "Utilizada"
                  : "Anulada"}
            </p>
            {ticket.usedAt && (
              <p className="mt-1 text-sm text-muted-foreground">
                Ingreso:{" "}
                {ticket.usedAt.toLocaleString("es-AR", {
                  timeZone: order.event.timezone,
                })}
              </p>
            )}
            {ticket.cancellationReason && (
              <p className="mt-1 text-sm text-muted-foreground">
                Anulación: {ticket.cancellationReason}
              </p>
            )}
            {ticket.checkIns.length > 0 && (
              <details className="mt-3">
                <summary className="min-h-11 cursor-pointer text-sm underline">
                  Historial de validaciones ({ticket.checkIns.length})
                </summary>
                <ul className="space-y-2 text-sm">
                  {ticket.checkIns.map((checkIn) => (
                    <li key={checkIn.id}>
                      {checkIn.result} · {checkIn.user.name} ·{" "}
                      {checkIn.createdAt.toLocaleString("es-AR", {
                        timeZone: order.event.timezone,
                      })}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {ticket.status === "VALID" && (
              <ActionForm
                action={cancelTicketAction}
                className="mt-4 max-w-md"
                submitLabel="Anular entrada"
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
          </li>
        ))}
      </ul>
      {!emailConfigured() && (
        <p className="my-5 rounded-lg border bg-muted p-4 text-sm">
          El correo todavía no está configurado. Las entradas pueden descargarse
          desde sus enlaces.
        </p>
      )}
      <ActionForm
        action={resendTicketsAction}
        submitLabel="Reenviar email de entradas"
        disabled={
          !emailConfigured() ||
          order.status !== "PAID" ||
          !order.tickets.some((ticket) => ticket.status === "VALID")
        }
        confirm="¿Reenviar las mismas entradas al email del comprador? Si un envío anterior quedó incierto, podría recibir el correo más de una vez."
      >
        <input type="hidden" name="orderId" value={order.id} />
        <input type="hidden" name="requestId" value={randomUUID()} />
      </ActionForm>
      <h2 className="mt-8 text-xl font-semibold">Historial de envíos</h2>
      <ul className="mt-4 space-y-3">
        {order.notifications.map((job) => (
          <li key={job.id} className="rounded-lg border p-4 text-sm">
            <strong>{statuses[job.status]}</strong>
            <p>
              {job.attempts} intentos ·{" "}
              {job.createdAt.toLocaleString("es-AR", {
                timeZone: order.event.timezone,
              })}
            </p>
            {job.status === "REVIEW" && (
              <p>Comprobá el envío en Resend antes de solicitar otro.</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
