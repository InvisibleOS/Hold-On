// Money-path check, demo mode (no PayPal or AI keys): node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";

for (const k of ["PAYPAL_CLIENT_ID", "ROSE_VAULT_ID", "GEMINI_API_KEY", "NTFY_TOPIC"]) delete process.env[k];
const { getHousehold } = await import("../lib/store.ts");
const flow = await import("../lib/flow.ts");

const scam = { id: "p_new", name: "Jake (new number)", wallet: "VENMO" as const, handle: "+15550132291", known: false };

test("known payee, usual amount: sent instantly", async () => {
  const h = getHousehold("test_known");
  const p = await flow.startPayment(h, { payee: h.payees.find((x) => x.id === "p_tom")!, amount: "180.00", purpose: "Fixed the sink" });
  assert.equal(p.status, "sent");
  assert.equal(p.decidedBy, "auto");
  assert.ok(p.paypal.captureId);
});

test("grandparent scam: held, then Maya blocks; second tap is refused", async () => {
  const h = getHousehold("test_scam");
  const p = await flow.startPayment(h, { payee: scam, amount: "2400.00", purpose: "Bail money, please don't tell Mom" });
  assert.equal(p.status, "held");
  assert.equal(p.verdict?.risk, "high");
  assert.ok(p.paypal.authorizationId && !p.paypal.captureId, "money held, not captured");
  await flow.stop(h, p, "maya");
  assert.equal(p.status, "blocked");
  await assert.rejects(flow.release(h, p, "maya"), flow.FlowError);
  assert.ok(!p.paypal.captureId, "a blocked payment can never be captured");
});

test("coached victim: innocent reason, still held by Rose's own rule", async () => {
  const h = getHousehold("test_coached");
  const p = await flow.startPayment(h, { payee: { ...scam, name: "Daniel Morgan" }, amount: "1500.00", purpose: "Family vacation deposit" });
  assert.equal(p.status, "held");
});

test("Maya releases once; a double tap can't capture twice", async () => {
  const h = getHousehold("test_release");
  const p = await flow.startPayment(h, { payee: scam, amount: "300.00", purpose: "Concert tickets" });
  assert.equal(p.status, "held");
  const first = flow.release(h, p, "maya");
  await assert.rejects(flow.release(h, p, "maya"), flow.FlowError);
  await first;
  assert.equal(p.status, "sent");
});

test("nobody answers: Rose's timeout voids the hold", async () => {
  const h = getHousehold("test_timeout");
  const p = await flow.startPayment(h, { payee: scam, amount: "900.00", purpose: "Gift cards for the IRS" });
  p.holdUntil = Date.now() - 1;
  await flow.sweep(h);
  assert.equal(p.status, "expired");
});
