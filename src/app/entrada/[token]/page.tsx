import { notFound } from "next/navigation";
import { consumeLimit } from "@/lib/rate-limit";
import { getTicket } from "@/modules/tickets/service";
import { TicketCard } from "@/components/tickets/ticket-card";
import { PrintButton } from "@/components/tickets/print-button";
export const metadata = {
  title: "Entrada digital",
  robots: { index: false, follow: false },
};
export default async function TicketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await consumeLimit("ticket-read-global", "all", 600, 60);
  const { token } = await params;
  const ticket = await getTicket(token);
  if (!ticket) notFound();
  return (
    <section className="mx-auto max-w-xl px-5 py-10 print:p-0">
      <TicketCard ticket={ticket} />
      {ticket.usable && (
        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          <a
            href={`/api/tickets/${token}/pdf`}
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground"
          >
            Descargar PDF
          </a>
          <PrintButton />
        </div>
      )}
      <p className="mt-5 text-sm text-muted-foreground print:hidden">
        Guardá el PDF en tu celular antes de asistir. El control de ingreso
        necesita conexión a internet.
      </p>
    </section>
  );
}
