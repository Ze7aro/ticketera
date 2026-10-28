import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { checkOrigin } from "@/lib/origin";
export const GET = handlers.GET;
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request.headers.get("origin"));
  } catch {
    return Response.json({ error: "Solicitud no permitida." }, { status: 403 });
  }
  return handlers.POST(request);
}
