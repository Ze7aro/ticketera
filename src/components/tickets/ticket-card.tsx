import { ticketQr } from "@/modules/tickets/presentation";
import type { TicketView } from "@/modules/tickets/service";
import { formatEventDate } from "@/lib/format";
export async function TicketCard({ ticket }: { ticket: TicketView }) {
  const qr = ticket.usable ? await ticketQr(ticket.token) : null;
  const status =
    ticket.status === "CANCELLED"
      ? "Entrada anulada"
      : ticket.status === "USED"
        ? "Entrada ya utilizada"
        : ticket.usable
          ? "Entrada válida"
          : "Entrada no habilitada";
  return (
    <article className="ticket-card overflow-hidden rounded-2xl border bg-card print:rounded-none print:border-0">
      <div className="bg-primary px-6 py-5 text-primary-foreground print:bg-white print:text-black">
        <p className="text-xs font-bold uppercase tracking-widest">
          Kenshukan · Entrada digital
        </p>
        <h1 className="mt-3 break-words text-2xl font-semibold">
          {ticket.event.name}
        </h1>
      </div>
      <div className="space-y-5 p-6">
        <p
          className={`rounded-lg border p-3 font-semibold ${ticket.usable ? "border-green-200 bg-green-50 text-green-950" : "border-red-200 bg-red-50 text-red-950"}`}
        >
          {status}
        </p>
        <p className="break-words font-semibold">
          {formatEventDate(ticket.event.startsAt, ticket.event.timezone)}
        </p>
        <p className="break-words">
          {ticket.event.venue}
          <br />
          <span className="text-sm text-muted-foreground">
            {ticket.event.address}
          </span>
        </p>
        <dl className="space-y-3">
          <div>
            <dt className="text-xs text-muted-foreground">Tipo de entrada</dt>
            <dd className="break-words font-semibold">{ticket.typeName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Titular de la compra
            </dt>
            <dd className="break-words">{ticket.attendeeName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Número de entrada</dt>
            <dd className="break-all font-mono text-lg font-semibold">
              {ticket.number}
            </dd>
          </div>
        </dl>
        {ticket.usable ? (
          <div className="text-center">
            {/* A data URL keeps the private QR off remote image services. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr!}
              alt="Código QR individual de esta entrada"
              width={240}
              height={240}
              className="mx-auto size-60 max-w-full"
            />
            <p className="mt-3 text-sm font-semibold">
              Un código por persona · Un único ingreso
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              No compartas este código. La validez se comprueba al ingresar.
            </p>
          </div>
        ) : (
          <p className="text-sm">
            Esta entrada no permite un nuevo ingreso. Consultá a la organización
            si necesitás asistencia.
          </p>
        )}
        <div className="border-t pt-4">
          <h2 className="text-sm font-semibold">Condiciones de acceso</h2>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
            {ticket.event.conditions}
          </p>
        </div>
      </div>
    </article>
  );
}
