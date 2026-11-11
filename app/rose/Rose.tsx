"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Payee, Payment } from "@/lib/store.ts";
import { isActive, LESSONS, money, speak, STATUS_WORDS, timeLeft, useDictation, useHousehold, type HouseholdView } from "../client.ts";
import { Avatar, Icon, Logo, LogoMark, Pill, Spinner, STATUS_TONE, type IconName, type Tone } from "../ui.tsx";

type Screen = { name: "home" } | { name: "send" } | { name: "check"; text?: string } | { name: "payment"; id: string };

export default function Rose() {
  const h = useSearchParams().get("h") ?? "rose-demo";
  const { data, error, busy, send, setError } = useHousehold(h);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const heading = useRef<HTMLHeadingElement>(null);

  // Move focus to the new screen's heading so screen readers announce the change.
  useEffect(() => heading.current?.focus(), [screen.name]);

  // A new Judge Mode scenario returns to home, where the new message and draft wait.
  const draftKey = data?.draft ? `${data.draft.scenario}-${data.scenariosRun}` : "";
  const lastDraft = useRef("");
  useEffect(() => {
    if (draftKey && draftKey !== lastDraft.current) {
      lastDraft.current = draftKey;
      setScreen({ name: "home" });
    }
  }, [draftKey]);

  if (!data)
    return (
      <Shell>
        <div role="status" className="py-16 text-center text-muted">
          <Spinner className="size-10" />
          <p className="mt-4">Loading…</p>
        </div>
      </Shell>
    );

  const go = (s: Screen) => {
    setError(null);
    setScreen(s);
  };

  return (
    <Shell h={data.id}>
      {error && (
        <div role="alert" className="card tone-danger mb-5 flex items-start gap-3 font-bold text-danger">
          <Icon name="alert" className="mt-1 size-6 shrink-0" />
          {error}
        </div>
      )}
      {screen.name === "home" && <Home data={data} heading={heading} go={go} />}
      {screen.name === "send" && (
        <Send
          data={data}
          heading={heading}
          busy={busy}
          back={() => go({ name: "home" })}
          submit={async (body) => {
            const r = await send("/api/pay", body);
            if (r) go({ name: "payment", id: r.payments[0].id });
          }}
        />
      )}
      {screen.name === "check" && <CheckReal data={data} heading={heading} busy={busy} initial={screen.text} send={send} back={() => go({ name: "home" })} />}
      {screen.name === "payment" && <PaymentScreen data={data} id={screen.id} heading={heading} busy={busy} send={send} done={() => go({ name: "home" })} />}
    </Shell>
  );
}

