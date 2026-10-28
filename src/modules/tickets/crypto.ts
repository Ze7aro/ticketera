import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AppError } from "@/lib/errors";
function key() {
  const value = process.env.TICKET_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new AppError(
      "TICKET_CONFIG",
      "La emisión de entradas requiere configuración del servidor.",
      503,
    );
  return Buffer.from(value, "hex");
}
export function encryptSecret(value: string, context: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const content = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    content.toString("base64url"),
  ].join(".");
}
export function decryptSecret(value: string, context: string) {
  const [version, iv, tag, content, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !content || extra)
    throw new Error("Invalid encrypted credential");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(content, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
