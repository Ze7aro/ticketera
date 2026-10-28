import Link from "next/link";
import { requirePageRole } from "@/modules/users/access";
import { logoutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
export const metadata = {
  title: "Administración",
  robots: { index: false, follow: false },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageRole(["ADMIN"]);
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Administración
          </p>
          <p className="mt-2 break-words text-sm text-muted-foreground">
            {user.name}
          </p>
        </div>
        <form action={logoutAction}>
          <Button variant="outline" type="submit">
            Cerrar sesión
          </Button>
        </form>
      </div>
      <nav aria-label="Administración" className="mb-8 flex flex-wrap gap-2">
        {[
          ["/admin", "Inicio"],
          ["/admin/torneos", "Torneos"],
          ["/admin/ventas", "Ventas"],
          ["/admin/pagos", "Pagos"],
          ["/admin/entradas", "Entradas y emails"],
          ["/admin/reportes", "Reportes"],
          ["/admin/auditoria", "Auditoría"],
          ["/admin/usuarios", "Controladores"],
          ["/scanner", "Control de acceso"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href!}
            className="inline-flex min-h-11 items-center rounded-lg border bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
