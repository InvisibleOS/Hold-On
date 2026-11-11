// Real phone push to Maya via ntfy.sh, with Block / Release buttons that work
// from the lock screen. Links are HMAC-signed, expire with the hold, and the
// payment state machine makes them single-use.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Household, Payment } from "./store.ts";

export type LinkAction = "block" | "release";

const secret = () => process.env.APP_SECRET ?? "";

export function sign(paymentId: string, action: LinkAction, exp: number) {
  return createHmac("sha256", secret()).update(`${paymentId}.${action}.${exp}`).digest("hex");
}

export function verifyLink(paymentId: string, action: string, exp: number, sig: string) {
  if (!secret() || (action !== "block" && action !== "release") || !(exp > Date.now())) return false;
  const want = Buffer.from(sign(paymentId, action, exp), "hex");
  const got = Buffer.from(sig, "hex");
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Returns true if a push was sent. Missing config just means in-app alerts only. */
export async function notifyMaya(h: Household, p: Payment): Promise<boolean> {
  const topic = process.env.NTFY_TOPIC;
  const base = process.env.PUBLIC_URL;
  if (!topic || !base || !secret()) return false;
  const exp = p.holdUntil ?? Date.now() + 86_400_000;
  const link = (a: LinkAction) => `${base}/api/act?pid=${p.id}&action=${a}&exp=${exp}&sig=${sign(p.id, a, exp)}`;
  const open = `${base}/maya?h=${h.id}`;
  try {
    const r = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: {
        // Header values must stay ASCII.
        Title: `Hold On: ${h.rose.name} needs you ($${Number(p.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })})`,
        Priority: "high",
        Tags: "warning",
        Click: open,
        Actions: `http, Block it, ${link("block")}, method=POST, clear=true; http, Release, ${link("release")}, method=POST, clear=true; view, Open, ${open}`,
      },
      body: p.verdict?.briefForMaya || `${h.rose.name} is trying to send $${p.amount} to ${p.to.name}.`,
    });
    return r.ok;
  } catch {
    return false;
  }
}
