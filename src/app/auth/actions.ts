"use server";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { checkOrigin } from "@/lib/origin";
import type { FormState } from "@/lib/form-state";
import { loginSchema } from "@/modules/users/validation";
export async function loginAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    checkOrigin((await headers()).get("origin"));
  } catch {
    return { error: "Solicitud no permitida." };
  }
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "Ingresá un email válido y tu contraseña." };
  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: "/auth/continue",
    });
  } catch (error) {
    if (error instanceof AuthError)
      return {
        error:
          "No pudimos iniciar sesión. Revisá tus datos o esperá unos minutos antes de reintentar.",
      };
    throw error;
  }
  return {};
}
export async function logoutAction() {
  checkOrigin((await headers()).get("origin"));
  await signOut({ redirectTo: "/auth/login" });
}
