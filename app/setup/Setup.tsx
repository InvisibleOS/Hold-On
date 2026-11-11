"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { money, useHousehold } from "../client.ts";

const LIMITS = [100, 200, 500];
const TIMEOUTS = [12, 24, 48];

export default function Setup() {
  const params = useSearchParams();
  const h = params.get("h") ?? "rose-demo";
  const linkedParam = params.get("linked");
  const { data, error, busy, send } = useHousehold(h);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [phone, setPhone] = useState("");
  const [limit, setLimit] = useState(200);
  const [secrecy, setSecrecy] = useState(true);
  const [timeout, setTimeoutHours] = useState(24);
  const [saved, setSaved] = useState(false);
  const loaded = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (data && !loaded.current) {
      loaded.current = true;
      setName(data.maya.name);
      setRelation(data.maya.relation);
      setPhone(data.maya.phone ?? "");
      setLimit(data.rules.newPayeeLimit);
      setSecrecy(data.rules.secrecyPause);
      setTimeoutHours(data.rules.timeoutHours);
    }
  }, [data]);

  useEffect(() => {
    if (saved) heading.current?.focus();
  }, [saved]);

  if (!data) return <main className="p-4" role="status">Loading…</main>;

  if (saved)
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-6 text-[1.25rem]">
        <h1 ref={heading} tabIndex={-1} className="mb-4 text-3xl font-bold outline-none">
          You&apos;re protected, {data.rose.name}
        </h1>
        <p className="card mb-6 border-safe bg-safe-bg">
          From now on, if a payment looks risky, Hold On keeps your money safe and asks {name} to take a look.
        </p>
        <a className="btn btn-primary w-full text-2xl" href={`/rose?h=${h}`}>
          Go to my app
        </a>
      </main>
    );

  const choice = (on: boolean) => `btn flex-1 ${on ? "btn-primary" : "btn-secondary"}`;

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 text-[1.25rem]">
      <p className="mb-2 text-base font-bold text-brand">Hold On · setup</p>
      <h1 ref={heading} tabIndex={-1} className="mb-2 text-3xl font-bold outline-none">
        Your safety rules
      </h1>
      <p className="mb-6 text-muted">
        Choose these now, while things are calm. They will protect you on a day when someone is rushing or frightening you.
      </p>

      {error && (
        <p role="alert" className="card mb-4 border-danger bg-danger-bg font-bold text-danger">
          {error}
        </p>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await send("/api/setup", {
            maya: { name, relation, phone: phone || undefined },
            rules: { newPayeeLimit: limit, secrecyPause: secrecy, timeoutHours: timeout },
          });
          if (r) setSaved(true);
        }}
      >
        <section className="card mb-5" aria-labelledby="step1">
          <h2 id="step1" className="mb-3 text-2xl font-bold">
            1. Your safety person
          </h2>
          <p className="mb-3 text-muted">Someone you trust who can take a look when a payment seems risky. They can stop a payment, but they can never send your money anywhere.</p>
          <label className="mb-3 block">
            <span className="mb-1 block font-bold">Their name</span>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="mb-3 block">
            <span className="mb-1 block font-bold">They are my…</span>
            <input className="field" value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="daughter, son, friend" required />
          </label>
          <label className="block">
            <span className="mb-1 block font-bold">Their phone number (optional)</span>
            <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
          </label>
        </section>

        <section className="card mb-5" aria-labelledby="step2">
          <h2 id="step2" className="mb-3 text-2xl font-bold">
            2. Your rules
          </h2>
          <fieldset className="mb-5">
            <legend className="mb-2 font-bold">Check with {name || "my safety person"} before I pay someone new more than:</legend>
            <div className="flex gap-2">
              {LIMITS.map((l) => (
                <label key={l} className={`${choice(limit === l)} cursor-pointer`}>
                  <input type="radio" name="limit" className="sr-only" checked={limit === l} onChange={() => setLimit(l)} />
                  {money(l).replace(".00", "")}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mb-5 flex items-start gap-3">
            <input type="checkbox" className="mt-1 size-6 shrink-0" checked={secrecy} onChange={(e) => setSecrecy(e.target.checked)} />
            <span>
              <span className="block font-bold">Always pause a payment if someone asks me to keep it secret.</span>
              <span className="text-base text-muted">Real family and real companies never ask you to hide a payment.</span>
            </span>
          </label>
          <fieldset>
            <legend className="mb-2 font-bold">If {name || "my safety person"} doesn&apos;t answer, cancel the payment after:</legend>
            <div className="flex gap-2">
              {TIMEOUTS.map((t) => (
                <label key={t} className={`${choice(timeout === t)} cursor-pointer`}>
                  <input type="radio" name="timeout" className="sr-only" checked={timeout === t} onChange={() => setTimeoutHours(t)} />
                  {t} hours
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="card mb-5" aria-labelledby="step3">
          <h2 id="step3" className="mb-3 text-2xl font-bold">
            3. Link your PayPal
          </h2>
          {data.linked || linkedParam === "ok" ? (
            <p className="font-bold text-safe">✓ Your PayPal is linked.</p>
          ) : data.paypalReady ? (
            <>
              <p className="mb-3 text-muted">You&apos;ll log in to PayPal once and agree. After that, Hold On can hold a payment safely without asking you to log in every time.</p>
              <a className="btn btn-secondary w-full" href={`/api/link?h=${h}`}>
                Link my PayPal
              </a>
            </>
          ) : (
            <p className="text-muted">In this demo, Rose&apos;s PayPal sandbox account is already linked.</p>
          )}
          {linkedParam === "cancelled" && <p className="mt-2 text-warn">Linking was cancelled. You can try again any time.</p>}
        </section>

        <p className="mb-4 font-bold">I chose these rules while calm. They protect me when I&apos;m not.</p>
        <button className="btn btn-primary w-full text-2xl" disabled={busy}>
          Save my rules
        </button>
      </form>
    </main>
  );
}
