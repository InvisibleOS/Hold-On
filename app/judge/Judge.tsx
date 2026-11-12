"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Payment } from "@/lib/store.ts";
import { money, useHousehold } from "../client.ts";
import { Icon, Logo, type IconName } from "../ui.tsx";

const SCENARIOS = [
  {
    name: "grandson",
    title: "The grandson in jail",
    hint: "A panicked text asks Rose for $2,400 bail by Venmo, and to keep it secret.",
    steps: ["On Rose's phone, tap Send money under the text.", "Hold On asks if they knew the family code word. Tap No, and the money goes on hold.", "On Maya's phone, read the brief and call tips, then tap Block it."],
  },
  {
    name: "invoice",
    title: "The fake PayPal invoice",
    hint: "A real PayPal invoice from a fake company, then a 'refund agent' asks for money.",
    steps: ["On Rose's phone, tap Is this real? under the email.", "See why it's a scam, then go back and try Send money anyway.", "Maya gets the alert. Block it."],
  },
  {
    name: "plumber",
    title: "Paying the plumber",
    hint: "An ordinary payment to someone Rose knows. It should just go through.",
    steps: ["On Rose's phone, tap Send money.", "It goes straight through: no questions, no hold.", "The ledger shows the real capture and payout."],
  },
  {
    name: "coached",
    title: "Rose was coached",
    hint: "The scammer told Rose to say it's for a vacation. Her own rules still catch it.",
    steps: ["On Rose's phone, tap Send money.", "The innocent reason doesn't fool her $200 new-person rule.", "On Maya's phone, Release or Block."],
  },
  {
    name: "teacher",
    title: "A new piano teacher",
    hint: "A real payment to someone new. Maya okays it once, and Hold On learns.",
    steps: ["On Rose's phone, tap Send money. Clara is new and over $200, so it's held.", "On Maya's phone, tap Release…, tick Trust Clara from now on, then send.", "On Rose's phone, pay Clara $250 again: it goes straight through."],
  },
  {
    name: "agent",
    title: "An AI agent is tricked",
    hint: "Rose's shopping AI reads a page with hidden instructions and tries to pay a fake fee.",
    steps: ["Nothing to tap on Rose's phone: her AI agent paid through Hold On's MCP server.", "The $300 'priority fee' is held, flagged as hidden AI instructions.", "On Maya's phone, Block it."],
  },
] as const;

type ScenarioName = (typeof SCENARIOS)[number]["name"];

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
  return (
    <Board
      h={h}
      fresh={() => {
        const id = `judge-${crypto.randomUUID().slice(0, 8)}`;
        setH(id);
        router.replace(`/judge?h=${id}`);
      }}
    />
  );
}

