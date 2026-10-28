import "server-only";
import QRCode from "qrcode";
import { validAppUrl } from "@/lib/auth-config";
import { AppError } from "@/lib/errors";
import { tokenSchema } from "@/modules/orders/validation";
export function ticketUrl(token: string) {
  tokenSchema.parse(token);
  if (!validAppUrl(process.env.APP_URL))
    throw new AppError(
      "APP_CONFIG",
      "La dirección de las entradas no está configurada.",
      503,
    );
  return `${new URL(process.env.APP_URL!).origin}/entrada/${token}`;
}
export async function ticketQr(token: string) {
  return QRCode.toDataURL(ticketUrl(token), {
    width: 480,
    margin: 4,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
}
