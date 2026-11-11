// "Link my PayPal": Vault v3 setup token → PayPal approval page → back to /api/link/return.
import { createSetupToken } from "@/lib/paypal.ts";
import { fail, handle } from "@/lib/http.ts";
import { getHousehold, log } from "@/lib/store.ts";

export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const h = getHousehold(url.searchParams.get("h") ?? "");
    if (!process.env.PAYPAL_CLIENT_ID) return fail("PayPal isn't configured on this server (demo mode)", 503);
    const base = process.env.PUBLIC_URL ?? url.origin;
    const { setupTokenId, approveUrl } = await createSetupToken(
      `${base}/api/link/return?h=${h.id}`,
      `${base}/setup?h=${h.id}&linked=cancelled`,
    );
    log(h, "paypal", `Vault setup token ${setupTokenId} created — waiting for Rose to approve`);
    return Response.redirect(approveUrl, 303);
  });
}
