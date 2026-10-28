import { paymentConfig } from "@/modules/payments/config";
import { verifyPaymentSignature } from "@/modules/payments/signature";
import { syncPayment } from "@/modules/payments/service";
import { publicError } from "@/lib/errors";
import { consumeLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const id = params.get("data.id") ?? "";
    verifyPaymentSignature(
      request.headers,
      id,
      paymentConfig().MERCADOPAGO_WEBHOOK_SECRET,
    );
    if (params.has("type") && params.get("type") !== "payment")
      return Response.json({ received: true });
    await consumeLimit("mp-webhook", "all", 600, 60);
    // Do not use body data or browser return values as payment evidence.
    await syncPayment(id);
    return Response.json({ received: true });
  } catch (error) {
    const result = publicError(error);
    return Response.json({ error: result.code }, { status: result.status });
  }
}
