import Link from "next/link";
import { requirePageRole } from "@/modules/users/access";
import { listCheckInEvents } from "@/modules/check-ins/service";
import { logoutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { ScannerWorkspace } from "@/components/check-ins/scanner-workspace";

export const metadata = {
  title: "Control de acceso",
  robots: { index: false, follow: false },
};

export default async function ScannerPage() {
  const user = await requirePageRole(["ADMIN", "CONTROLLER"]);
  const events = await listCheckInEvents();
  return (
    <section className="mx-auto max-w-2xl px-5 py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Control de acceso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sesión de {user.name}
          </p>
        </div>
        <form action={logoutAction}>
          <Button variant="outline">Cerrar sesión</Button>
        </form>
      </div>

      {events.length ? (
        <ScannerWorkspace events={events} />
      ) : (
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">No hay torneos disponibles</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Publicá un torneo o pausá sus ventas para habilitarlo en el control
            de acceso.
          </p>
        </div>
      )}

      {user.role === "ADMIN" && (
        <Link
          href="/admin"
          className="mt-6 inline-flex min-h-11 items-center underline"
        >
          Volver a administración
        </Link>
      )}
    </section>
  );
}
