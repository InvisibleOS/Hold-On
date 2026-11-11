// Scam Lab: runs every labeled case through the real guardian (rules + Gemini)
// and reports catch rate, false alarms and latency. Run: node eval/run.ts
// Cases are synthetic, written by the team from public FTC/FBI scam descriptions.
import { readFileSync, writeFileSync } from "node:fs";

try {
  process.loadEnvFile(".env.local");
} catch {}
const { assess, MAX_QUESTIONS } = await import("../lib/guardian.ts");
const { getHousehold, newId } = await import("../lib/store.ts");
import type { Payment } from "../lib/store.ts";

type Case = {
  id: string;
  scam: boolean;
  type: string;
  initiator?: "rose" | "agent";
  to: { name: string; known: boolean; typical?: number; wallet: "PAYPAL" | "VENMO" };
  amount: string;
  purpose: string;
  context: string;
  answers: string[];
};

const cases: Case[] = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
const only = process.argv[2];
const rows: { id: string; type: string; scam: boolean; risk: string; held: boolean; correct: boolean; questions: number; ms: number; source: string }[] = [];

async function runCase(c: Case) {
  const h = getHousehold(`eval-${c.id}`);
  const p: Payment = {
    id: newId("pay"),
    householdId: h.id,
    to: { id: newId("payee"), handle: "x@example.com", ...c.to },
    amount: Number(c.amount).toFixed(2),
    purpose: c.purpose,
    context: c.context || undefined,
    initiator: c.initiator ?? "rose",
    turns: [],
    status: "checking",
    paypal: {},
    createdAt: Date.now(),
  };
  const t0 = Date.now();
  let a = await assess(h, p);
  let q = 0;
  while (a.kind === "ask" && q < MAX_QUESTIONS) {
    p.turns.push({ by: "guardian", text: a.question });
    p.turns.push({ by: "rose", text: c.answers[q] ?? "I'm not sure" });
    q++;
    a = await assess(h, p);
  }
  if (a.kind !== "decide") throw new Error(`${c.id}: no decision`);
  const held = a.verdict.risk !== "low";
  rows.push({ id: c.id, type: c.type, scam: c.scam, risk: a.verdict.risk, held, correct: held === c.scam, questions: q, ms: Date.now() - t0, source: a.verdict.source });
  process.stdout.write(held === c.scam ? "." : "x");
}

const todo = cases.filter((c) => !only || c.id === only);
for (let i = 0; i < todo.length; i += 2) await Promise.all(todo.slice(i, i + 2).map(runCase)); // 2 at a time: free-tier quotas are per minute
console.log();

const scams = rows.filter((r) => r.scam);
const legit = rows.filter((r) => !r.scam);
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "n/a");
const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
const summary = {
  ranAt: new Date().toISOString(),
  ai: rows.some((r) => r.source === "ai"),
  cases: rows.length,
  scamsCaught: `${scams.filter((r) => r.held).length}/${scams.length} (${pct(scams.filter((r) => r.held).length, scams.length)})`,
  falseAlarms: `${legit.filter((r) => r.held).length}/${legit.length} (${pct(legit.filter((r) => r.held).length, legit.length)})`,
  medianMs: ms[Math.floor(ms.length / 2)],
  p90Ms: ms[Math.floor(ms.length * 0.9)],
  avgQuestions: (rows.reduce((s, r) => s + r.questions, 0) / Math.max(rows.length, 1)).toFixed(1),
};
console.table(rows.filter((r) => !r.correct));
console.log(summary);
if (!only) writeFileSync(new URL("./results.json", import.meta.url), JSON.stringify({ summary, rows }, null, 2));
