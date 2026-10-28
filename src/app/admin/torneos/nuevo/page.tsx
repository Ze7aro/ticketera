import { EventForm } from "@/components/forms/event-form";
import { requirePageRole } from "@/modules/users/access";
export default async function NewEventPage() {
  await requirePageRole(["ADMIN"]);
  return (
    <section className="max-w-3xl">
      <h1 className="mb-3 text-3xl font-semibold">Crear torneo</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Se guardará como borrador. Podrás publicar cuando hayas configurado las
        entradas.
      </p>
      <EventForm />
    </section>
  );
}
