import { AppError } from "../../lib/errors";
import type { Actor, StaffRole } from "./validation";
export function assertRole(actor: Actor | null, roles: StaffRole[]) {
  if (!actor || !actor.active)
    throw new AppError("UNAUTHENTICATED", "Iniciá sesión para continuar.", 401);
  if (!roles.includes(actor.role))
    throw new AppError(
      "FORBIDDEN",
      "No tenés permisos para esta operación.",
      403,
    );
  return actor;
}
export function sessionIsCurrent(
  user: { active: boolean; sessionVersion: number } | null,
  version: unknown,
  issuedAt: unknown,
  now = Date.now(),
) {
  return (
    !!user?.active &&
    user.sessionVersion === version &&
    typeof issuedAt === "number" &&
    issuedAt <= now &&
    now - issuedAt < 8 * 60 * 60 * 1000
  );
}
