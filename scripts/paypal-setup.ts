// PayPal sandbox setup and checks. Run: node scripts/paypal-setup.ts <step>
//   link            -> prints a URL; open it and log in as Rose's sandbox account
//   vault <token>   -> turns the approved setup token into ROSE_VAULT_ID
//   hold            -> authorize $10 + void, then authorize $10 + capture + payout to Jake (PayPal and Venmo)
//   invoice         -> scammer app sends the fake SecureShield invoice to Rose
//   ai              -> times one Gemini "Is this real?" check
//   webhook <url>   -> registers <url>/api/paypal/webhook with PayPal, prints PAYPAL_WEBHOOK_ID
import * as pp from "../lib/paypal.ts";

process.loadEnvFile(".env.local");
const env = (k: string) => process.env[k] || (() => { throw new Error(`Set ${k} in .env.local`); })();
const [step, arg] = process.argv.slice(2);
const t0 = Date.now();
const ms = () => `${Date.now() - t0}ms`;

if (step === "link") {
  const { setupTokenId, approveUrl } = await pp.createSetupToken("https://example.com/return", "https://example.com/cancel");
  console.log({ setupTokenId, approveUrl }, "\nOpen approveUrl, log in as Rose, then: node scripts/paypal-setup.ts vault", setupTokenId);
} else if (step === "vault") {
  console.log(await pp.createPaymentToken(arg), "\n-> put vaultId in .env.local as ROSE_VAULT_ID");
} else if (step === "hold") {
  const vaultId = env("ROSE_VAULT_ID");
  const voidId = `setup-${Date.now()}-a`;
  const a = await pp.authorize({ vaultId, amount: "10.00", description: "Spike void", paymentId: voidId });
  console.log("authorized", a, ms());
  await pp.voidAuthorization(a.authorizationId, voidId);
  console.log("voided", ms());

  const id = `setup-${Date.now()}-b`;
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
  const { checkItem } = await import("../lib/guardian.ts");
  console.log(await checkItem({ text: "Grandma it's me, I'm in jail, please don't tell Mom, I need $2,400 bail on my new Venmo." }), ms());
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
