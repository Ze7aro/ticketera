import { requirePageRole } from "@/modules/users/access";
import { listControllers } from "@/modules/users/service";
import {
  createControllerAction,
  updateControllerAction,
} from "@/app/admin/actions";
import { ActionForm, Field, Checkbox } from "@/components/forms/action-form";
import { Pagination, parsePage } from "@/components/pagination";
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePageRole(["ADMIN"]);
  const page = parsePage((await searchParams).page);
  const users = await listControllers(page);
  return (
    <section>
      <h1 className="text-3xl font-semibold">Controladores</h1>
      <p className="mb-8 mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        Pueden acceder al control de ingreso. No tienen acceso a torneos,
        precios, ventas ni usuarios. Desactivar o actualizar una cuenta revoca
        sus sesiones.
      </p>
      <details className="mb-8 rounded-xl border bg-card p-5">
        <summary className="min-h-11 cursor-pointer font-semibold">
          Crear controlador
        </summary>
        <ActionForm
          action={createControllerAction}
          resetOnSuccess
          submitLabel="Crear controlador"
          className="mt-4 max-w-xl"
        >
          <Field
            label="Nombre"
            name="name"
            minLength={2}
            maxLength={100}
            required
          />
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="off"
            maxLength={254}
            required
          />
          <Field
            label="Contraseña inicial"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            hint="Mínimo 12 caracteres. Compartila por un canal privado."
            required
          />
        </ActionForm>
      </details>
      <div className="grid gap-4 sm:grid-cols-2">
        {users.slice(0, 20).map((user) => (
          <article
            key={user.id}
            className="min-w-0 rounded-xl border bg-card p-5"
          >
            <h2 className="break-words text-xl font-semibold">{user.name}</h2>
            <p className="mt-2 break-all text-sm text-muted-foreground">
              {user.email}
            </p>
            <p className="my-4 text-sm font-semibold">
              {user.active ? "Activo" : "Desactivado"}
            </p>
            <ActionForm
              action={updateControllerAction}
              confirm="¿Actualizar este controlador? Se cerrarán sus sesiones anteriores."
              submitLabel="Actualizar controlador"
            >
              <input type="hidden" name="id" value={user.id} />
              <Checkbox
                label="Permitir acceso"
                name="active"
                defaultChecked={user.active}
              />
              <Field
                label="Nueva contraseña (opcional)"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                hint="Dejá vacío para conservar la contraseña actual."
              />
            </ActionForm>
          </article>
        ))}
      </div>
      {users.length === 0 && (
        <p className="rounded-xl border border-dashed p-8 text-muted-foreground">
          No hay controladores registrados.
        </p>
      )}
      <Pagination
        page={page}
        hasNext={users.length > 20}
        basePath="/admin/usuarios"
      />
    </section>
  );
}
