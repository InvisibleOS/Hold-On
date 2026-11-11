// One wrapper for every PayPal call Hold On makes: Vault v3, Orders v2,
// Payments v2, Payouts v1, Invoicing v2, Webhooks. Server-only.

const BASE = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

type Creds = { id: string; secret: string };

function creds(idVar: string, secretVar: string): Creds {
  const id = process.env[idVar];
  const secret = process.env[secretVar];
  if (!id || !secret) throw new Error(`Missing ${idVar} / ${secretVar}`);
  return { id, secret };
}

/** Hold On's own sandbox business app (receives captures, sends payouts). */
export const holdOnApp = () => creds("PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET");
/** A separate sandbox business app that plays the scammer in the demo. */
export const scammerApp = () => creds("SCAMMER_CLIENT_ID", "SCAMMER_CLIENT_SECRET");

export class PayPalError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`PayPal ${status}: ${JSON.stringify(body)}`);
    this.status = status;
    this.body = body;
  }
}

// Access tokens last ~9 hours; cache per app and refresh early or on a 401.
const tokens = new Map<string, { value: string; expiresAt: number }>();

async function accessToken(c: Creds, force = false): Promise<string> {
  const cached = tokens.get(c.id);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.value;
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${c.id}:${c.secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok) throw new PayPalError(res.status, data);
  tokens.set(c.id, { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 120) * 1000 });
  return data.access_token;
}

type CallOpts = {
  method?: "GET" | "POST" | "DELETE" | "PATCH";
  body?: unknown;
  /** PayPal-Request-Id: the same key makes a retried POST a no-op instead of a second charge. */
  idem?: string;
  app?: Creds;
};

export async function paypal<T = any>(path: string, opts: CallOpts = {}): Promise<T> {
  const app = opts.app ?? holdOnApp();
  for (const retry of [false, true]) {
    const res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: {
        Authorization: `Bearer ${await accessToken(app, retry)}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(opts.idem ? { "PayPal-Request-Id": opts.idem } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    if (res.status === 401 && !retry) continue; // token expired early: refresh once
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new PayPalError(res.status, data);
    return data as T;
  }
  throw new Error("unreachable");
}

const usd = (value: string) => ({ currency_code: "USD", value });

// ---------- Vault v3: save Rose's PayPal once, no purchase needed ----------

export async function createSetupToken(returnUrl: string, cancelUrl: string) {
  const t = await paypal("/v3/vault/setup-tokens", {
    body: {
      payment_source: {
        paypal: {
          usage_type: "MERCHANT",
          experience_context: { return_url: returnUrl, cancel_url: cancelUrl, brand_name: "Hold On" },
        },
      },
    },
    idem: crypto.randomUUID(),
  });
  const approveUrl = t.links?.find((l: { rel: string }) => l.rel === "approve")?.href as string;
  return { setupTokenId: t.id as string, approveUrl };
}

export async function createPaymentToken(setupTokenId: string) {
  const t = await paypal("/v3/vault/payment-tokens", {
    body: { payment_source: { token: { id: setupTokenId, type: "SETUP_TOKEN" } } },
    idem: `pt-${setupTokenId}`,
  });
  return { vaultId: t.id as string, customerId: t.customer?.id as string | undefined };
}

// ---------- Orders v2 + Payments v2: the hold ----------

/** Puts a hold on Rose's saved PayPal. Nothing moves until capture(). */
export async function authorize(p: { vaultId: string; amount: string; description: string; paymentId: string }) {
  let order = await paypal("/v2/checkout/orders", {
    body: {
      intent: "AUTHORIZE",
      payment_source: { paypal: { vault_id: p.vaultId } },
      purchase_units: [{ amount: usd(p.amount), description: p.description.slice(0, 127), custom_id: p.paymentId }],
    },
    idem: `${p.paymentId}:order`,
  });
  let auth = order.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth && order.status === "APPROVED") {
    order = await paypal(`/v2/checkout/orders/${order.id}/authorize`, { body: {}, idem: `${p.paymentId}:authorize` });
    auth = order.purchase_units?.[0]?.payments?.authorizations?.[0];
  }
  if (!auth) throw new PayPalError(422, { message: "No authorization created", order });
  return {
    orderId: order.id as string,
    authorizationId: auth.id as string,
    status: auth.status as string,
    expiresAt: auth.expiration_time as string | undefined,
  };
}

export async function capture(authorizationId: string, paymentId: string) {
  const c = await paypal(`/v2/payments/authorizations/${authorizationId}/capture`, {
    body: { final_capture: true },
    idem: `${paymentId}:capture`,
  });
  return { captureId: c.id as string, status: c.status as string };
}

export async function voidAuthorization(authorizationId: string, paymentId: string) {
  await paypal(`/v2/payments/authorizations/${authorizationId}/void`, { body: {}, idem: `${paymentId}:void` });
}

// ---------- Payouts v1: deliver to the recipient (PayPal email or Venmo phone) ----------

export type Wallet = "PAYPAL" | "VENMO";

export async function payout(p: { paymentId: string; wallet: Wallet; receiver: string; amount: string; note: string }) {
  const r = await paypal("/v1/payments/payouts", {
    body: {
      sender_batch_header: { sender_batch_id: `${p.paymentId}-payout`, email_subject: "You've received money" },
      items: [
        {
          recipient_type: p.wallet === "VENMO" ? "PHONE" : "EMAIL",
          recipient_wallet: p.wallet,
          receiver: p.receiver,
          amount: { value: p.amount, currency: "USD" },
          note: p.note.slice(0, 4000) || "Sent with Hold On", // Venmo requires a note
          sender_item_id: p.paymentId,
        },
      ],
    },
    idem: `${p.paymentId}:payout`,
  });
  return { batchId: r.batch_header?.payout_batch_id as string, status: r.batch_header?.batch_status as string };
}

// ---------- Invoicing v2: the scam invoice used in the demo ----------

export async function sendScamInvoice(recipientEmail: string) {
  const app = scammerApp();
  const inv = await paypal("/v2/invoicing/invoices", {
    app,
    body: {
      detail: {
        currency_code: "USD",
        note:
          "Your SecureShield Total Protection plan renewed for $499.99. If you did NOT authorize this charge, " +
          "call our billing team within 24 hours at +1 (888) 555-0142 to cancel and get a refund.",
      },
      invoicer: { business_name: "SecureShield Billing" },
      primary_recipients: [{ billing_info: { email_address: recipientEmail } }],
      items: [{ name: "SecureShield Total Protection (annual)", quantity: "1", unit_amount: usd("499.99") }],
    },
    idem: crypto.randomUUID(),
  });
  const id = (inv.id ?? inv.href?.split("/").pop()) as string;
  await paypal(`/v2/invoicing/invoices/${id}/send`, { app, body: { send_to_recipient: true } });
  return { invoiceId: id };
}

// ---------- Webhooks: only trust events PayPal signed ----------

export async function verifyWebhook(headers: Headers, event: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const r = await paypal("/v1/notifications/verify-webhook-signature", {
    body: {
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    },
  });
  return r.verification_status === "SUCCESS";
}
