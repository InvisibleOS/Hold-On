// Phase 0 sandbox checks. Run: node scripts/spike.ts <step>
//   link            -> prints a URL; open it and log in as Rose's sandbox account
//   vault <token>   -> turns the approved setup token into ROSE_VAULT_ID
//   hold            -> authorize $10 + void, then authorize $10 + capture + payout to Jake (PayPal and Venmo)
//   invoice         -> scammer app sends the fake SecureShield invoice to Rose
//   ai              -> times one structured verdict call
//   webhook <url>   -> registers <url>/api/paypal/webhook with PayPal, prints PAYPAL_WEBHOOK_ID
import * as pp from "../lib/paypal.ts";

process.loadEnvFile(".env.local");
const env = (k: string) => process.env[k] ?? (() => { throw new Error(`Set ${k} in .env.local`); })();
const [step, arg] = process.argv.slice(2);
const t0 = Date.now();
const ms = () => `${Date.now() - t0}ms`;

if (step === "link") {
  const { setupTokenId, approveUrl } = await pp.createSetupToken("https://example.com/return", "https://example.com/cancel");
  console.log({ setupTokenId, approveUrl }, "\nOpen approveUrl, log in as Rose, then: node scripts/spike.ts vault", setupTokenId);
} else if (step === "vault") {
  console.log(await pp.createPaymentToken(arg), "\n-> put vaultId in .env.local as ROSE_VAULT_ID");
} else if (step === "hold") {
  const vaultId = env("ROSE_VAULT_ID");
  const voidId = `spike-${Date.now()}-a`;
  const a = await pp.authorize({ vaultId, amount: "10.00", description: "Spike void", paymentId: voidId });
  console.log("authorized", a, ms());
  await pp.voidAuthorization(a.authorizationId, voidId);
  console.log("voided", ms());

  const id = `spike-${Date.now()}-b`;
  const b = await pp.authorize({ vaultId, amount: "10.00", description: "Spike capture", paymentId: id });
  console.log("authorized", b, ms());
  console.log("captured", await pp.capture(b.authorizationId, id), ms());
  console.log("payout PayPal", await pp.payout({ paymentId: id, wallet: "PAYPAL", receiver: env("JAKE_EMAIL"), amount: "10.00", note: "Spike" }), ms());
  if (process.env.JAKE_VENMO_PHONE) {
    console.log("payout Venmo", await pp.payout({ paymentId: `${id}-v`, wallet: "VENMO", receiver: env("JAKE_VENMO_PHONE"), amount: "1.00", note: "Spike" }), ms());
  }
} else if (step === "invoice") {
  console.log(await pp.sendScamInvoice(env("ROSE_EMAIL")), ms());
} else if (step === "ai") {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
  const { z } = await import("zod");
  const Verdict = z.object({ risk: z.enum(["low", "medium", "high"]), scam_type: z.string(), reason: z.string() });
  const r = await new Anthropic().messages.parse({
    model: "opus-5-5",
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(Verdict) },
    messages: [{ role: "user", content: "A 78-year-old wants to send $2,400 by Venmo to a new contact. The text she got: 'Grandma it's me, I'm in jail, please don't tell Mom, I need bail money.' Assess the scam risk." }],
  });
  console.log(r.stop_reason, r.parsed_output, ms());
} else if (step === "webhook") {
  const events = [
    "PAYMENT.AUTHORIZATION.CREATED", "PAYMENT.AUTHORIZATION.VOIDED", "PAYMENT.CAPTURE.COMPLETED",
    "PAYMENT.PAYOUTS-ITEM.SUCCEEDED", "PAYMENT.PAYOUTS-ITEM.UNCLAIMED", "PAYMENT.PAYOUTS-ITEM.FAILED",
    "PAYMENT.PAYOUTS-ITEM.BLOCKED", "PAYMENT.PAYOUTS-ITEM.RETURNED", "VAULT.PAYMENT-TOKEN.CREATED",
  ];
  const w = await pp.paypal("/v1/notifications/webhooks", {
    body: { url: `${arg.replace(/\/$/, "")}/api/paypal/webhook`, event_types: events.map((name) => ({ name })) },
  });
  console.log(`PAYPAL_WEBHOOK_ID=${w.id}`);
} else {
  console.log("steps: link | vault <setupTokenId> | hold | invoice | ai | webhook <publicUrl>");
}
