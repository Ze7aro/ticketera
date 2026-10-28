import "server-only";
import React from "react";
import { randomUUID } from "node:crypto";
import { render, toPlainText } from "@react-email/render";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { transaction } from "@/lib/transaction";
import { encryptSecret, decryptSecret } from "@/modules/tickets/crypto";
import { ticketUrl } from "@/modules/tickets/presentation";
import { TicketsEmail } from "@/emails/tickets";
const payloadSchema = z.object({
  from: z.string(),
  to: z.array(z.email()).length(1),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
});
export function emailConfigured() {
  return (
    !!process.env.RESEND_API_KEY?.startsWith("re_") &&
    z.email().safeParse(process.env.EMAIL_FROM).success &&
    /^https:\/\//.test(process.env.APP_URL ?? "")
  );
}
async function claimEmail(id: string) {
  return transaction(async (tx) => {
    const job = await tx.ticketEmail.findUniqueOrThrow({
      where: { id },
      include: {
        order: {
          include: { event: true, tickets: { orderBy: { sequence: "asc" } } },
        },
      },
    });
    if (
      ["SENT", "REVIEW", "CANCELLED"].includes(job.status) ||
      job.nextAttemptAt > new Date() ||
      (job.leaseUntil && job.leaseUntil > new Date())
    )
      return null;
    if (job.order.status !== "PAID" || !job.order.ticketsIssuedAt) {
      await tx.ticketEmail.update({
        where: { id },
        data: {
          status: "CANCELLED",
          lastErrorCode: "ORDER_NOT_PAID",
          leaseToken: null,
          leaseUntil: null,
        },
      });
      return null;
    }
    // Resend retains idempotency keys for 24h. Stop before that guarantee expires.
    if (
      (job.firstAttemptAt &&
        Date.now() - job.firstAttemptAt.getTime() >= 23 * 3600000) ||
      job.attempts >= 5
    ) {
      await tx.ticketEmail.update({
        where: { id },
        data: {
          status: "REVIEW",
          lastErrorCode: "DELIVERY_UNCERTAIN",
          leaseToken: null,
          leaseUntil: null,
        },
      });
      return null;
    }
    let encrypted = job.payloadEncrypted;
    if (!encrypted) {
      const links = job.order.tickets
        .filter((ticket) => ticket.status === "VALID")
        .map((ticket) => ({
          number: ticket.number,
          url: ticketUrl(
            decryptSecret(ticket.tokenEncrypted, `ticket:${ticket.id}`),
          ),
        }));
      if (!links.length) {
        await tx.ticketEmail.update({
          where: { id },
          data: { status: "CANCELLED", lastErrorCode: "NO_VALID_TICKETS" },
        });
        return null;
      }
      const html = await render(
        <TicketsEmail eventName={job.order.event.name} links={links} />,
      );
      encrypted = encryptSecret(
        JSON.stringify({
          from: process.env.EMAIL_FROM!,
          to: [job.order.email],
          subject: "Tus entradas Kenshukan",
          html,
          text: toPlainText(html),
        }),
        `email:${id}`,
      );
    }
    const leaseToken = randomUUID();
    await tx.ticketEmail.update({
      where: { id },
      data: {
        status: "SENDING",
        payloadEncrypted: encrypted,
        attempts: { increment: 1 },
        firstAttemptAt: job.firstAttemptAt ?? new Date(),
        leaseUntil: new Date(Date.now() + 60000),
        leaseToken,
        lastErrorCode: null,
      },
    });
    return { id, encrypted, leaseToken, attempts: job.attempts + 1 };
  });
}
export async function deliverEmail(id: string) {
  if (!emailConfigured()) return "disabled";
  const job = await claimEmail(id);
  if (!job) return "skipped";
  try {
    const payload = payloadSchema.parse(
      JSON.parse(decryptSecret(job.encrypted, `email:${id}`)),
    );
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `tickets/${id}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("EMAIL_PROVIDER");
    const result = z
      .object({ id: z.string().min(1).max(200) })
      .parse(await response.json());
    await getDb().ticketEmail.updateMany({
      where: { id, leaseToken: job.leaseToken },
      data: {
        status: "SENT",
        sentAt: new Date(),
        providerId: result.id,
        leaseToken: null,
        leaseUntil: null,
        lastErrorCode: null,
      },
    });
    return "sent";
  } catch {
    await getDb().ticketEmail.updateMany({
      where: { id, leaseToken: job.leaseToken },
      data: {
        status: job.attempts >= 5 ? "REVIEW" : "PENDING",
        nextAttemptAt: new Date(
          Date.now() + Math.min(30, 2 ** job.attempts) * 60000,
        ),
        lastErrorCode: "EMAIL_PROVIDER",
        leaseToken: null,
        leaseUntil: null,
      },
    });
    return "failed";
  }
}
export async function deliverOrderEmail(orderId: string) {
  if (!emailConfigured()) return;
  // Notification failures must never roll back or mask payment confirmation.
  try {
    const jobs = await getDb().ticketEmail.findMany({
      where: {
        orderId,
        status: { in: ["PENDING", "SENDING"] },
        nextAttemptAt: { lte: new Date() },
      },
      take: 5,
      select: { id: true },
    });
    for (const job of jobs) await deliverEmail(job.id);
  } catch {
    /* Durable records are retried by the dispatcher or an administrator. */
  }
}
