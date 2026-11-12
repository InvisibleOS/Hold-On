"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { money, useHousehold } from "../client.ts";
import { Icon, Logo, Spinner } from "../ui.tsx";

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
  const [rosePhone, setRosePhone] = useState("");
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
      setRosePhone(data.rose.phone ?? "");
      setLimit(data.rules.newPayeeLimit);
      setSecrecy(data.rules.secrecyPause);
      setTimeoutHours(data.rules.timeoutHours);
    }
  }, [data]);

  useEffect(() => {
    if (saved) heading.current?.focus();
  }, [saved]);

  const shell = (children: React.ReactNode) => (
    <div className="min-h-dvh text-[1.25rem]">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-3">
          <Logo sub="Setup" />
          <a className="btn btn-ghost min-h-12 px-3 text-base" href={`/rose?h=${h}`}>
            <Icon name="arrowLeft" />
            My app
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-12">{children}</main>
    </div>
  );

  if (!data)
    return shell(
      <div role="status" className="py-16 text-center text-muted">
        <Spinner className="size-10" />
        <p className="mt-4">Loading…</p>
      </div>,
    );

  if (saved)
    return shell(
      <div className="rise text-center">
        <span className="icon-badge pill-safe mx-auto mb-5 size-24">
          <Icon name="shieldCheck" className="size-12" strokeWidth={1.75} />
        </span>
        <h1 ref={heading} tabIndex={-1} className="mb-3 text-[2rem] leading-tight font-bold outline-none">
          You&apos;re protected, {data.rose.name}
        </h1>
        <p className="mb-8 text-muted">From now on, if a payment looks risky, Hold On keeps your money safe and asks {name} to take a look.</p>
        <a className="btn btn-primary btn-lg btn-block" href={`/rose?h=${h}`}>
          Go to my app
          <Icon name="arrowRight" className="size-6" />
        </a>
      </div>,
    );

  return shell(
    <div className="rise">
      <p className="eyebrow mb-2">Set up once, while calm</p>
      <h1 ref={heading} tabIndex={-1} className="mb-3 text-[2rem] leading-tight font-bold outline-none">
        Your safety rules
      </h1>
      <p className="mb-8 text-muted">Choose these now, while things are calm. They will protect you on a day when someone is rushing or frightening you.</p>

      {error && (
        <p role="alert" className="card tone-danger mb-5 font-bold text-danger">
          {error}
        </p>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await send("/api/setup", {
            rosePhone: rosePhone || undefined,
            maya: { name, relation, phone: phone || undefined },
            rules: { newPayeeLimit: limit, secrecyPause: secrecy, timeoutHours: timeout },
          });
          if (r) setSaved(true);
        }}
      >
        <Step n={1} id="step1" title="Your safety person">
          <p className="mb-5 text-base text-muted">Someone you trust who can take a look when a payment seems risky. They can stop a payment, but they can never send your money anywhere.</p>
          <div className="grid gap-4">
            <label className="block">
              <span className="mb-1.5 block font-bold">Their name</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-bold">They are my…</span>
              <input className="field" value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="daughter, son, friend" required />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-bold">
                Their phone number <span className="font-normal text-muted">(optional)</span>
              </span>
              <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-bold">
                Your phone number <span className="font-normal text-muted">(optional, so {name || "they"} can call you)</span>
              </span>
              <input className="field" value={rosePhone} onChange={(e) => setRosePhone(e.target.value)} inputMode="tel" autoComplete="tel" />
            </label>
          </div>
        </Step>

        <Step n={2} id="step2" title="Your rules">
          <fieldset className="mb-6">
            <legend className="mb-2 font-bold">Check with {name || "my safety person"} before I pay someone new more than:</legend>
            <div className="segmented">
              {LIMITS.map((l) => (
                <label key={l}>
                  <input type="radio" name="limit" className="sr-only" checked={limit === l} onChange={() => setLimit(l)} />
                  {money(l).replace(".00", "")}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="choice mb-6 items-start">
            <input type="checkbox" className="mt-1 size-6 shrink-0 accent-[var(--brand)]" checked={secrecy} onChange={(e) => setSecrecy(e.target.checked)} />
            <span>
              <span className="block font-bold">Always pause a payment if someone asks me to keep it secret.</span>
              <span className="text-base text-muted">Real family and real companies never ask you to hide a payment.</span>
            </span>
          </label>
          <fieldset>
            <legend className="mb-2 font-bold">If {name || "my safety person"} doesn&apos;t answer, cancel the payment after:</legend>
            <div className="segmented">
              {TIMEOUTS.map((t) => (
                <label key={t}>
                  <input type="radio" name="timeout" className="sr-only" checked={timeout === t} onChange={() => setTimeoutHours(t)} />
                  {t} hours
                </label>
              ))}
            </div>
          </fieldset>
        </Step>

        <Step n={3} id="step3" title="Link your PayPal">
          {data.linked || linkedParam === "ok" ? (
            <p className="flex items-center gap-2 font-bold text-safe">
              <Icon name="check" strokeWidth={3} />
              Your PayPal is linked.
            </p>
          ) : data.paypalReady ? (
            <>
              <p className="mb-4 text-base text-muted">You&apos;ll log in to PayPal once and agree. After that, Hold On can hold a payment safely without asking you to log in every time.</p>
              <a className="btn btn-secondary btn-block" href={`/api/link?h=${h}`}>
                <Icon name="link" />
                Link my PayPal
              </a>
            </>
          ) : (
            <p className="text-base text-muted">In this demo, Rose&apos;s PayPal sandbox account is already linked.</p>
          )}
          {linkedParam === "cancelled" && <p className="mt-3 text-base text-warn">Linking was cancelled. You can try again any time.</p>}
        </Step>

        <p className="card tone-brand mb-5 font-bold">I chose these rules while calm. They protect me when I&apos;m not.</p>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          Save my rules
        </button>
      </form>
    </div>,
  );
}

function Step({ n, id, title, children }: { n: number; id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card mb-5 p-5" aria-labelledby={id}>
      <h2 id={id} className="mb-3 flex items-center gap-3 text-[1.375rem] font-bold">
        <span className="icon-badge size-9 bg-brand text-base text-brand-ink" aria-hidden="true">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
