import { validAppUrl } from "@/lib/auth-config";
import "server-only";
import { AppError } from "@/lib/errors";
export function checkOrigin(origin: string | null) {
  const appUrl = process.env.APP_URL;
  if (!appUrl || !validAppUrl(appUrl))
    throw new Error("APP_URL no configurada.");
  if (!origin || origin !== new URL(appUrl).origin)
    throw new AppError("INVALID_ORIGIN", "Solicitud no permitida.", 403);
}
