import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/errors";
export function verifyPaymentSignature(
  headers: Headers,
  paymentId: string,
  secret: string,
  now = Date.now(),
) {
  const signature = headers.get("x-signature") ?? "";
  const requestId = headers.get("x-request-id") ?? "";
  const parts = signature.split(",").map((part) => part.trim().split("="));
  const ts = parts.filter(([key]) => key === "ts");
  const hashes = parts.filter(([key]) => key === "v1");
  const stamp = ts[0]?.[1] ?? "";
  const hash = hashes[0]?.[1] ?? "";
  const milliseconds = Number(stamp) * (stamp.length <= 10 ? 1000 : 1);
  if (
    !/^\d{1,30}$/.test(paymentId) ||
    !/^[\w-]{1,200}$/.test(requestId) ||
    ts.length !== 1 ||
    hashes.length !== 1 ||
    !/^\d{10,13}$/.test(stamp) ||
    !/^[a-f0-9]{64}$/i.test(hash) ||
    Math.abs(now - milliseconds) > 5 * 60000
  )
    throw new AppError("INVALID_SIGNATURE", "Notificación inválida.", 401);
  const expected = createHmac("sha256", secret)
    .update(`id:${paymentId};request-id:${requestId};ts:${stamp};`)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, "hex")))
    throw new AppError("INVALID_SIGNATURE", "Notificación inválida.", 401);
}
