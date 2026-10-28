import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { assertRole } from "../../src/modules/users/policy";
import type { Actor, StaffRole } from "../../src/modules/users/validation";
const state = vi.hoisted(() => ({ actor: null as Actor | null }));
vi.mock("@/modules/users/access", () => ({
  requireRole: async (roles: StaffRole[]) => assertRole(state.actor, roles),
}));
import { getDb } from "../../src/lib/db";
import {
  saveEvent,
  changeEventStatus,
  listEvents,
  getEvent,
} from "../../src/modules/events/service";
import { saveTicketType } from "../../src/modules/ticket-types/service";
import {
  createController,
  updateController,
  listControllers,
} from "../../src/modules/users/service";
import { consumeLimit } from "../../src/lib/rate-limit";
import { checkOrigin } from "../../src/lib/origin";

const url = process.env.TEST_DATABASE_URL;
if (url && new URL(url).pathname !== "/ticketera_test")
  throw new Error("Se requiere una base de prueba aislada.");
if (url) process.env.DATABASE_URL = url;
const eventInput = {
  name: "Copa integración",
  slug: `copa-${randomUUID()}`,
  abbreviation: "TST",
  description: "",
  venue: "Estadio",
  address: "Calle 123",
  startsAt: "2030-10-20T10:00",
  timezone: "America/Argentina/Buenos_Aires",
  conditions: "Un único ingreso.",
};
let eventId: string;
let userId: string;
describe.skipIf(!url)("administración con PostgreSQL", () => {
  beforeAll(async () => {
    const actor = await getDb().user.create({
      data: {
        name: "Test admin",
        email: `admin-${randomUUID()}@example.com`,
        passwordHash: "unusable-integration-account",
        role: "ADMIN",
      },
    });
    state.actor = actor;
    userId = actor.id;
  });
  afterAll(async () => {
    await getDb().$disconnect();
  });
  it("controlador no puede ejecutar ninguna lectura ni mutación administrativa", async () => {
    const saved = state.actor!;
    state.actor = { ...saved, role: "CONTROLLER" };
    const operations = [
      () => listEvents(1),
      () => getEvent("invalid"),
      () => saveEvent({}),
      () => changeEventStatus({}),
      () => saveTicketType("invalid", {}),
      () => createController({}),
      () => updateController({}),
      () => listControllers(1),
    ];
    for (const operation of operations)
      await expect(operation()).rejects.toMatchObject({ status: 403 });
    state.actor = saved;
  });
  it("crea borrador, impide publicación sin entradas y registra auditoría", async () => {
    eventId = await saveEvent(eventInput);
    const event = await getDb().event.findUniqueOrThrow({
      where: { id: eventId },
    });
    expect(event.status).toBe("DRAFT");
    expect(
      await getDb().auditLog.count({
        where: { entityId: eventId, userId, action: "EVENT_CREATED" },
      }),
    ).toBe(1);
    await expect(
      changeEventStatus({
        id: eventId,
        status: "PUBLISHED",
        updatedAt: event.updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({ code: "NO_TICKETS" });
  });
  it("crea entradas, publica y rechaza un formulario obsoleto", async () => {
    await saveTicketType(eventId, {
      name: "General",
      price: "10,99",
      stock: "10",
      maxPerOrder: "4",
      salesStart: "2030-09-01T10:00",
      salesEnd: "2030-10-20T09:00",
      active: true,
    });
    const event = await getDb().event.findUniqueOrThrow({
      where: { id: eventId },
    });
    await changeEventStatus({
      id: eventId,
      status: "PUBLISHED",
      updatedAt: event.updatedAt.toISOString(),
    });
    await expect(
      saveEvent(eventInput, eventId, event.updatedAt.toISOString()),
    ).rejects.toMatchObject({ code: "STALE_DATA" });
    expect(
      (await getDb().ticketType.findFirstOrThrow({ where: { eventId } }))
        .priceCents,
    ).toBe(1099);
  });
  it("protege stock comprometido tanto en servicio como en SQL", async () => {
    let type = await getDb().ticketType.findFirstOrThrow({
      where: { eventId },
    });
    type = await getDb().ticketType.update({
      where: { id: type.id },
      data: { sold: 5, reserved: 2 },
    });
    await expect(
      saveTicketType(
        eventId,
        {
          name: "General",
          price: "10",
          stock: "6",
          maxPerOrder: "4",
          salesStart: "2030-09-01T10:00",
          salesEnd: "2030-10-20T09:00",
          active: true,
        },
        type.id,
        type.updatedAt.toISOString(),
      ),
    ).rejects.toMatchObject({ code: "STOCK_COMMITTED" });
    await expect(
      getDb().ticketType.update({ where: { id: type.id }, data: { stock: 1 } }),
    ).rejects.toThrow();
  });
  it("dos ediciones simultáneas no se sobrescriben silenciosamente", async () => {
    const event = await getDb().event.findUniqueOrThrow({
      where: { id: eventId },
    });
    const results = await Promise.allSettled([
      saveEvent(
        { ...eventInput, name: "Cambio A" },
        eventId,
        event.updatedAt.toISOString(),
      ),
      saveEvent(
        { ...eventInput, name: "Cambio B" },
        eventId,
        event.updatedAt.toISOString(),
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("limita intentos concurrentes de forma persistente", async () => {
    const key = randomUUID();
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => consumeLimit("test", key, 2, 60)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(3);
  });
  it("desactivar controlador revoca sesiones y nunca permite modificar administradores", async () => {
    const email = `control-${randomUUID()}@example.com`;
    await createController({
      name: "Control",
      email,
      password: "Integration-test-long!",
    });
    const user = await getDb().user.findUniqueOrThrow({ where: { email } });
    await updateController({ id: user.id, active: false, password: "" });
    const updated = await getDb().user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(updated.active).toBe(false);
    expect(updated.sessionVersion).toBe(user.sessionVersion + 1);
    await expect(
      updateController({ id: userId, active: false, password: "" }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("rechaza origen ajeno o ausente", () => {
    expect(() => checkOrigin("https://evil.example")).toThrow();
    expect(() => checkOrigin(null)).toThrow();
    expect(() =>
      checkOrigin(new URL(process.env.APP_URL!).origin),
    ).not.toThrow();
  });
});
