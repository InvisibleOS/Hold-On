// PayPal sends Rose back here after she approves saving her PayPal.
import { createPaymentToken } from "@/lib/paypal.ts";
import { fail, handle } from "@/lib/http.ts";
import { getHousehold, log } from "@/lib/store.ts";

export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const h = getHousehold(url.searchParams.get("h") ?? "");
    const token = url.searchParams.get("approval_token_id") ?? url.searchParams.get("token");
    if (!token) return fail("PayPal didn't return an approval token");
    const { vaultId } = await createPaymentToken(token);
    h.rose.vaultId = vaultId;
    log(h, "paypal", `Vault payment token ${vaultId} saved — Rose's PayPal is linked`);
    const base = process.env.PUBLIC_URL ?? url.origin;
    return Response.redirect(`${base}/setup?h=${h.id}&linked=ok`, 303);
  });
}
