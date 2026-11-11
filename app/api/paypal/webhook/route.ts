// PayPal events. Only signature-verified events change state.
import { markDelivered } from "@/lib/flow.ts";
import { fail, handle } from "@/lib/http.ts";
import { verifyWebhook } from "@/lib/paypal.ts";
import { findPayment, log } from "@/lib/store.ts";

export async function POST(req: Request) {
  return handle(async () => {
    const event = await req.json();
    if (!(await verifyWebhook(req.headers, event))) return fail("Signature check failed", 401);
    const r = event.resource ?? {};
    const type: string = event.event_type ?? "";

    if (type.startsWith("PAYMENT.PAYOUTS-ITEM.")) {
      const found = findPayment((p) => p.id === r.payout_item?.sender_item_id);
      if (found) markDelivered(found.h, found.p, r.transaction_status ?? type.split(".").pop());
    } else if (type.startsWith("PAYMENT.AUTHORIZATION.") || type.startsWith("PAYMENT.CAPTURE.")) {
      const found = findPayment((p) => p.paypal.authorizationId === r.id || p.paypal.captureId === r.id || p.id === r.custom_id);
      if (found) log(found.h, "webhook", `${type} · ${r.id} ${r.status ?? ""}`.trim(), found.p.id);
    }
    return Response.json({ ok: true }); // 200 so PayPal stops retrying
  });
}
