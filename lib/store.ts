// In-memory state, one "household" per demo link (?h=...).
// ponytail: lost on restart by design — every household re-seeds itself. Swap for Postgres when real users exist.

export type Risk = "low" | "medium" | "high";
export type Wallet = "PAYPAL" | "VENMO";

export type Payee = {
  id: string;
  name: string;
  wallet: Wallet;
  handle: string; // PayPal email or Venmo phone
  known: boolean; // Rose has paid them before
  typical?: number; // her usual amount to them
};

export type Turn = { by: "guardian" | "rose"; text: string; options?: string[] };

export type RedFlag = { flag: string; evidence: string };

export type Verdict = {
  risk: Risk;
  scamType: string;
  redFlags: RedFlag[];
  messageToRose: string;
  briefForMaya: string;
  source: "ai" | "rules";
};

export type Status =
  | "checking" // AI and PayPal hold in progress
  | "asking" // guardian asked Rose a question
  | "held" // money held on Rose's account, waiting for Maya
  | "releasing"
  | "sent" // captured and paid out
  | "delivered" // PayPal confirmed the payout (webhook)
  | "blocked" // Maya stopped it
  | "cancelled" // Rose stopped it
  | "expired" // nobody answered in time; Rose's rule voided it
  | "failed";

export type Payment = {
  id: string;
  householdId: string;
  to: Payee;
  amount: string; // "2400.00"
  purpose: string;
  context?: string; // the message that asked for money, if Rose pasted it
  initiator: "rose" | "agent";
  turns: Turn[];
  verdict?: Verdict;
  status: Status;
  holdUntil?: number;
  decidedBy?: "auto" | "maya" | "rose" | "timeout";
  paypal: { orderId?: string; authorizationId?: string; captureId?: string; payoutBatchId?: string; payoutStatus?: string };
  error?: string;
  createdAt: number;
};

export type Check = {
  id: string;
  at: number;
  input: string; // text Rose pasted, or "photo"
  verdict: { level: "safe" | "careful" | "scam"; title: string; explanation: string; whatToDo: string[]; source: "ai" | "rules" };
};

export type InboxItem = { id: string; kind: "sms" | "email"; from: string; subject?: string; body: string; at: number };

export type Event = { at: number; paymentId?: string; kind: string; detail: string };

export type Rules = {
  newPayeeLimit: number; // check with Maya before paying someone new more than this
  secrecyPause: boolean; // always pause when asked to keep a secret
  timeoutHours: number; // if Maya doesn't answer, cancel after this many hours (max 72)
};

export type Household = {
  id: string;
  rose: { name: string; lang: string };
  maya: { name: string; relation: string };
  rules: Rules;
  payees: Payee[];
  payments: Payment[];
  checks: Check[];
  inbox: InboxItem[];
  events: Event[];
  scenariosRun: number;
  /** Judge Mode prefills Rose's send screen with the payment a scenario is about. */
  draft?: { payee: Payee; amount: string; purpose: string; context?: string; scenario: string };
};

const g = globalThis as unknown as { __holdon?: Map<string, Household> };
const households = (g.__holdon ??= new Map());

export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

function seed(id: string): Household {
  const day = 86_400_000;
  const jakeHandle = process.env.JAKE_VENMO_PHONE ? "VENMO" : "PAYPAL";
  const payees: Payee[] = [
    {
      id: "p_jake",
      name: "Jake (grandson)",
      wallet: jakeHandle,
      handle: process.env.JAKE_VENMO_PHONE || process.env.JAKE_EMAIL || "jake@example.com",
      known: true,
      typical: 50,
    },
    { id: "p_tom", name: "Tom's Plumbing", wallet: "PAYPAL", handle: process.env.JAKE_EMAIL || "tom@example.com", known: true, typical: 180 },
    { id: "p_church", name: "St. Mark's Church", wallet: "PAYPAL", handle: process.env.JAKE_EMAIL || "church@example.com", known: true, typical: 40 },
  ];
  const history = (to: Payee, amount: string, purpose: string, daysAgo: number): Payment => ({
    id: newId("pay"),
    householdId: id,
    to,
    amount,
    purpose,
    initiator: "rose",
    turns: [],
    status: "delivered",
    decidedBy: "auto",
    verdict: { risk: "low", scamType: "none", redFlags: [], messageToRose: "", briefForMaya: "", source: "rules" },
    paypal: {},
    createdAt: Date.now() - daysAgo * day,
  });
  return {
    id,
    rose: { name: "Rose", lang: "en" },
    maya: { name: "Maya", relation: "daughter" },
    rules: { newPayeeLimit: 200, secrecyPause: true, timeoutHours: 24 },
    payees,
    payments: [
      history(payees[1], "180.00", "Fixed the kitchen sink", 21),
      history(payees[0], "50.00", "Birthday money", 34),
      history(payees[2], "40.00", "Bake sale", 9),
    ],
    checks: [],
    inbox: [],
    events: [{ at: Date.now(), kind: "household", detail: "Demo household created with sample history" }],
    scenariosRun: 0,
  };
}

export function getHousehold(id: string): Household {
  if (!/^[a-z0-9_-]{4,40}$/i.test(id)) throw new Error("Bad household id");
  let h = households.get(id);
  if (!h) {
    // ponytail: unbounded map; cap it so a flood of demo links can't exhaust memory.
    if (households.size > 2000) households.delete(households.keys().next().value!);
    h = seed(id);
    households.set(id, h);
  }
  return h;
}

export function findPayment(match: (p: Payment) => boolean): { h: Household; p: Payment } | undefined {
  for (const h of households.values()) {
    const p = h.payments.find(match);
    if (p) return { h, p };
  }
}

export function log(h: Household, kind: string, detail: string, paymentId?: string) {
  h.events.unshift({ at: Date.now(), kind, detail, paymentId });
  h.events.length = Math.min(h.events.length, 200);
}
