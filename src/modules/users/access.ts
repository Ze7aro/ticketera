import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { assertRole } from "@/modules/users/policy";
import type { StaffRole } from "@/modules/users/validation";
export async function requireRole(roles: StaffRole[]) {
  const session = await auth();
  const actor = session?.user.id
    ? await getDb().user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          sessionVersion: true,
        },
      })
    : null;
  return assertRole(
    actor && actor.sessionVersion === session?.user.sessionVersion
      ? actor
      : null,
    roles,
  );
}
export async function requirePageRole(roles: StaffRole[]) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  if (!roles.includes(session.user.role)) redirect("/scanner");
  return requireRole(roles);
}