function Shell({ children, h }: { children: React.ReactNode; h?: string }) {
  return (
    <div className="min-h-dvh text-[1.25rem]">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-3">
          <Logo />
          {h && (
            <a href={`/setup?h=${h}`} className="btn btn-ghost min-h-12 gap-2 px-3 text-base">
              <Icon name="sliders" />
              My rules
            </a>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-12">{children}</main>
    </div>
  );
}

type H = { heading: React.RefObject<HTMLHeadingElement | null> };

function Title({ heading, children, center }: H & { children: React.ReactNode; center?: boolean }) {
  return (
    <h1 ref={heading} tabIndex={-1} className={`mb-3 text-[2rem] leading-tight font-bold tracking-tight outline-none ${center ? "text-center" : ""}`}>
      {children}
    </h1>
  );
}

function HeroIcon({ icon, tone, pulse }: { icon: IconName; tone: Tone; pulse?: boolean }) {
  return (
    <span className={`icon-badge pill-${tone} mx-auto mb-5 size-24 ${pulse ? "pulse-ring" : ""}`}>
      <Icon name={icon} className="size-12" strokeWidth={1.75} />
    </span>
  );
}

const greeting = () => {
  const hr = new Date().getHours();
  return hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
};

// ---------------- Home ----------------

function Home({ data, heading, go }: H & { data: HouseholdView; go: (s: Screen) => void }) {
  const active = data.payments.find(isActive);
  return (
    <div className="rise">
      <p className="text-base text-muted">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      <Title heading={heading}>
        {greeting()}, {data.rose.name}
      </Title>

      <div className="card tone-safe mb-6 flex items-center gap-4">
        <span className="icon-badge size-12 bg-safe text-surface">
          <Icon name="shieldCheck" className="size-6" />
        </span>
        <p className="leading-snug">
          <span className="block font-bold text-safe">You&apos;re protected</span>
          <span className="text-base">
            {data.maya.name} checks anything risky before it&apos;s sent.
          </span>
        </p>
      </div>

      {active && (
        <button className="card card-tap tone-warn mb-6 flex w-full items-center gap-4 text-left" onClick={() => go({ name: "payment", id: active.id })}>
          <span className="icon-badge size-12 bg-warn text-surface">
            <Icon name="clock" className="size-6" />
          </span>
          <span className="flex-1 leading-snug">
            <span className="block font-bold text-warn">Payment waiting</span>
            <span className="text-base">
              {money(active.amount)} to {active.to.name} · {STATUS_WORDS[active.status]}
            </span>
          </span>
          <Icon name="chevronRight" className="size-6 text-muted" />
        </button>
      )}

      {data.inbox.slice(0, 2).map((m, i) => (
        <section key={m.id} className="card mb-4" aria-label={`Message from ${m.from}`}>
          <div className="mb-3 flex items-center gap-3">
            <span className="icon-badge pill-neutral size-10">
              <Icon name={m.kind === "sms" ? "message" : "mail"} />
            </span>
            <p className="flex-1 text-base leading-tight">
              <span className="block text-sm text-muted">{m.kind === "sms" ? "Text message" : "Email"}</span>
              <strong>{m.from}</strong>
            </p>
            {i === 0 && <Pill tone="brand">New</Pill>}
          </div>
          {m.subject && <p className="mb-1 font-bold">{m.subject}</p>}
          <p className="rounded-2xl bg-surface-2 p-4 leading-relaxed">{m.body}</p>
          <button className="btn btn-secondary btn-block mt-4" onClick={() => go({ name: "check", text: `${m.subject ?? ""}\n${m.body}`.trim() })}>
            <Icon name="search" />
            Is this real?
          </button>
        </section>
      ))}

      <div className="mt-2 grid gap-3">
        <button className="btn btn-primary btn-lg btn-block" onClick={() => go({ name: "send" })}>
          <Icon name="send" className="size-6" />
          Send money
        </button>
        <button className="btn btn-secondary btn-lg btn-block" onClick={() => go({ name: "check" })}>
          <Icon name="search" className="size-6" />
          Is this real?
        </button>
      </div>

      {data.payments.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 text-[1.375rem] font-bold">Recent payments</h2>
          <ul className="card divide-y divide-line p-0">
            {data.payments.slice(0, 5).map((p) => (
              <li key={p.id}>
                <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2" onClick={() => go({ name: "payment", id: p.id })}>
                  <Avatar name={p.to.name} tone={p.to.known ? "neutral" : "brand"} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{p.to.name}</span>
                    <Pill tone={STATUS_TONE[p.status]}>{STATUS_WORDS[p.status]}</Pill>
                  </span>
                  <span className="font-bold tabular-nums">{money(p.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ---------------- Send ----------------

type PayBody = { payeeId?: string; newPayee?: { name: string; wallet: "PAYPAL" | "VENMO"; handle: string }; amount: string; purpose: string; context?: string };

function Send({ data, heading, busy, back, submit }: H & { data: HouseholdView; busy: boolean; back: () => void; submit: (b: PayBody) => void }) {
  const d = data.draft;
  const [payee, setPayee] = useState<Payee | "new" | null>(d?.payee ?? null);
  const [newName, setNewName] = useState("");
  const [wallet, setWallet] = useState<"PAYPAL" | "VENMO">("PAYPAL");
  const [handle, setHandle] = useState("");
  const [amount, setAmount] = useState(d?.amount ? String(Number(d.amount)) : "");
  const [purpose, setPurpose] = useState(d?.purpose ?? "");
  const [context, setContext] = useState(d?.context ?? "");
  const dict = useDictation((t) => setPurpose((p) => (p ? `${p} ${t}` : t)));

  const ready = payee && amount && purpose && (payee !== "new" || (newName && handle));
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    submit({
      ...(payee === "new" ? { newPayee: { name: newName, wallet, handle } } : { payeeId: payee.id }),
      amount,
      purpose,
      context: context || undefined,
    });
  };

  if (busy)
    return (
      <div role="status" aria-live="polite" className="rise py-14 text-center">
        <HeroIcon icon="shield" tone="brand" pulse />
        <p className="text-[1.75rem] font-bold">One moment, {data.rose.name}…</p>
        <p className="mt-1 text-muted">Hold On is checking this payment for you.</p>
      </div>
    );

  return (
    <form onSubmit={go} className="rise">
      <Title heading={heading}>Send money</Title>

      <fieldset className="mb-7">
        <legend className="mb-3 font-bold">Who are you paying?</legend>
        <div className="grid gap-2.5">
          {[...(d?.payee && !d.payee.known ? [d.payee] : []), ...data.payees].map((p) => (
            <label key={p.id} className="choice">
              <input type="radio" name="payee" className="sr-only" checked={payee !== "new" && payee?.id === p.id} onChange={() => setPayee(p)} />
              <Avatar name={p.name} tone={p.known ? "neutral" : "warn"} />
              <span className="min-w-0 flex-1 leading-snug">
                <span className="block font-bold">{p.name}</span>
                <span className="text-base text-muted">
                  {p.wallet === "VENMO" ? "Venmo" : "PayPal"} · {p.known ? "you've paid them before" : "new to you"}
                </span>
              </span>
              <Radio on={payee !== "new" && payee?.id === p.id} />
            </label>
          ))}
          <label className="choice">
            <input type="radio" name="payee" className="sr-only" checked={payee === "new"} onChange={() => setPayee("new")} />
            <span className="icon-badge pill-neutral size-11">
              <Icon name="users" />
            </span>
            <span className="flex-1 font-bold">Someone new</span>
            <Radio on={payee === "new"} />
          </label>
        </div>
      </fieldset>

      {payee === "new" && (
        <div className="card mb-7 grid gap-4">
          <label>
            <span className="mb-1.5 block font-bold">Their name</span>
            <input className="field" value={newName} onChange={(e) => setNewName(e.target.value)} autoComplete="off" />
          </label>
          <fieldset>
            <legend className="mb-1.5 font-bold">How do they get paid?</legend>
            <div className="segmented">
              {(["PAYPAL", "VENMO"] as const).map((w) => (
                <label key={w}>
                  <input type="radio" name="wallet" className="sr-only" checked={wallet === w} onChange={() => setWallet(w)} />
                  {w === "PAYPAL" ? "PayPal" : "Venmo"}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            <span className="mb-1.5 block font-bold">{wallet === "VENMO" ? "Their phone number" : "Their email"}</span>
            <input className="field" value={handle} onChange={(e) => setHandle(e.target.value)} inputMode={wallet === "VENMO" ? "tel" : "email"} autoComplete="off" />
          </label>
        </div>
      )}

      <label className="mb-7 block">
        <span className="mb-1.5 block font-bold">How much?</span>
        <span className="field flex min-h-20 items-center gap-1 focus-within:border-brand focus-within:shadow-[0_0_0_4px_var(--brand-soft)]">
          <span className="text-[2.25rem] font-bold text-muted" aria-hidden="true">
            $
          </span>
          <input
            className="w-full bg-transparent text-[2.25rem] font-bold tabular-nums outline-none"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            aria-label="Amount in dollars"
          />
        </span>
      </label>

      <label className="mb-2 block">
        <span className="mb-1.5 block font-bold">What is it for?</span>
        <input className="field" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      </label>
      {dict.supported && (
        <button type="button" className="btn btn-ghost mb-6 -ml-2 px-3 text-base" onClick={dict.toggle} aria-pressed={dict.listening}>
          <Icon name="mic" />
          {dict.listening ? "Listening… tap to stop" : "Say it instead"}
        </button>
      )}

      <details className="card mt-4 mb-8" open={Boolean(context)}>
        <summary className="flex cursor-pointer items-center gap-3 font-bold">
          <Icon name="message" className="size-6 text-muted" />
          Did someone ask you for this money?
        </summary>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-base text-muted">Paste their message here (optional). It helps Hold On check.</span>
          <textarea className="field min-h-28" value={context} onChange={(e) => setContext(e.target.value)} />
        </label>
      </details>

      <div className="grid gap-3">
        <button className="btn btn-primary btn-lg btn-block" disabled={!ready}>
          {amount ? `Send ${money(amount)}` : "Send"}
          <Icon name="arrowRight" className="size-6" />
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={back}>
          Go back
        </button>
      </div>
      <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-muted">
        <Icon name="lock" className="size-4" />
        Risky payments are held on your PayPal, never sent.
      </p>
    </form>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${on ? "border-brand bg-brand text-brand-ink" : "border-line-strong"}`}>
      {on && <Icon name="check" className="size-4" strokeWidth={3} />}
    </span>
  );
}

// ---------------- One payment: question, hold, outcome ----------------

function Timeline({ steps }: { steps: { label: string; state: "done" | "now" | "todo" }[] }) {
  return (
    <ol className="card mb-5 grid gap-0 py-2">
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex items-center gap-3.5 py-2.5">
          {i < steps.length - 1 && <span aria-hidden="true" className="absolute top-[2.4rem] left-[0.95rem] h-[calc(100%-1.4rem)] w-0.5 bg-line" />}
          <span
            className={`icon-badge z-[1] size-8 ${s.state === "done" ? "bg-safe text-surface" : s.state === "now" ? "pulse-ring bg-warn text-surface" : "border-2 border-line-strong bg-surface text-muted"}`}
          >
            {s.state === "done" ? <Icon name="check" className="size-4" strokeWidth={3} /> : s.state === "now" ? <Icon name="clock" className="size-4" strokeWidth={2.5} /> : null}
          </span>
          <span className={`text-base ${s.state === "todo" ? "text-muted" : "font-bold"}`}>
            {s.label}
            <span className="sr-only">{s.state === "done" ? " (done)" : s.state === "now" ? " (happening now)" : ""}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function PaymentScreen({ data, id, heading, busy, send, done }: H & { data: HouseholdView; id: string; busy: boolean; send: (path: string, body: object) => Promise<unknown>; done: () => void }) {
  const p = data.payments.find((x) => x.id === id);
  const [text, setText] = useState("");
  const dict = useDictation(setText);
  const [autoRead, setAutoRead] = useState(true);
  const lastSpoken = useRef("");
  const question = p?.status === "asking" ? p.turns.at(-1) : undefined;

  useEffect(() => {
    if (autoRead && question && question.text !== lastSpoken.current) {
      lastSpoken.current = question.text;
      speak(question.text);
    }
  }, [question, autoRead]);

  if (!p) return <Title heading={heading}>Payment not found</Title>;
  const act = (action: string, extra: object = {}) => send("/api/payment", { id: p.id, action, ...extra });
  const callMaya = (
    <a className="btn btn-primary btn-block" href={`tel:${data.maya.phone ?? "+15550100200"}`}>
      <Icon name="phone" />
      Call {data.maya.name}
    </a>
  );

  if (busy || p.status === "checking" || p.status === "releasing")
    return (
      <div role="status" aria-live="polite" className="py-14 text-center">
        <HeroIcon icon={p.status === "releasing" ? "send" : "shield"} tone="brand" pulse />
        <p className="text-[1.75rem] font-bold">{p.status === "releasing" ? "Sending…" : "Checking…"}</p>
      </div>
    );

  if (p.status === "asking" && question)
    return (
      <div className="rise">
        <p className="mb-1 text-base text-muted">
          Before we send {money(p.amount)} to {p.to.name}
        </p>
        <Title heading={heading}>Quick question</Title>

        <div className="mb-3 flex items-start gap-3">
          <LogoMark className="mt-1 size-10 shrink-0" />
          <p className="card flex-1 rounded-tl-md text-[1.5rem] leading-snug font-bold" aria-live="polite">
            {question.text}
          </p>
        </div>
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 pl-[3.25rem]">
          <button className="btn btn-ghost -ml-3 min-h-12 px-3 text-base" onClick={() => speak(question.text)}>
            <Icon name="volume" />
            Read it to me
          </button>
          <label className="flex min-h-12 items-center gap-2 text-base">
            <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} />
            Read questions out loud
          </label>
        </div>

        <div className="mb-6 grid gap-2.5">
          {question.options?.map((o) => (
            <button key={o} className="choice text-left font-bold" onClick={() => act("answer", { text: o })}>
              <span className="flex-1">{o}</span>
              <Icon name="chevronRight" className="size-6 text-muted" />
            </button>
          ))}
        </div>

        <form
          className="card mb-6 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) act("answer", { text });
          }}
        >
          <label>
            <span className="mb-1.5 block font-bold">Or answer in your own words</span>
            <input className="field" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary flex-1">Answer</button>
            {dict.supported && (
              <button type="button" className="btn btn-secondary flex-1" onClick={dict.toggle} aria-pressed={dict.listening}>
                <Icon name="mic" />
                {dict.listening ? "Listening…" : "Say it"}
              </button>
            )}
          </div>
        </form>
        <button className="btn btn-ghost btn-block text-danger" onClick={() => act("cancel")}>
          Cancel this payment
        </button>
      </div>
    );

  if (p.status === "held")
    return (
      <div className="rise">
        <div className="text-center">
          <HeroIcon icon="shieldCheck" tone="warn" pulse />
          <Title heading={heading} center>
            Your money is safe
          </Title>
          <p className="text-[2.5rem] leading-none font-bold tabular-nums">{money(p.amount)}</p>
          <p className="mt-2 mb-6 text-muted">
            is on hold. Nothing has been sent to {p.to.name}.
          </p>
        </div>
        <Timeline
          steps={[
            { label: "Checked by Hold On", state: "done" },
            { label: "Held safely on your PayPal", state: "done" },
            { label: `${data.maya.name} is taking a look`, state: "now" },
          ]}
        />
        {p.verdict?.messageToRose && <p className="mb-5 leading-relaxed">{p.verdict.messageToRose}</p>}
        <RedFlags p={p} />
        <p className="mb-6 flex gap-3 text-base text-muted">
          <Icon name="clock" className="mt-0.5 size-5 shrink-0" />
          If {data.maya.name} doesn&apos;t answer, this cancels itself in {timeLeft(p.holdUntil)} and your money stays with you.
        </p>
        <div className="grid gap-3">
          {callMaya}
          <button className="btn btn-secondary btn-block" onClick={() => act("cancel")}>
            Cancel this payment
          </button>
          <button className="btn btn-ghost btn-block" onClick={done}>
            Back to home
          </button>
        </div>
      </div>
    );

  const stopped = p.status === "blocked" || p.status === "cancelled" || p.status === "expired";
  if (stopped) {
    const lesson = LESSONS[p.verdict?.scamType ?? ""];
    const warning = lesson ? `Watch out for ${lesson.name}. ${lesson.how}` : "";
    return (
      <div className="rise">
        <div className="text-center">
          <HeroIcon icon="check" tone="safe" />
          <Title heading={heading} center>
            Your money is back
          </Title>
          <p className="mb-6 text-muted">
            <strong className="text-ink">{money(p.amount)} never left your account.</strong>{" "}
            {p.status === "blocked" ? `${data.maya.name} stopped this payment.` : p.status === "cancelled" ? "You cancelled this payment." : `${data.maya.name} didn't answer in time, so we cancelled it to be safe.`}
          </p>
        </div>
        {lesson && (
          <section className="card tone-brand mb-6" aria-label="What happened">
            <p className="eyebrow mb-1 text-brand">What happened</p>
            <h2 className="mb-2 text-[1.375rem] leading-snug font-bold">This looked like {lesson.name}</h2>
            <p className="leading-relaxed">{lesson.how}</p>
            <p className="mt-3 font-bold">Many careful people get these messages. You did the right thing by checking.</p>
          </section>
        )}
        <div className="grid gap-3">
          {warning && typeof navigator !== "undefined" && "share" in navigator && (
            <button className="btn btn-secondary btn-block" onClick={() => navigator.share({ title: "Scam warning", text: warning }).catch(() => {})}>
              <Icon name="share" />
              Warn a friend
            </button>
          )}
          <button className="btn btn-primary btn-block" onClick={done}>
            Back to home
          </button>
        </div>
      </div>
    );
  }

  if (p.status === "failed")
    return (
      <div className="rise text-center">
        <HeroIcon icon="alert" tone="danger" />
        <Title heading={heading} center>
          That didn&apos;t go through
        </Title>
        <p className="mb-6">{p.error ?? "Something went wrong."} No money was sent.</p>
        <button className="btn btn-primary btn-block" onClick={done}>
          Back to home
        </button>
      </div>
    );

  return (
    <div className="rise text-center">
      <HeroIcon icon="check" tone="safe" />
      <Title heading={heading} center>
        {p.status === "delivered" ? "Delivered" : "Sent"}
      </Title>
      <p className="text-[2.5rem] leading-none font-bold tabular-nums">{money(p.amount)}</p>
      <p className="mt-2 mb-6 text-muted">
        {p.status === "delivered" ? "reached" : "is on its way to"} {p.to.name}
      </p>
      {p.verdict?.messageToRose && <p className="card mb-6 text-left">{p.verdict.messageToRose}</p>}
      <button className="btn btn-primary btn-block" onClick={done}>
        Back to home
      </button>
    </div>
  );
}

function RedFlags({ p }: { p: Payment }) {
  if (!p.verdict?.redFlags.length) return null;
  return (
    <section className="card mb-5" aria-label="What we noticed">
      <h2 className="mb-3 text-[1.25rem] font-bold">What we noticed</h2>
      <ul className="grid gap-2.5">
        {p.verdict.redFlags.slice(0, 4).map((f) => (
          <li key={f.flag} className="flex gap-3 text-base leading-snug">
            <Icon name="alert" className="mt-0.5 size-5 shrink-0 text-warn" />
            {f.flag}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------- Is this real? ----------------

function CheckReal({ data, heading, busy, initial, send, back }: H & { data: HouseholdView; busy: boolean; initial?: string; send: (path: string, body: object) => Promise<HouseholdView | null>; back: () => void }) {
  const [text, setText] = useState(initial ?? "");
  const [photo, setPhoto] = useState<{ data: string; type: string; name: string } | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const result = data.checks.find((c) => c.id === resultId);

  const pick = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPhoto({ data: String(r.result).split(",")[1], type: f.type, name: f.name });
    r.readAsDataURL(f);
  };

  if (busy)
    return (
      <div role="status" aria-live="polite" className="py-14 text-center">
        <HeroIcon icon="search" tone="brand" pulse />
        <p className="text-[1.75rem] font-bold">Looking at it…</p>
      </div>
    );

  if (result) {
    const v = result.verdict;
    const tone: Tone = v.level === "scam" ? "danger" : v.level === "careful" ? "warn" : "safe";
    const word = v.level === "scam" ? "This is a scam" : v.level === "careful" ? "Be careful" : "Looks safe";
    return (
      <div className="rise">
        <div className="text-center">
          <HeroIcon icon={v.level === "safe" ? "shieldCheck" : "alert"} tone={tone} />
          <p className="mb-2">
            <Pill tone={tone}>{word}</Pill>
          </p>
          <Title heading={heading} center>
            {v.title}
          </Title>
        </div>
        <p className="mb-6 leading-relaxed">{v.explanation}</p>
        <section className="card mb-6">
          <h2 className="mb-3 text-[1.25rem] font-bold">What to do</h2>
          <ol className="grid gap-3">
            {v.whatToDo.map((s, i) => (
              <li key={s} className="flex gap-3 text-base leading-snug">
                <span className="icon-badge pill-brand size-7 text-sm font-bold">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </section>
        <div className="grid gap-3">
          <button className="btn btn-secondary btn-block" onClick={() => speak(`${v.title}. ${v.explanation}`)}>
            <Icon name="volume" />
            Read it to me
          </button>
          <button className="btn btn-primary btn-block" onClick={back}>
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="rise"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await send("/api/check", { text: text || undefined, imageBase64: photo?.data, mediaType: photo?.type });
        if (r) setResultId(r.checks[0].id);
      }}
    >
      <Title heading={heading}>Is this real?</Title>
      <p className="mb-6 text-muted">Paste a message, email or invoice, or take a photo of it. Hold On will tell you if it looks like a scam.</p>
      <label className="mb-4 block">
        <span className="mb-1.5 block font-bold">The message</span>
        <textarea className="field min-h-44 leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className={`choice mb-6 justify-center font-bold ${photo ? "border-safe" : "border-dashed border-line-strong"}`}>
        <Icon name={photo ? "check" : "camera"} className="size-6" />
        <span className="truncate">{photo ? `Photo added: ${photo.name}` : "Take or add a photo"}</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      <div className="grid gap-3">
        <button className="btn btn-primary btn-lg btn-block" disabled={!text.trim() && !photo}>
          <Icon name="search" className="size-6" />
          Check it
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={back}>
          Go back
        </button>
      </div>
    </form>
  );
}
