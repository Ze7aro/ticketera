import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export function publicError(error: unknown) {
  if (error instanceof AppError)
    return { status: error.status, code: error.code, message: error.message };
  if (error instanceof ZodError)
    return {
      status: 400,
      code: "INVALID_INPUT",
      message: "Revisá los datos ingresados.",
    };
  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "No pudimos completar la operación. Intentá nuevamente.",
  };
}
