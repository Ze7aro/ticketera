import { requireRole } from "@/modules/users/access";
import { consumeLimit } from "@/lib/rate-limit";
import { getDb } from "@/lib/db";
import { publicError } from "@/lib/errors";
import { exportSchema } from "@/modules/reports/validation";
import {
  exportCheckInsCsv,
  exportOrdersCsv,
  exportTicketsCsv,
} from "@/modules/reports/export";

const filenames = {
  orders: "ordenes.csv",
  tickets: "entradas.csv",
  checkins: "ingresos.csv",
};

export async function GET(request: Request) {
  try {
    const actor = await requireRole(["ADMIN"]);
    const input = exportSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    await consumeLimit("admin-report-export", actor.id, 20, 3600);
    await getDb().auditLog.create({
      data: {
        userId: actor.id,
        action: "REPORT_EXPORT_REQUESTED",
        entityType: "Report",
        entityId: input.kind,
        reason: input.eventId ? `event:${input.eventId}` : "all-events",
      },
    });
    const body =
      input.kind === "orders"
        ? exportOrdersCsv(input.eventId)
        : input.kind === "tickets"
          ? exportTicketsCsv(input.eventId)
          : exportCheckInsCsv(input.eventId);
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenames[input.kind]}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const response = publicError(error);
    return Response.json(
      { error: response.message },
      { status: response.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
