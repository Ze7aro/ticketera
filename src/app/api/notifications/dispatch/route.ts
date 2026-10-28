import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { consumeLimit } from "@/lib/rate-limit";
import { deliverEmail, emailConfigured } from "@/modules/notifications/service";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET ?? ""}`),
    actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (
    (process.env.CRON_SECRET?.length ?? 0) < 32 ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!emailConfigured())
    return Response.json({ error: "EMAIL_DISABLED" }, { status: 503 });
  try {
    await consumeLimit("email-dispatch", "cron", 1, 60);
  } catch {
    return Response.json({ error: "RATE_LIMIT" }, { status: 429 });
  }
  const jobs = await getDb().ticketEmail.findMany({
    where: {
      status: { in: ["PENDING", "SENDING"] },
      nextAttemptAt: { lte: new Date() },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }],
    },
    orderBy: { nextAttemptAt: "asc" },
    take: 10,
    select: { id: true },
  });
  let failures = 0;
  for (const job of jobs) {
    try {
      if ((await deliverEmail(job.id)) === "failed") failures++;
    } catch {
      failures++;
    }
  }
  return Response.json(
    { processed: jobs.length - failures, failures },
    { status: failures ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
