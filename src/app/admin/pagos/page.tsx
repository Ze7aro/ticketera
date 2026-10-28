import { requirePageRole } from "@/modules/users/access";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { paymentsConfigured } from "@/modules/payments/config";
import { ActionForm } from "@/components/forms/action-form";
import { reconcileAdminAction } from "./actions";
const reasons: Record<string, string> = {
  PAYMENT_MISMATCH:
    "El importe o la moneda no coincide, o el pago no fue iniciado por esta orden.",
  PAYMENT_REVERSED_OR_DISPUTED: "Pago reembolsado, contracargado o en disputa.",
  PAYMENT_STATUS_REGRESSION: "Cambio de estado inesperado.",
  DUPLICATE_PAYMENT: "Segundo pago aprobado: revisar devolución manual.",
  ORDER_REQUIRES_REVIEW: "La orden requiere revisión.",
  LATE_PAYMENT_NO_STOCK:
    "Pago tardío sin disponibilidad: revisar devolución manual.",
};
const orderLabels = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  PAYMENT_REVIEW: "En revisión",
  REJECTED: "Rechazado",
  EXPIRED: "Vencido",
  CANCELLED: "Cancelado",
};
const paymentLabels: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  authorized: "Autorizado",
  in_process: "En proceso",
  in_mediation: "En disputa",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  charged_back: "Contracargo",
};
export default async function PaymentsPage() {
  await requirePageRole(["ADMIN"]);
  const configured = paymentsConfigured();
  const orders = await getDb().order.findMany({
    where: { paymentStartedAt: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { event: { select: { name: true } }, payments: true },
  });
  return (
    <section>
      <h1 className="text-3xl font-semibold">Pagos y conciliación</h1>
      <p className="my-5 text-sm text-muted-foreground">
        Últimas 50 órdenes con pago iniciado. Las devoluciones se gestionan
        manualmente en Mercado Pago.
      </p>
      {!configured && (
        <p role="status" className="mb-6 rounded-xl border bg-muted p-5">
          Mercado Pago todavía no está configurado. El cobro permanece
          deshabilitado.
        </p>
      )}
      {!orders.length && (
        <p className="rounded-xl border bg-card p-6">
          Todavía no hay pagos iniciados.
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {orders.map((order) => (
          <article
            key={order.id}
            className="min-w-0 rounded-xl border bg-card p-5"
          >
            <h2 className="text-lg font-semibold">{order.event.name}</h2>
            <p className="my-2 break-all text-xs">Referencia: {order.id}</p>
            <p>
              {formatMoney(order.totalCents)} · {orderLabels[order.status]}
            </p>
            <p className="my-3 text-sm">
              {order.reservationHeld
                ? "Stock reservado"
                : "Sin reserva pendiente"}
            </p>
            {!order.preferenceId && (
              <p className="my-3 text-sm">
                El inicio del pago no tuvo confirmación. Consultá antes de
                liberar la reserva.
              </p>
            )}
            <ul className="my-4 space-y-3">
              {order.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="break-words rounded-lg bg-muted p-3 text-sm"
                >
                  Mercado Pago {payment.providerId}:{" "}
                  {paymentLabels[payment.providerStatus] ?? "En revisión"}
                  {payment.reviewReason && (
                    <p className="mt-2 font-semibold">
                      {reasons[payment.reviewReason] ?? "Revisión necesaria."}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <ActionForm
              action={reconcileAdminAction}
              submitLabel="Consultar en Mercado Pago"
              disabled={!configured}
            >
              <input type="hidden" name="orderId" value={order.id} />
            </ActionForm>
          </article>
        ))}
      </div>
    </section>
  );
}
