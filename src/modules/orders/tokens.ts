import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { AppError } from "../../lib/errors";
import type { CheckoutInput } from "./validation";
function signature(eventId: string, token: string, issuedAt: number) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Falta configuración de tokens.");
  return createHmac("sha256", secret)
    .update(`checkout:${eventId}:${token}:${issuedAt}`)
    .digest("base64url");
}
export function issueCheckoutToken(eventId: string, now = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  return { token, issuedAt: now, signature: signature(eventId, token, now) };
}
export function verifyCheckoutToken(
  input: Pick<CheckoutInput, "eventId" | "token" | "issuedAt" | "signature">,
  now = Date.now(),
) {
  const expected = Buffer.from(
    signature(input.eventId, input.token, input.issuedAt),
  );
  const actual = Buffer.from(input.signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new AppError(
      "INVALID_FORM",
      "Formulario inválido. Volvé a abrir el torneo.",
      400,
    );
  if (input.issuedAt > now || now - input.issuedAt > 30 * 60000)
    throw new AppError(
      "FORM_EXPIRED",
      "El formulario venció. Recargá la página antes de continuar.",
    );
}
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function requestFingerprint(input: CheckoutInput) {
  const { eventId, firstName, lastName, email, phone, dni, items } = input;
  return createHash("sha256")
    .update(
      JSON.stringify({
        eventId,
        firstName,
        lastName,
        email,
        phone,
        dni,
        items: [...items].sort((a, b) =>
          a.ticketTypeId.localeCompare(b.ticketTypeId),
        ),
      }),
    )
    .digest("hex");
}
