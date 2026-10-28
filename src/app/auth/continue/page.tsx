import { redirect } from "next/navigation";
import { requirePageRole } from "@/modules/users/access";
export default async function ContinuePage() {
  const user = await requirePageRole(["ADMIN", "CONTROLLER"]);
  redirect(user.role === "ADMIN" ? "/admin" : "/scanner");
}
