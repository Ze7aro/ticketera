import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderSummary } from "@/modules/orders/service";
import { consumeLimit } from "@/lib/rate-limit";
import { formatMoney, formatEventDate } from "@/lib/format";
import { RefreshOrder } from "@/components/orders/refresh-order";
import { PaymentControls } from "@/components/orders/payment-controls";
import { paymentsConfigured } from "@/modules/payments/config";
import { getOrderTickets } from "@/modules/tickets/service";
export const metadata = {
  title: "Resumen de orden",
  robots: { index: false, follow: false },
};
const labels = {
  PENDING: "Orden pendiente de pago",
  EXPIRED: "Reserva vencida",
  PAID: "Pago aprobado",
  CANCELLED: "Orden cancelada",
  REJECTED: "Pago rechazado",
  PAYMENT_REVIEW: "Pago en revisión",
};
export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  await consumeLimit("order-read-global", "all", 600, 60);
  const order = await getOrderSummary(token);
  if (!order) notFound();
  const tickets = await getOrderTickets(token);
  const enabled = paymentsConfigured();
  const canPay =
    enabled && order.status === "PENDING" && order.expiresAt > new Date();
  return (
    <section className="mx-auto max-w-2xl px-5 py-12">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">
        Resumen de tu orden
      </p>
      <h1 className="text-3xl font-semibold">{labels[order.status]}</h1>
      <h2 className="mt-6 text-xl font-semibold">{order.event.name}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {formatEventDate(order.event.startsAt, order.event.timezone)} ·{" "}
        {order.event.venue}
      </p>
      <ul className="my-6 divide-y rounded-xl border bg-card px-5">
        {order.items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap justify-between gap-3 py-4"
          >
            <span>
              {item.quantity} × {item.ticketTypeName}
            </span>
            <strong>{formatMoney(item.quantity * item.unitPriceCents)}</strong>
          </li>
        ))}
      </ul>
      <p className="text-xl font-semibold">
        Total: {formatMoney(order.totalCents)}
      </p>
      {order.status === "PENDING" && (
        <div className="my-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
          <p>
            Reserva hasta{" "}
            {formatEventDate(order.expiresAt, order.event.timezone)}.
          </p>
          <p>
            {enabled
              ? "Completá el pago en Mercado Pago. La orden se confirma cuando verificamos el pago; el regreso desde Mercado Pago puede ocurrir antes de esa confirmación."
              : "El pago online todavía no está habilitado. Esta orden no es una entrada: no se realizó ningún cobro ni se confirmó el acceso."}
          </p>
          {order.paymentStartedAt && (
            <p>
              Si el plazo ya terminó, consultá el pago antes de crear otra
              orden. Conservamos la reserva mientras hay un pago pendiente de
              resolución.
            </p>
          )}
          {order.payments[0]?.status === "REJECTED" && (
            <p>
              El último intento fue rechazado. Podés volver a Mercado Pago
              mientras la reserva siga vigente.
            </p>
          )}
        </div>
      )}
      {order.status === "PAID" && (
        <p className="my-6 rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-950">
          Mercado Pago confirmó el pago. Guardá este enlace; este resumen no es
          una entrada de acceso. Abrí cada entrada para ver su QR y descargar el
          PDF.
        </p>
      )}
      {order.status === "PAID" && (
        <section className="my-6 rounded-xl border bg-card p-5">
          <h2 className="text-xl font-semibold">Tus entradas</h2>
          {tickets.length ? (
            <ul className="mt-4 space-y-3">
              {tickets.map((ticket) => (
                <li key={ticket.number}>
                  <Link
                    prefetch={false}
                    href={`/entrada/${ticket.token}`}
                    className="inline-flex min-h-11 items-center break-all font-semibold text-primary underline"
                  >
                    Ver entrada {ticket.number}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm">
              Estamos preparando tus entradas. Actualizá el estado en unos
              minutos o consultá a la organización.
            </p>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            {order.notifications[0]?.status === "SENT"
              ? "El email fue enviado al proveedor de correo. Revisá también la carpeta de spam."
              : "Podés descargar tus entradas desde aquí aunque el email todavía no haya llegado."}
          </p>
        </section>
      )}
      {order.status === "PAYMENT_REVIEW" && (
        <p className="my-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          El pago necesita revisión de la organización. No vuelvas a pagar esta
          orden. Conservá la referencia y el comprobante de Mercado Pago.
        </p>
      )}
      {order.status === "REJECTED" && (
        <p className="my-6 text-sm">
          Los intentos de pago fueron rechazados y la reserva venció. Podés
          comenzar otra orden.
        </p>
      )}
      {enabled && (
        <PaymentControls
          token={token}
          canPay={canPay}
          started={!!order.paymentStartedAt}
        />
      )}
      {order.status === "EXPIRED" && (
        <p className="my-6 rounded-xl border bg-muted p-5 text-sm leading-7">
          La reserva venció y sus entradas volvieron a estar disponibles. Podés
          comenzar otra orden si quedan entradas.
        </p>
      )}
      <p className="my-5 break-all text-xs text-muted-foreground">
        Referencia: {order.id}
      </p>
      <p className="mb-5 text-sm text-muted-foreground">
        Guardá este enlace y no lo compartas: permite consultar tu orden.
      </p>
      <div className="flex flex-wrap gap-4">
        <RefreshOrder
          expiresAt={order.expiresAt.toISOString()}
          pending={order.status === "PENDING"}
        />
        <Link
          href={`/eventos/${order.event.slug}`}
          className="inline-flex min-h-11 items-center underline"
        >
          Volver al torneo
        </Link>
      </div>
    </section>
  );
}
