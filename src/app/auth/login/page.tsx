import { authConfigured } from "@/lib/auth-config";
import Link from "next/link";
import { ActionForm, Field } from "@/components/forms/action-form";
import { loginAction } from "@/app/auth/actions";
export const metadata = { title: "Acceso del equipo" };
export default function LoginPage() {
  const configured = authConfigured();
  return (
    <section className="mx-auto max-w-md px-5 py-14">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">
        Equipo Kenshukan
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">Iniciar sesión</h1>
      <p className="mb-8 mt-3 text-sm leading-6 text-muted-foreground">
        Acceso para administradores y controladores. Para comprar entradas no
        necesitás una cuenta.
      </p>
      {!configured && (
        <p role="alert" className="mb-6 rounded-lg border bg-muted p-4 text-sm">
          El acceso del equipo todavía no está habilitado. Contactá al
          responsable de la instalación.
        </p>
      )}
      <ActionForm
        action={loginAction}
        submitLabel="Ingresar"
        disabled={!configured}
      >
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          maxLength={254}
          required
        />
        <Field
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
        />
      </ActionForm>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center text-sm underline"
      >
        Volver a torneos
      </Link>
    </section>
  );
}
