import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { transaction } from "@/lib/transaction";
import { requireRole } from "./access";
import { hashPassword } from "./password";
import { controllerSchema, controllerUpdateSchema } from "./validation";
export async function listControllers(page: number) {
  await requireRole(["ADMIN"]);
  z.number().int().min(1).max(100000).parse(page);
  return getDb().user.findMany({
    where: { role: "CONTROLLER" },
    select: { id: true, name: true, email: true, active: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * 20,
    take: 21,
  });
}
export async function createController(input: unknown) {
  const actor = await requireRole(["ADMIN"]);
  const { password, ...data } = controllerSchema.parse(input);
  const passwordHash = await hashPassword(password);
  await transaction(async (tx) => {
    const user = await tx.user.create({
      data: { ...data, passwordHash, role: "CONTROLLER" },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "CONTROLLER_CREATED",
        entityType: "User",
        entityId: user.id,
      },
    });
  });
}
export async function updateController(input: unknown) {
  const actor = await requireRole(["ADMIN"]);
  const { id, active, password } = controllerUpdateSchema.parse(input);
  const passwordHash = password ? await hashPassword(password) : undefined;
  await transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id } });
    if (user.role !== "CONTROLLER")
      throw new AppError(
        "FORBIDDEN",
        "Esta operación sólo admite controladores.",
        403,
      );
    await tx.user.update({
      where: { id },
      data: {
        active,
        ...(passwordHash ? { passwordHash } : {}),
        sessionVersion: { increment: 1 },
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: passwordHash
          ? "CONTROLLER_PASSWORD_CHANGED"
          : active
            ? "CONTROLLER_ENABLED"
            : "CONTROLLER_DISABLED",
        entityType: "User",
        entityId: id,
      },
    });
  });
}
