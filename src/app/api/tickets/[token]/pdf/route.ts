import { getTicket } from "@/modules/tickets/service";
import { createTicketPdf } from "@/modules/tickets/pdf";
import { consumeLimit } from "@/lib/rate-limit";
import { publicError } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  };
  try {
    const { token } = await params;
    await consumeLimit("ticket-pdf-global", "all", 120, 60);
    await consumeLimit("ticket-pdf", token, 10, 60);
    const ticket = await getTicket(token);
    if (!ticket)
      return Response.json(
        { error: "Entrada no encontrada." },
        { status: 404, headers },
      );
    if (!ticket.usable)
      return Response.json(
        { error: "Esta entrada no está habilitada." },
        { status: 409, headers },
      );
    const bytes = await createTicketPdf(ticket);
    const filename = ticket.number.replace(/[^A-Za-z0-9-]/g, "_");
    return new Response(Buffer.from(bytes), {
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="entrada-${filename}.pdf"`,
      },
    });
  } catch (error) {
    const result = publicError(error);
    return Response.json(
      { error: result.message },
      { status: result.status, headers },
    );
  }
}
