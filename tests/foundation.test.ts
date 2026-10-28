import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError, publicError } from "../src/lib/errors";
import { formatMoney, formatEventDate } from "../src/lib/format";

describe("errores públicos", () => {
  it("no revela secretos de errores internos", () => {
    const result = publicError(
      new Error("postgres://user:secret@host/database"),
    );
    expect(result.status).toBe(500);
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("expone errores de negocio controlados", () => {
    expect(
      publicError(new AppError("SOLD_OUT", "Sin entradas disponibles.", 409)),
    ).toEqual({
      status: 409,
      code: "SOLD_OUT",
      message: "Sin entradas disponibles.",
    });
  });
  it("no expone los valores de validación", () => {
    const result = z.email().safeParse("dato-privado");
    if (result.success) throw new Error("Se esperaba un error");
    expect(publicError(result.error)).toMatchObject({
      status: 400,
      code: "INVALID_INPUT",
    });
    expect(JSON.stringify(publicError(result.error))).not.toContain(
      "dato-privado",
    );
  });
});
describe("formatos", () => {
  it("convierte centavos a pesos sin perder la fracción", () => {
    expect(formatMoney(123456)).toContain("1.234,56");
  });
  it.each([-1, 1.5, NaN, Infinity])(
    "rechaza importes inválidos: %s",
    (value) => {
      expect(() => formatMoney(value)).toThrow(RangeError);
    },
  );
  it("aplica la zona del torneo y no la del servidor", () => {
    expect(
      formatEventDate(
        new Date("2026-09-26T02:00:00Z"),
        "America/Argentina/Buenos_Aires",
      ),
    ).toContain("25 de septiembre");
  });
});