function Board({ h, fresh }: { h: string; fresh: () => void }) {
  const { data, error, busy, send } = useHousehold(h);
  const [frameKey, setFrameKey] = useState(0);
  const [active, setActive] = useState<ScenarioName | null>(null);
  const scenario = SCENARIOS.find((s) => s.name === active);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface/70 backdrop-blur">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-6 py-3">
          <a href="/">
            <Logo sub="Judge Mode" />
          </a>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge on={data?.mode === "sandbox"} yes="PayPal sandbox · live" no="PayPal · demo mode" />
            <Badge on={!!data?.ai} yes="AI guardian · Gemini" no="AI · rules only" />
            <a className="btn btn-ghost min-h-11 px-3 text-sm" href={`/maya/dashboard?h=${h}`} target="_blank" rel="noreferrer">
              <Icon name="chart" className="size-4" />
              Safety dashboard
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-6 pt-7 pb-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[2.5rem] leading-[1.05] font-semibold">Watch Hold On stop a scam, on real PayPal.</h1>
            <p className="mt-2 max-w-2xl text-muted">Pick a scenario. You play Rose, 78, on the left and her daughter Maya on the right. Every PayPal call is real and shows up in the ledger.</p>
          </div>
          <button
            className="btn btn-secondary min-h-11 text-sm"
            onClick={() => {
              fresh();
              setActive(null);
              setFrameKey((k) => k + 1);
            }}
          >
            <Icon name="refresh" className="size-4" />
            Start over
          </button>
        </div>

        {error && (
          <p role="alert" className="card tone-danger mb-5 font-bold text-danger">
            {error}
          </p>
        )}

        <section aria-label="Scenarios" className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {SCENARIOS.map((s, i) => {
            const on = active === s.name;
            return (
              <button
                key={s.name}
                aria-pressed={on}
                disabled={busy}
                onClick={async () => {
                  setActive(s.name);
                  await send("/api/scenario", { name: s.name });
                }}
                className={`card card-tap flex flex-col items-start gap-2 p-4 text-left disabled:opacity-60 ${on ? "border-brand bg-brand-soft shadow-[0_0_0_1px_var(--brand)]" : ""}`}
              >
                <span className={`icon-badge size-8 text-sm font-bold ${on ? "bg-brand text-brand-ink" : "pill-neutral"}`}>{i + 1}</span>
                <span className="font-bold leading-snug">{s.title}</span>
                <span className="text-sm leading-snug text-muted">{s.hint}</span>
              </button>
            );
          })}
        </section>

        <div className={`card mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 py-3.5 ${scenario ? "tone-brand" : ""}`} aria-live="polite">
          <span className="eyebrow flex items-center gap-2 text-brand">
            <Icon name="play" className="size-3.5" />
            {scenario ? "Now try" : "Start here"}
          </span>
          {scenario ? (
            <ol className="flex flex-1 flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
              {scenario.steps.map((t, i) => (
                <li key={t} className="flex items-baseline gap-2">
                  <span className="font-bold text-brand">{i + 1}.</span>
                  {t}
                </li>
              ))}
            </ol>
          ) : (
            <p className="flex-1 text-[0.9375rem]">Choose scenario 1 above. It drops a scam text into Rose&apos;s phone and gets the payment ready.</p>
          )}
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[auto_auto_1fr]">
          <Phone who="Rose" role="78 · sends the money" icon="users" src={`/rose?h=${h}`} k={frameKey} />
          <Phone who="Maya" role="her daughter · the safety person" icon="shieldCheck" src={`/maya?h=${h}`} k={frameKey} />
          <Ledger data={data} />
        </div>
      </main>
    </div>
  );
}

function Phone({ who, role, icon, src, k }: { who: string; role: string; icon: IconName; src: string; k: number }) {
  return (
    <section aria-label={`${who}'s phone`} className="mx-auto">
      <p className="mb-3 flex items-center gap-2.5 px-1">
        <span className="icon-badge pill-brand size-8">
          <Icon name={icon} className="size-4" />
        </span>
        <span className="font-bold">{who}&apos;s phone</span>
        <span className="text-sm text-muted">{role}</span>
      </p>
      <div className="rounded-[3rem] bg-[#0b0d12] p-3 shadow-lg ring-1 ring-black/10">
        <div className="overflow-hidden rounded-[2.4rem] bg-bg">
          <div aria-hidden="true" className="relative flex h-9 items-center justify-between px-7 text-xs font-bold text-ink">
            <span>9:41</span>
            <span className="absolute top-2 left-1/2 h-6 w-24 -translate-x-1/2 rounded-full bg-[#0b0d12]" />
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-4 rounded-sm border-2 border-current" />
            </span>
          </div>
          <iframe key={k} src={src} title={`${who}'s phone`} className="block h-[724px] w-[375px] max-w-full bg-bg" />
        </div>
      </div>
    </section>
  );
}

// ---------------- The PayPal ledger ----------------

const KIND: Record<string, { label: string; className: string }> = {
  paypal: { label: "PayPal", className: "bg-[#1b3a8c] text-white" },
  webhook: { label: "Webhook", className: "bg-[#1b3a8c] text-white" },
  guardian: { label: "AI", className: "bg-[#5b3fb8] text-white" },
  agent: { label: "Agent", className: "bg-[#5b3fb8] text-white" },
  error: { label: "Error", className: "bg-[#b3261e] text-white" },
};

