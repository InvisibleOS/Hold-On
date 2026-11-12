"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Payment } from "@/lib/store.ts";
import { money, STATUS_WORDS, timeLeft, useHousehold, type HouseholdView } from "../client.ts";
import { Avatar, Icon, Logo, Pill, Spinner, STATUS_TONE } from "../ui.tsx";

export default function Maya() {
  const h = useSearchParams().get("h") ?? "rose-demo";
  const { data, error, busy, send } = useHousehold(h);
  if (!data)
    return (
      <main className="py-16 text-center text-muted" role="status">
        <Spinner className="size-10" />
        <p className="mt-4">Loading…</p>
      </main>
    );

  const held = data.payments.filter((p) => p.status === "held");
  const act = (id: string, action: "block" | "release" | "skip_time") => send("/api/payment", { id, action });
  const stopped = data.payments.filter((p) => p.status === "blocked" || p.status === "cancelled" || p.status === "expired");
  const protectedTotal = stopped.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <Logo sub={`for ${data.maya.name}`} />
          <a className="btn btn-ghost min-h-12 gap-2 px-3 text-base" href={`/maya/dashboard?h=${data.id}`}>
            <Icon name="chart" />
            Dashboard
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-12">
        <div className="mb-6 flex items-center gap-4">
          <Avatar name={data.rose.name} className="size-14 text-xl" tone={held.length ? "warn" : "safe"} />
          <div>
            <p className="text-sm text-muted">Looking after {data.rose.name}</p>
            <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">{held.length ? `${data.rose.name} needs you` : `${data.rose.name} is all set`}</h1>
          </div>
        </div>

        {error && (
          <div role="alert" className="card tone-danger mb-5 flex items-start gap-3 font-bold text-danger">
            <Icon name="alert" className="mt-1 size-5 shrink-0" />
            {error}
          </div>
        )}

        <div aria-live="polite">
          {held.length === 0 && (
            <div className="card tone-safe mb-6 flex items-center gap-4">
              <span className="icon-badge size-11 bg-safe text-surface">
                <Icon name="shieldCheck" className="size-6" />
              </span>
              <p className="leading-snug">
                <span className="block font-bold text-safe">Nothing needs a look</span>
                <span className="text-base">You&apos;ll get a notification the moment a payment is held.</span>
              </p>
            </div>
          )}
          {held.map((p) => (
            <Alert key={p.id} p={p} data={data} busy={busy} act={act} />
          ))}
        </div>

        <dl className="mb-8 grid grid-cols-3 gap-3">
          <Stat label="Money protected" value={money(protectedTotal).replace(".00", "")} tone="text-safe" />
          <Stat label="Scams stopped" value={String(stopped.length)} />
          <Stat label="Payments" value={String(data.payments.length)} />
        </dl>

        <h2 className="mb-3 text-xl font-bold">{data.rose.name}&apos;s payments</h2>
        <Activity payments={data.payments} />

        <h2 className="mt-8 mb-1 text-xl font-bold">{data.rose.name}&apos;s rules</h2>
        <p className="mb-3 text-base text-muted">{data.rose.name} chose these herself. Only she can change them.</p>
        <ul className="card grid gap-3">
          <Rule icon="users">
            Check with {data.maya.name} before paying someone new more than {money(data.rules.newPayeeLimit).replace(".00", "")}.
          </Rule>
          {data.rules.secrecyPause && <Rule icon="lock">Always pause a payment someone asked to keep secret.</Rule>}
          <Rule icon="clock">If {data.maya.name} doesn&apos;t answer within {data.rules.timeoutHours} hours, cancel it.</Rule>
        </ul>
      </main>
    </div>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card px-3 py-3">
      <dt className="text-xs font-bold text-muted">{label}</dt>
      <dd className={`text-[1.375rem] font-bold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}

function Rule({ icon, children }: { icon: "users" | "lock" | "clock"; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-base leading-snug">
      <span className="icon-badge pill-brand size-8">
        <Icon name={icon} className="size-4" />
      </span>
      <span className="pt-1">{children}</span>
    </li>
  );
}

function Alert({ p, data, busy, act }: { p: Payment; data: HouseholdView; busy: boolean; act: (id: string, a: "block" | "release" | "skip_time") => void }) {
  const [confirmRelease, setConfirmRelease] = useState(false);
  const high = p.verdict?.risk === "high";
  return (
    <article className="rise mb-6 overflow-hidden rounded-[1.5rem] border border-line bg-surface shadow-md" aria-label={`Held payment: ${money(p.amount)} to ${p.to.name}`}>
      <div className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 ${high ? "bg-danger-bg" : "bg-warn-bg"}`}>
        <span className={`flex items-center gap-2 font-bold ${high ? "text-danger" : "text-warn"}`}>
          <Icon name="alert" />
          {high ? "High risk" : "Needs a look"}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-bold text-muted">
          <Icon name="clock" className="size-4" />
          Held for {timeLeft(p.holdUntil)} more
        </span>
      </div>

      <div className="p-5">
        <p className="text-[2.25rem] leading-none font-bold tabular-nums">{money(p.amount)}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            to <strong>{p.to.name}</strong>
          </span>
          <Pill tone={p.to.known ? "neutral" : "warn"}>{p.to.known ? "Known" : "New person"}</Pill>
          <Pill tone="neutral">{p.to.wallet === "VENMO" ? "Venmo" : "PayPal"}</Pill>
          {p.initiator === "agent" && (
            <Pill tone="brand" icon="bot">
              AI agent
            </Pill>
          )}
        </p>
        <p className="mt-2 text-base text-muted">For: “{p.purpose}”</p>

        {p.verdict?.briefForMaya && (
          <div className="mt-5 rounded-2xl bg-surface-2 p-4">
            <p className="eyebrow mb-1.5 flex items-center gap-1.5 text-brand">
              <Icon name="sparkles" className="size-4" />
              {p.verdict.source === "ai" ? "AI summary" : "Summary"}
            </p>
            <p className="leading-relaxed">{p.verdict.briefForMaya}</p>
          </div>
        )}

        {!!p.verdict?.redFlags.length && (
          <>
            <h3 className="mt-5 mb-2 font-bold">Warning signs</h3>
            <ul className="grid gap-2.5">
              {p.verdict.redFlags.slice(0, 5).map((f) => (
                <li key={f.flag} className="flex gap-3 text-base leading-snug">
                  <Icon name="alert" className="mt-0.5 size-5 shrink-0 text-warn" />
                  <span>
                    <strong>{f.flag}</strong>
                    {f.evidence && <span className="mt-0.5 block border-l-2 border-line-strong pl-2.5 text-muted italic">“{f.evidence}”</span>}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {p.turns.length > 0 && (
          <details className="mt-5 rounded-2xl border border-line p-4">
            <summary className="cursor-pointer font-bold">What {data.rose.name} told Hold On</summary>
            <ul className="mt-3 grid gap-2 text-base">
              {p.turns.map((t, i) => (
                <li key={i} className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${t.by === "guardian" ? "bg-surface-2" : "ml-auto bg-brand-soft"}`}>
                  <span className="block text-xs font-bold text-muted">{t.by === "guardian" ? "Hold On" : data.rose.name}</span>
                  {t.text}
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="mt-5 flex items-center gap-2 text-sm text-muted">
          <Icon name="lock" className="size-4" />
          Held on {data.rose.name}&apos;s PayPal. Nothing has been sent.
        </p>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <button className="btn btn-danger" disabled={busy} onClick={() => act(p.id, "block")}>
            <Icon name="x" />
            Block it
          </button>
          {confirmRelease ? (
            <button className="btn btn-safe" disabled={busy} onClick={() => act(p.id, "release")}>
              <Icon name="check" />
              Yes, send {money(p.amount)}
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => setConfirmRelease(true)}>
              Release…
            </button>
          )}
          <a className="btn btn-secondary sm:col-span-2" href={`tel:${data.rose.phone ?? "+15550100100"}`}>
            <Icon name="phone" />
            Call {data.rose.name} first
          </a>
        </div>
        <button className="mt-4 text-sm text-muted underline underline-offset-4" onClick={() => act(p.id, "skip_time")}>
          Demo: skip ahead to the end of the hold
        </button>
      </div>
    </article>
  );
}

function Activity({ payments }: { payments: Payment[] }) {
  return (
    <ul className="card divide-y divide-line p-0">
      {payments.map((p) => (
        <li key={p.id} className="flex items-center gap-3 px-4 py-3">
          <Avatar name={p.to.name} className="size-10 text-sm" tone={p.to.known ? "neutral" : "brand"} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{p.to.name}</p>
            <p className="mb-1 text-sm text-muted">
              {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {p.verdict && p.verdict.risk !== "low" ? ` · ${p.verdict.risk} risk` : ""}
            </p>
            <Pill tone={STATUS_TONE[p.status]}>{STATUS_WORDS[p.status]}</Pill>
          </div>
          <p className="self-start font-bold tabular-nums">{money(p.amount)}</p>
        </li>
      ))}
    </ul>
  );
}
