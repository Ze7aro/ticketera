import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { transaction } from "@/lib/transaction";
import { AppError } from "@/lib/errors";
import { hashToken } from "@/modules/orders/tokens";
import { tokenSchema } from "@/modules/orders/validation";
import { paymentConfig } from "./config";
import { issueTickets } from "@/modules/tickets/issuance";
import { deliverOrderEmail } from "@/modules/notifications/service";
import {
  fetchPayment,
  mpRequest,
  safeCheckoutUrl,
  searchPayments,
  type ProviderPayment,
} from "./provider";

export async function startPayment(rawToken: string) {
  const token = tokenSchema.parse(rawToken);
  const config = paymentConfig();
  const order = await transaction(async (tx) => {
    const current = await tx.order.findUnique({
      where: { accessTokenHash: hashToken(token) },
      include: { items: true, event: true },
    });
    if (!current)
      throw new AppError("NOT_FOUND", "No encontramos la orden.", 404);
    if (
      current.status !== "PENDING" ||
      !current.reservationHeld ||
      current.expiresAt <= new Date() ||
      current.event.status !== "PUBLISHED"
    )
      throw new AppError(
        "PAYMENT_CLOSED",
        "Esta orden ya no admite iniciar pagos. Actualizá su estado.",
        409,
      );
    if (current.paymentCheckoutUrl) return { ...current, existing: true };
    if (current.paymentStartedAt)
      throw new AppError(
        "PAYMENT_PROCESSING",
        "Estamos verificando el inicio del pago. Actualizá el estado en unos minutos; no crees otro pago para esta orden.",
        409,
      );
    if (current.totalCents <= 0)
      throw new AppError(
        "PAYMENT_ZERO",
        "Esta orden no tiene un importe válido para Mercado Pago.",
      );
    await tx.order.update({
      where: { id: current.id },
      data: { paymentStartedAt: new Date() },
    });
    return { ...current, existing: false };
  });
  if (order.existing) return safeCheckoutUrl(order.paymentCheckoutUrl!);
  // Never retry a POST after an ambiguous response. The durable marker holds stock
  // until reconciliation, even if the provider created a preference but we crashed.
  const back = `${config.APP_URL}/checkout/${token}`;
  const raw = await mpRequest("/checkout/preferences", {
    external_reference: order.id,
    items: order.items.map((item) => ({
      id: item.ticketTypeId,
      title: `${order.event.name} - ${item.ticketTypeName}`.slice(0, 250),
      quantity: item.quantity,
      unit_price: item.unitPriceCents / 100,
      currency_id: order.currency,
    })),
    payer: {
      name: order.firstName,
      surname: order.lastName,
      email: order.email,
    },
    back_urls: { success: back, pending: back, failure: back },
    notification_url: `${config.APP_URL}/api/payments/webhook`,
    auto_return: "approved",
    binary_mode: true,
    payment_methods: {
      excluded_payment_types: [
        { id: "ticket" },
        { id: "atm" },
        { id: "bank_transfer" },
      ],
    },
    expires: true,
    expiration_date_from: new Date().toISOString(),
    expiration_date_to: order.expiresAt.toISOString(),
  });
  const preference = z
    .object({
      id: z.string().min(1).max(200),
      collector_id: z.union([z.number().int(), z.string()]).transform(String),
      init_point: z.url(),
      sandbox_init_point: z.url(),
    })
    .parse(raw);
  if (preference.collector_id !== config.MERCADOPAGO_COLLECTOR_ID)
    throw new AppError(
      "PAYMENT_ACCOUNT",
      "Revisá la configuración de Mercado Pago.",
      503,
    );
  const url = safeCheckoutUrl(
    config.MERCADOPAGO_MODE === "live"
      ? preference.init_point
      : preference.sandbox_init_point,
  );
  await getDb().order.update({
    where: { id: order.id },
    data: { preferenceId: preference.id, paymentCheckoutUrl: url },
  });
  return url;
}

