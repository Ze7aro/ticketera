import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";

function isTransactionConflict(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  )
    return true;
  if (!error || typeof error !== "object") return false;
  const adapterError = error as { name?: unknown; cause?: unknown };
  if (
    adapterError.name !== "DriverAdapterError" ||
    !adapterError.cause ||
    typeof adapterError.cause !== "object"
  )
    return false;
  return (
    (adapterError.cause as { kind?: unknown }).kind ===
    "TransactionWriteConflict"
  );
}

export async function transaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await getDb().$transaction(work, {
        isolationLevel: "Serializable",
        maxWait: 10000,
        timeout: 10000,
      });
    } catch (error) {
      if (isTransactionConflict(error)) {
        if (attempt < 2) {
          await new Promise((resolve) =>
            setTimeout(resolve, 25 * (attempt + 1)),
          );
          continue;
        }
        throw new AppError(
          "CONFLICT",
          "Hubo otro cambio simultáneo. Recargá e intentá nuevamente.",
          409,
        );
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002")
          throw new AppError(
            "DUPLICATE",
            "Ese enlace, nombre o email ya está registrado.",
            409,
          );
        if (error.code === "P2025")
          throw new AppError("NOT_FOUND", "No encontramos el registro.", 404);
      }
      throw error;
    }
  }
  throw new Error("Transaction retry exhausted");
}
export function assertUnchanged(actual: Date, expected: string) {
  if (actual.toISOString() !== expected)
    throw new AppError(
      "STALE_DATA",
      "Otra persona modificó este registro. Recargá antes de guardar.",
      409,
    );
}
