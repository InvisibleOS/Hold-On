// The payment state machine. Every money move goes through here.
//
//   checking ──safe──▶ releasing ─▶ sent ─▶ delivered (payout webhook)
//      │ │
//      │ └─risky─▶ held ──Maya release──▶ releasing
//      │             ├─ Maya block ─▶ blocked   (void: money never left)
//      ▼             ├─ Rose cancel ─▶ cancelled (void)
//    asking          └─ time's up ───▶ expired  (void)
//
// Transitions are checked synchronously before any await (single Node process),
// and every PayPal call carries a PayPal-Request-Id, so double taps and retries
// can never capture twice.
import * as pp from "./paypal.ts";
import { assess, type Assess } from "./guardian.ts";
import { notifyMaya } from "./notify.ts";
import { log, newId, type Household, type Payee, type Payment, type Status } from "./store.ts";

export const paypalMode = (): "sandbox" | "demo" =>
  process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.ROSE_VAULT_ID ? "sandbox" : "demo";

const demoId = (kind: string) => `DEMO-${kind}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
const MAX_HOLD_HOURS = 72; // PayPal's 3-day honor period for capturing an authorization

export class FlowError extends Error {}

function take(p: Payment, from: Status[], to: Status) {
  if (!from.includes(p.status)) throw new FlowError(`Payment is ${p.status}, can't do that now`);
  p.status = to;
}

export type NewPayment = { payee: Payee; amount: string; purpose: string; context?: string; initiator?: "rose" | "agent" };

export async function startPayment(h: Household, input: NewPayment): Promise<Payment> {
  const p: Payment = {
    id: newId("pay"),
    householdId: h.id,
    to: input.payee,
    amount: input.amount,
    purpose: input.purpose,
    context: input.context,
    initiator: input.initiator ?? "rose",
    turns: [],
    status: "checking",
    paypal: {},
    createdAt: Date.now(),
  };
  h.payments.unshift(p);
  h.draft = undefined;
  log(h, "rose", `${h.rose.name} started $${p.amount} to ${p.to.name}`, p.id);

  // The hold and the AI check run at the same time, so protection adds no wait.
  const [held, judged] = await Promise.allSettled([hold(h, p), assess(h, p)]);
  if (held.status === "rejected") {
    p.status = "failed";
    p.error = "PayPal couldn't place the hold";
    log(h, "error", `Hold failed: ${String(held.reason?.message ?? held.reason)}`, p.id);
    return p;
  }
  await apply(h, p, (judged as PromiseFulfilledResult<Assess>).value);
  return p;
}

async function hold(h: Household, p: Payment) {
  if (paypalMode() === "demo") {
    p.paypal.orderId = demoId("ORDER");
    p.paypal.authorizationId = demoId("AUTH");
  } else {
    const a = await pp.authorize({
      vaultId: process.env.ROSE_VAULT_ID!,
      amount: p.amount,
      description: `Hold On: ${p.to.name}`,
      paymentId: p.id,
    });
    p.paypal.orderId = a.orderId;
    p.paypal.authorizationId = a.authorizationId;
  }
  log(h, "paypal", `Order ${p.paypal.orderId} · authorization ${p.paypal.authorizationId} CREATED — $${p.amount} held on ${h.rose.name}'s PayPal, nothing sent`, p.id);
}

async function apply(h: Household, p: Payment, a: Assess) {
  if (a.kind === "ask") {
    p.turns.push({ by: "guardian", text: a.question, options: a.options });
    p.status = "asking";
    log(h, "guardian", `Asked: "${a.question}"`, p.id);
    return;
  }
  p.verdict = a.verdict;
  log(h, "guardian", `Verdict ${a.verdict.risk.toUpperCase()} (${a.verdict.scamType}, by ${a.verdict.source})`, p.id);
  if (a.verdict.risk === "low") return release(h, p, "auto");

  p.status = "held";
  p.holdUntil = Date.now() + Math.min(h.rules.timeoutHours, MAX_HOLD_HOURS) * 3_600_000;
  const pushed = await notifyMaya(h, p);
  log(h, "maya", `${h.maya.name} alerted${pushed ? " (phone push sent)" : ""}`, p.id);
}

export async function answer(h: Household, p: Payment, text: string) {
  take(p, ["asking"], "checking");
  p.turns.push({ by: "rose", text });
  await apply(h, p, await assess(h, p));
}

export async function release(h: Household, p: Payment, by: "auto" | "maya") {
  take(p, by === "auto" ? ["checking"] : ["held"], "releasing");
  p.decidedBy = by;
  try {
    if (paypalMode() === "demo") {
      p.paypal.captureId = demoId("CAPTURE");
      p.paypal.payoutBatchId = demoId("PAYOUT");
      p.paypal.payoutStatus = "PENDING";
      setTimeout(() => markDelivered(h, p, "SUCCESS"), 2500);
    } else {
      const c = await pp.capture(p.paypal.authorizationId!, p.id);
      p.paypal.captureId = c.captureId;
      log(h, "paypal", `Capture ${c.captureId} ${c.status}`, p.id);
      const out = await pp.payout({ paymentId: p.id, wallet: p.to.wallet, receiver: p.to.handle, amount: p.amount, note: p.purpose });
      p.paypal.payoutBatchId = out.batchId;
      p.paypal.payoutStatus = out.status;
    }
    p.status = "sent";
    log(h, "paypal", `Payout ${p.paypal.payoutBatchId} to ${p.to.name} (${p.to.wallet === "VENMO" ? "Venmo" : "PayPal"}) ${p.paypal.payoutStatus}`, p.id);
  } catch (err) {
    p.status = "failed";
    p.error = "PayPal couldn't complete the payment";
    log(h, "error", `Release failed: ${String((err as Error).message)}`, p.id);
  }
}

export async function stop(h: Household, p: Payment, by: "maya" | "rose" | "timeout") {
  const to: Status = by === "maya" ? "blocked" : by === "rose" ? "cancelled" : "expired";
  take(p, by === "rose" ? ["held", "asking"] : ["held"], to);
  p.decidedBy = by;
  try {
    if (paypalMode() === "sandbox") await pp.voidAuthorization(p.paypal.authorizationId!, p.id);
    log(h, "paypal", `Authorization ${p.paypal.authorizationId} VOIDED — the money never left ${h.rose.name}'s account`, p.id);
  } catch (err) {
    // The hold lapses on its own at PayPal; still record the problem.
    log(h, "error", `Void failed (hold will lapse): ${String((err as Error).message)}`, p.id);
  }
}

/** Rose's timeout rule: void holds nobody answered. Called whenever state is read. */
export async function sweep(h: Household) {
  const due = h.payments.filter((p) => p.status === "held" && (p.holdUntil ?? Infinity) <= Date.now());
  for (const p of due) await stop(h, p, "timeout").catch(() => {});
}

export function markDelivered(h: Household, p: Payment, payoutStatus: string) {
  p.paypal.payoutStatus = payoutStatus;
  if (payoutStatus === "SUCCESS" && p.status === "sent") p.status = "delivered";
  log(h, "paypal", `Payout item for ${p.to.name}: ${payoutStatus}`, p.id);
}
