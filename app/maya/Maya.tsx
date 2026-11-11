"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Payment } from "@/lib/store.ts";
import { money, STATUS_WORDS, timeLeft, useHousehold, type HouseholdView } from "../client.ts";

export default function Maya() {
  const h = useSearchParams().get("h") ?? "rose-demo";
  const { data, error, busy, send } = useHousehold(h);
  if (!data) return <main className="p-4" role="status">Loading…</main>;

  const held = data.payments.filter((p) => p.status === "held");
  const act = (id: string, action: "block" | "release" | "skip_time") => send("/api/payment", { id, action });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-5">
      <p className="text-base font-bold text-brand">Hold On · for {data.maya.name}</p>
      <h1 className="mb-4 text-3xl font-bold">
        {held.length ? `${data.rose.name} needs you` : `${data.rose.name} is all set`}
      </h1>
      {error && (
        <div role="alert" className="card mb-4 border-danger bg-danger-bg font-bold text-danger">
          {error}
        </div>
      )}

      <div aria-live="polite">
        {held.length === 0 && <p className="card mb-6 text-muted">No payments are waiting. You&apos;ll get a notification if anything needs a look.</p>}
        {held.map((p) => (
          <Alert key={p.id} p={p} data={data} busy={busy} act={act} />
        ))}
      </div>

      <h2 className="mb-2 mt-8 text-2xl font-bold">{data.rose.name}&apos;s payments</h2>
      <Activity payments={data.payments} />

      <h2 className="mb-2 mt-8 text-2xl font-bold">{data.rose.name}&apos;s rules</h2>
      <p className="mb-2 text-muted">{data.rose.name} chose these herself. Only she can change them.</p>
      <ul className="card grid list-disc gap-1 pl-8">
        <li>Check with {data.maya.name} before paying someone new more than {money(data.rules.newPayeeLimit)}.</li>
        {data.rules.secrecyPause && <li>Always pause a payment that someone asked to keep secret.</li>}
        <li>If {data.maya.name} doesn&apos;t answer within {data.rules.timeoutHours} hours, cancel it.</li>
      </ul>
    </main>
  );
}

function Alert({ p, data, busy, act }: { p: Payment; data: HouseholdView; busy: boolean; act: (id: string, a: "block" | "release" | "skip_time") => void }) {
  const [confirmRelease, setConfirmRelease] = useState(false);
  const risk = p.verdict?.risk === "high" ? "High risk" : "Needs a look";
  return (
    <article className="card mb-4 border-2 border-warn" aria-label={`Held payment: ${money(p.amount)} to ${p.to.name}`}>
      <p className="font-bold text-warn">⚠️ {risk} · held for {timeLeft(p.holdUntil)} more</p>
      <p className="mt-1 text-2xl font-bold">
        {money(p.amount)} to {p.to.name}
      </p>
      <p className="text-muted">
        {p.to.wallet === "VENMO" ? "Venmo" : "PayPal"} · {p.to.known ? `${data.rose.name} has paid them before` : "someone new"} · “{p.purpose}”
      </p>

      {p.verdict?.briefForMaya && <p className="mt-3">{p.verdict.briefForMaya}</p>}

      {!!p.verdict?.redFlags.length && (
        <>
          <h3 className="mt-3 font-bold">Warning signs</h3>
          <ul className="grid gap-1">
            {p.verdict.redFlags.slice(0, 5).map((f) => (
              <li key={f.flag}>
                <strong>{f.flag}</strong>
                {f.evidence && <span className="text-muted"> — “{f.evidence}”</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {p.turns.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer font-bold">What {data.rose.name} told Hold On</summary>
          <ul className="mt-2 grid gap-1">
            {p.turns.map((t, i) => (
              <li key={i}>
                <strong>{t.by === "guardian" ? "Hold On" : data.rose.name}:</strong> {t.text}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-3 text-base text-muted">The money is held on {data.rose.name}&apos;s PayPal. Nothing has been sent.</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <a className="btn btn-secondary" href="tel:+15550100100">
          📞 Call {data.rose.name}
        </a>
        <button className="btn btn-danger" disabled={busy} onClick={() => act(p.id, "block")}>
          Block it
        </button>
        {confirmRelease ? (
          <button className="btn btn-safe" disabled={busy} onClick={() => act(p.id, "release")}>
            Yes, send {money(p.amount)}
          </button>
        ) : (
          <button className="btn btn-secondary" onClick={() => setConfirmRelease(true)}>
            Release…
          </button>
        )}
      </div>
      <button className="mt-3 text-base text-muted underline" onClick={() => act(p.id, "skip_time")}>
        Demo: skip ahead to the end of the hold
      </button>
    </article>
  );
}

function Activity({ payments }: { payments: Payment[] }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-left text-base">
        <thead>
          <tr className="border-b border-line">
            <th className="p-3">When</th>
            <th className="p-3">To</th>
            <th className="p-3">Amount</th>
            <th className="p-3">Status</th>
            <th className="p-3">Risk</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-b border-line last:border-0">
              <td className="p-3">{new Date(p.createdAt).toLocaleDateString()}</td>
              <td className="p-3">{p.to.name}</td>
              <td className="p-3">{money(p.amount)}</td>
              <td className="p-3">{STATUS_WORDS[p.status]}</td>
              <td className="p-3">{p.verdict?.risk ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