export async function syncPayment(id: string) {
  const orderId = await applyPayment(await fetchPayment(id));
  if (orderId) await deliverOrderEmail(orderId);
}
// Only called with data fetched by the server from the authenticated provider API.
async function applyPayment(payment: ProviderPayment) {
  const config = paymentConfig();
  if (
    payment.collector_id !== config.MERCADOPAGO_COLLECTOR_ID ||
    payment.live_mode !== (config.MERCADOPAGO_MODE === "live")
  )
    throw new AppError(
      "PAYMENT_ACCOUNT",
      "Pago de otra cuenta o ambiente.",
      422,
    );
  if (!payment.external_reference) return;
  await transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: payment.external_reference! },
      include: {
        items: { include: { ticketType: true } },
        payments: true,
        event: true,
      },
    });
    if (!order) return; // unrelated seller activity
    const previous = order.payments.find(
      (item) => item.providerId === payment.id,
    );
    const global = await tx.payment.findUnique({
      where: { providerId: payment.id },
    });
    if (global && global.orderId !== order.id)
      throw new AppError(
        "PAYMENT_REFERENCE",
        "Referencia de pago inválida.",
        422,
      );
    const updatedAt = new Date(payment.date_last_updated);
    if (
      previous?.providerUpdatedAt &&
      previous.providerUpdatedAt >= updatedAt
    ) {
      await issueTickets(tx, order.id);
      return;
    }
    const amountCents = Math.round(payment.transaction_amount * 100);
    const amountValid =
      Math.abs(payment.transaction_amount * 100 - amountCents) < 0.00001;
    const reversed =
      payment.status === "refunded" ||
      payment.status === "charged_back" ||
      payment.transaction_amount_refunded > 0;
    const status = reversed
      ? "REFUNDED"
      : payment.status === "approved"
        ? "APPROVED"
        : ["rejected", "cancelled"].includes(payment.status)
          ? "REJECTED"
          : "PENDING";
    let reviewReason: string | null = null;
    let applied = previous?.applied ?? false;
    if (
      !order.paymentStartedAt ||
      !amountValid ||
      amountCents !== order.totalCents ||
      payment.currency_id !== order.currency
    )
      reviewReason = "PAYMENT_MISMATCH";
    else if (reversed || payment.status === "in_mediation")
      reviewReason = "PAYMENT_REVERSED_OR_DISPUTED";
    else if (previous?.applied && payment.status !== "approved")
      reviewReason = "PAYMENT_STATUS_REGRESSION";
    else if (status === "APPROVED" && !applied) {
      if (order.payments.some((item) => item.applied))
        reviewReason = "DUPLICATE_PAYMENT";
      else if (
        order.status === "PAYMENT_REVIEW" ||
        order.status === "CANCELLED"
      )
        reviewReason = "ORDER_REQUIRES_REVIEW";
      else if (
        !order.reservationHeld &&
        (order.event.status === "FINISHED" ||
          order.items.some((item) => item.ticketType.salesEnd <= new Date()) ||
          order.items.some(
            (item) =>
              item.ticketType.stock -
                item.ticketType.sold -
                item.ticketType.reserved <
              item.quantity,
          ))
      )
        reviewReason = "LATE_PAYMENT_NO_STOCK";
      else {
        for (const item of order.items)
          await tx.ticketType.update({
            where: { id: item.ticketTypeId },
            data: {
              sold: { increment: item.quantity },
              ...(order.reservationHeld
                ? { reserved: { decrement: item.quantity } }
                : {}),
            },
          });
        await tx.order.update({
          where: { id: order.id },
          data: { status: "PAID", paidAt: new Date(), reservationHeld: false },
        });
        applied = true;
      }
    }
    await tx.payment.upsert({
      where: { providerId: payment.id },
      create: {
        providerId: payment.id,
        orderId: order.id,
        status,
        amountCents,
        currency: payment.currency_id,
        applied,
        providerStatus: payment.status,
        providerUpdatedAt: updatedAt,
        reviewReason,
      },
      update: {
        status,
        amountCents,
        currency: payment.currency_id,
        applied,
        providerStatus: payment.status,
        providerUpdatedAt: updatedAt,
        reviewReason,
      },
    });
    if (reviewReason) {
      // Incidents on an extra payment (including its refund) must not revoke the
      // different payment that already funded this purchase.
      const fundedByAnother = order.payments.some(
        (item) => item.applied && item.providerId !== payment.id,
      );
      if (!fundedByAnother && reviewReason !== "DUPLICATE_PAYMENT")
        await tx.order.update({
          where: { id: order.id },
          data: { status: "PAYMENT_REVIEW" },
        });
      if (applied)
        await tx.ticket.updateMany({
          where: { orderId: order.id, status: "VALID" },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: "Revisión de pago",
          },
        });
    }
    await issueTickets(tx, order.id);
  });
  return payment.external_reference;
}

export async function reconcileOrder(orderId: string) {
  const order = await getDb().order.findUnique({
    where: { id: orderId },
    include: { payments: { select: { providerId: true } } },
  });
  if (!order?.paymentStartedAt) return;
  // Rotate the scheduled batch even on provider errors; never release on errors.
  await getDb().order.update({
    where: { id: orderId },
    data: { lastReconciledAt: new Date() },
  });
  const payments = await searchPayments(orderId);
  // The search index can omit a known attempt. Always refresh its authoritative ID.
  for (const known of order.payments) {
    if (!payments.some((payment) => payment.id === known.providerId))
      payments.push(await fetchPayment(known.providerId));
  }
  if (payments.some((payment) => payment.external_reference !== orderId))
    throw new AppError("PAYMENT_REFERENCE", "Conciliación inválida.", 502);
  for (const payment of payments) await applyPayment(payment);
  await transaction(async (tx) => {
    const current = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, payments: true },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { lastReconciledAt: new Date() },
    });
    // Search can lag. Keep a grace period, hold all nonterminal attempts, and
    // handle later approvals with a fresh stock check inside applyPayment.
    if (
      current.status !== "PENDING" ||
      !current.reservationHeld ||
      current.expiresAt.getTime() + 5 * 60000 > Date.now() ||
      current.payments.some(
        (item) => item.status === "PENDING" || item.reviewReason,
      )
    )
      return;
    for (const item of current.items)
      await tx.ticketType.update({
        where: { id: item.ticketTypeId },
        data: { reserved: { decrement: item.quantity } },
      });
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: current.payments.some((item) => item.status === "REJECTED")
          ? "REJECTED"
          : "EXPIRED",
        reservationHeld: false,
      },
    });
  });
}
export async function reconcileByToken(rawToken: string) {
  const token = tokenSchema.parse(rawToken);
  const order = await getDb().order.findUnique({
    where: { accessTokenHash: hashToken(token) },
    select: { id: true },
  });
  if (!order) throw new AppError("NOT_FOUND", "No encontramos la orden.", 404);
  await reconcileOrder(order.id);
  await deliverOrderEmail(order.id);
}
