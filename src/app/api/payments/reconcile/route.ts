import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { reconcileOrder } from "@/modules/payments/service";
import { paymentsConfigured } from "@/modules/payments/config";
import { consumeLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    secret.length < 32 ||
    Buffer.byteLength(authorization) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(authorization), Buffer.from(expected))
  )
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!paymentsConfigured())
    return Response.json({ error: "PAYMENTS_DISABLED" }, { status: 503 });
  try {
    await consumeLimit("mp-reconcile", "cron", 1, 60);
  } catch {
    return Response.json({ error: "RATE_LIMIT" }, { status: 429 });
  }
  const orders = await getDb().order.findMany({
    where: {
      paymentStartedAt: { not: null },
      OR: [
        { status: { in: ["PENDING", "PAYMENT_REVIEW", "PAID"] } },
        { expiresAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      ],
    },
    orderBy: { lastReconciledAt: { sort: "asc", nulls: "first" } },
    take: 10,
    select: { id: true },
  });
  let failed = 0;
  for (const order of orders) {
    try {
      await reconcileOrder(order.id);
    } catch {
      failed++;
    }
  }
  return Response.json(
    { processed: orders.length - failed, failed },
    { status: failed ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
