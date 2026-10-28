"use client";
import { ActionForm } from "@/components/forms/action-form";
import {
  startPaymentAction,
  reconcilePaymentAction,
} from "@/app/checkout/payment-actions";
export function PaymentControls({
  token,
  canPay,
  started,
}: {
  token: string;
  canPay: boolean;
  started: boolean;
}) {
  return (
    <div className="my-6 space-y-5">
      {canPay && (
        <ActionForm
          action={startPaymentAction}
          submitLabel="Pagar con Mercado Pago"
        >
          <input type="hidden" name="token" value={token} />
        </ActionForm>
      )}
      {started && (
        <ActionForm
          action={reconcilePaymentAction}
          submitLabel="Consultar pago en Mercado Pago"
        >
          <input type="hidden" name="token" value={token} />
        </ActionForm>
      )}
    </div>
  );
}
