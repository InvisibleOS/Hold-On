"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useHousehold } from "../client.ts";

const SCENARIOS = [
  { name: "grandson", label: "1. The grandson in jail", hint: "A panicked text asks Rose for $2,400 bail by Venmo — and to keep it secret." },
  { name: "invoice", label: "2. The fake PayPal invoice", hint: "A real PayPal invoice from a fake company, then a 'refund agent' asks for money." },
  { name: "plumber", label: "3. Paying the plumber", hint: "An ordinary payment to someone Rose knows. It should just go through." },
  { name: "coached", label: "4. Rose was coached", hint: "The scammer told Rose to say it's for a vacation. Her own rules still catch it." },
] as const;

export default function Judge() {
  const params = useSearchParams();
  const router = useRouter();
  const [h, setH] = useState(params.get("h") ?? "");

  useEffect(() => {
    if (!h) {
      const id = `judge-${crypto.randomUUID().slice(0, 8)}`;
      setH(id);
      router.replace(`/judge?h=${id}`);
    }
  }, [h, router]);

  if (!h) return null;
  return <Board h={h} fresh={() => { const id = `judge-${crypto.randomUUID().slice(0, 8)}`; setH(id); router.replace(`/judge?h=${id}`); }} />;
}

function Board({ h, fresh }: { h: string; fresh: () => void }) {
  const { data, error, busy, send } = useHousehold(h);
  const [frameKey, setFrameKey] = useState(0);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-bold text-brand">Hold On · Judge Mode</p>
          <h1 className="text-3xl font-bold">Try it in 60 seconds</h1>
          <p className="text-muted">Pick a scenario. You play Rose on the left and her daughter Maya on the right. Every PayPal call is real and listed below.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-base">
          <Badge on={data?.mode === "sandbox"} yes="PayPal sandbox: live" no="PayPal: demo mode (no keys)" />
          <Badge on={!!data?.ai} yes="AI guardian: on" no="AI: rules only (no key)" />
        </div>
      </header>

      {error && <p role="alert" className="card mb-4 border-danger bg-danger-bg font-bold text-danger">{error}</p>}

      <section aria-label="Scenarios" className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {SCENARIOS.map((s) => (
          <button key={s.name} className="card text-left hover:border-brand disabled:opacity-60" disabled={busy} onClick={() => send("/api/scenario", { name: s.name })}>
            <span className="block font-bold">{s.label}</span>
            <span className="text-base text-muted">{s.hint}</span>
          </button>
        ))}
        <button className="card text-left" onClick={() => { fresh(); setFrameKey((k) => k + 1); }}>
          <span className="block font-bold">↺ Start over</span>
          <span className="text-base text-muted">A fresh household with sample history.</span>
        </button>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1.1fr]">
        <Phone title="Rose's phone (78, the payer)" src={`/rose?h=${h}`} k={frameKey} />
        <Phone title="Maya's phone (her daughter)" src={`/maya?h=${h}`} k={frameKey} />
        <section aria-label="PayPal truth panel" className="card max-h-[760px] overflow-y-auto">
          <h2 className="mb-1 text-xl font-bold">PayPal truth panel</h2>
          <p className="mb-3 text-base text-muted">Real order, authorization, capture, payout and webhook events, newest first.</p>
          <ol className="grid gap-2 font-mono text-sm" aria-live="polite">
            {data?.events.map((e, i) => (
              <li key={i} className={`rounded-lg border p-2 ${e.kind === "paypal" || e.kind === "webhook" ? "border-brand" : e.kind === "error" ? "border-danger" : "border-line"}`}>
                <span className="text-muted">{new Date(e.at).toLocaleTimeString()} · {e.kind}</span>
                <br />
                {e.detail}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}

function Phone({ title, src, k }: { title: string; src: string; k: number }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 font-bold">{title}</h2>
      <iframe key={k} src={src} title={title} className="h-[760px] w-full rounded-[2rem] border-[10px] border-ink bg-bg" />
    </section>
  );
}

function Badge({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return <span className={`rounded-full border-2 px-3 py-1 font-bold ${on ? "border-safe bg-safe-bg text-safe" : "border-warn bg-warn-bg text-warn"}`}>{on ? `● ${yes}` : `○ ${no}`}</span>;
}
