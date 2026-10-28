import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/modules/users/password";
import { assertRole, sessionIsCurrent } from "../../src/modules/users/policy";
import {
  controllerSchema,
  loginSchema,
  type Actor,
} from "../../src/modules/users/validation";
import { eventSchema } from "../../src/modules/events/validation";
import {
  ticketTypeSchema,
  priceSchema,
} from "../../src/modules/ticket-types/validation";
import { localToUtc, utcToLocal } from "../../src/lib/dates";
const controller: Actor = {
  id: "user",
  name: "Control",
  email: "control@example.com",
  role: "CONTROLLER",
  active: true,
  sessionVersion: 0,
};
describe("contraseñas", () => {
  it("sal aleatoria, hash seguro y verificación sin aceptar otra contraseña", async () => {
    const first = await hashPassword("una-frase-privada-larga");
    const second = await hashPassword("una-frase-privada-larga");
    expect(first).not.toBe(second);
    expect(first).not.toContain("una-frase");
    expect(await verifyPassword("una-frase-privada-larga", first)).toBe(true);
    expect(await verifyPassword("incorrecta", first)).toBe(false);
    expect(await verifyPassword("x", "scrypt$999999999999$8$1$bad$bad")).toBe(
      false,
    );
  }, 15000);
});
describe("autorización y revocación", () => {
  it("rechaza anónimos y usuarios desactivados", () => {
    expect(() => assertRole(null, ["ADMIN"])).toThrow("Iniciá sesión");
    expect(() =>
      assertRole({ ...controller, active: false }, ["CONTROLLER"]),
    ).toThrow("Iniciá sesión");
  });
  it("controlador no puede administrar", () => {
    expect(() => assertRole(controller, ["ADMIN"])).toThrow(
      "No tenés permisos",
    );
  });
  it("ambos roles pueden acceder a control de ingreso", () => {
    expect(assertRole(controller, ["ADMIN", "CONTROLLER"])).toBe(controller);
    expect(assertRole({ ...controller, role: "ADMIN" }, ["ADMIN"]).role).toBe(
      "ADMIN",
    );
  });
  it("expira a las ocho horas y revoca cambios de versión", () => {
    const now = Date.now();
    expect(sessionIsCurrent(controller, 0, now - 1000, now)).toBe(true);
    expect(sessionIsCurrent(controller, 0, now - 8 * 3600000, now)).toBe(false);
    expect(
      sessionIsCurrent({ ...controller, sessionVersion: 1 }, 0, now, now),
    ).toBe(false);
    expect(
      sessionIsCurrent({ ...controller, active: false }, 0, now, now),
    ).toBe(false);
    expect(sessionIsCurrent(controller, 0, now + 1, now)).toBe(false);
  });
});
describe("validaciones administrativas", () => {
  it("normaliza email, exige contraseña larga al crear y limita entrada en login", () => {
    expect(
      loginSchema.parse({ email: " Admin@Example.com ", password: "x" }).email,
    ).toBe("admin@example.com");
    expect(
      controllerSchema.safeParse({
        name: "Control",
        email: "x@y.com",
        password: "short",
      }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ email: "x@y.com", password: "x".repeat(129) })
        .success,
    ).toBe(false);
  });
  it.each([
    ["123,45", 12345],
    ["0", 0],
    ["100.5", 10050],
  ])("convierte %s sin aritmética de punto flotante", (input, expected) => {
    expect(priceSchema.parse(input)).toBe(expected);
  });
  it.each(["-1", "1.234,56", "0.001", "1e3", "Infinity", "10000000"])(
    "rechaza precio %s",
    (value) => {
      expect(priceSchema.safeParse(value).success).toBe(false);
    },
  );
  it("rechaza cantidades negativas y períodos invertidos", () => {
    expect(
      ticketTypeSchema.safeParse({
        name: "General",
        price: "1",
        stock: "-1",
        maxPerOrder: "0",
        salesStart: "2027-01-02T10:00",
        salesEnd: "2027-01-01T10:00",
        active: true,
      }).success,
    ).toBe(false);
  });
  it("valida zona horaria y enlace", () => {
    expect(
      eventSchema.safeParse({
        name: "Copa",
        slug: "../admin",
        abbreviation: "KEN",
        description: "",
        venue: "Dojo",
        address: "Calle",
        startsAt: "2027-01-01T10:00",
        timezone: "inventada",
        conditions: "Ingreso único",
      }).success,
    ).toBe(false);
  });
});
describe("horarios", () => {
  it("interpreta el horario del torneo en Argentina y guarda UTC", () => {
    const date = localToUtc(
      "2027-01-01T10:00",
      "America/Argentina/Buenos_Aires",
    );
    expect(date.toISOString()).toBe("2027-01-01T13:00:00.000Z");
    expect(utcToLocal(date, "America/Argentina/Buenos_Aires")).toBe(
      "2027-01-01T10:00",
    );
  });
  it("rechaza horas inexistentes o ambiguas por cambio de horario", () => {
    expect(() => localToUtc("2026-03-08T02:30", "America/New_York")).toThrow();
    expect(() => localToUtc("2026-11-01T01:30", "America/New_York")).toThrow();
  });
});