function moneyState(p: Payment): { label: string; done: boolean }[] {
  const pp = p.paypal;
  const stopped = p.status === "blocked" || p.status === "cancelled" || p.status === "expired";
  const steps = [
    { label: "Order", done: !!pp.orderId },
    { label: "Authorized · held", done: !!pp.authorizationId },
  ];
  if (stopped) return [...steps, { label: "Voided · money never moved", done: true }];
  return [
    ...steps,
    { label: "Captured", done: !!pp.captureId },
    { label: `Payout${pp.payoutStatus ? ` · ${pp.payoutStatus.toLowerCase()}` : ""}`, done: !!pp.payoutBatchId },
    { label: "Delivered", done: p.status === "delivered" },
  ];
}

function Ledger({ data }: { data: ReturnType<typeof useHousehold>["data"] }) {
  const latest = data?.payments.find((p) => p.paypal.orderId || p.paypal.authorizationId);
  return (
    <section aria-label="PayPal ledger" className="overflow-hidden rounded-[1.5rem] border border-[#232838] bg-[#10131b] text-[#e8eaf0] shadow-lg xl:max-h-[820px] xl:self-stretch">
      <div className="flex items-center justify-between border-b border-[#232838] px-5 py-4">
        <div>
          <h2 className="font-bold">PayPal ledger</h2>
          <p className="text-sm text-[#a9afbd]">Every real API call, newest first</p>
        </div>
        <span className="flex items-center gap-2 text-xs font-bold tracking-wide text-[#7fe0a8] uppercase">
          <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-[#7fe0a8]" />
          Live
        </span>
      </div>

      {latest && (
        <div className="border-b border-[#232838] px-5 py-4">
          <p className="mb-3 text-sm text-[#a9afbd]">
            Latest: <strong className="text-white">{money(latest.amount)}</strong> to {latest.to.name}
          </p>
          <ol className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
            {moneyState(latest).map((s, i, all) => (
              <li key={s.label} className="flex items-center gap-1.5">
                <span className={`rounded-full px-2.5 py-1 ${s.done ? (s.label.startsWith("Voided") ? "bg-[#7fe0a8] text-[#06210f]" : "bg-[#2c4fb8] text-white") : "border border-[#3a4153] text-[#8d94a5]"}`}>
                  {s.done && <span className="sr-only">done: </span>}
                  {s.label}
                </span>
                {i < all.length - 1 && <Icon name="chevronRight" className="size-3.5 text-[#5c6478]" />}
              </li>
            ))}
          </ol>
          {latest.paypal.authorizationId && <p className="mt-3 font-mono text-xs text-[#a9afbd]">auth {latest.paypal.authorizationId}</p>}
        </div>
      )}

      <ol className="grid gap-px overflow-y-auto font-mono text-[0.8125rem] xl:max-h-[600px]" aria-live="polite">
        {data?.events.map((e, i) => {
          const k = KIND[e.kind];
          return (
            <li key={`${e.at}-${i}`} className="px-5 py-3 odd:bg-white/[0.02]">
              <div className="mb-1 flex items-center gap-2 font-sans text-xs">
                <span className={`rounded px-1.5 py-0.5 font-bold ${k?.className ?? "bg-[#2a3040] text-[#c9cedb]"}`}>{k?.label ?? e.kind}</span>
                <span className="text-[#8d94a5]">{new Date(e.at).toLocaleTimeString()}</span>
              </div>
              <p className="leading-relaxed break-words text-[#dfe3ec]">{e.detail}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Badge({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return (
    <span className={`pill ${on ? "pill-safe" : "pill-warn"}`}>
      <span aria-hidden="true" className={`size-2 rounded-full bg-current ${on ? "animate-pulse" : ""}`} />
      {on ? yes : no}
    </span>
  );
}
