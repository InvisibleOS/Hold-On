"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Payee, Payment } from "@/lib/store.ts";
import { isActive, LESSONS, money, speak, STATUS_WORDS, timeLeft, useDictation, useHousehold, type HouseholdView } from "../client.ts";

type Screen = { name: "home" } | { name: "send" } | { name: "check"; text?: string } | { name: "payment"; id: string };

export default function Rose() {
  const h = useSearchParams().get("h") ?? "rose-demo";
  const { data, error, busy, send, setError } = useHousehold(h);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const heading = useRef<HTMLHeadingElement>(null);

  // Move focus to the new screen's heading so screen readers announce the change.
  useEffect(() => heading.current?.focus(), [screen.name]);

  // A new Judge Mode scenario opens the send screen with the draft ready.
  const draftKey = data?.draft ? `${data.draft.scenario}-${data.scenariosRun}` : "";
  const lastDraft = useRef("");
  useEffect(() => {
    if (draftKey && draftKey !== lastDraft.current) {
      lastDraft.current = draftKey;
      setScreen({ name: "home" });
    }
  }, [draftKey]);

  if (!data) return <Shell><p className="text-xl" role="status">Loading…</p></Shell>;

  const go = (s: Screen) => {
    setError(null);
    setScreen(s);
  };

  return (
    <Shell>
      {error && (
        <div role="alert" className="card mb-4 border-danger bg-danger-bg text-danger text-lg font-bold">
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
      {screen.name === "payment" && (
        <PaymentScreen data={data} id={screen.id} heading={heading} busy={busy} send={send} done={() => go({ name: "home" })} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-5 text-[1.25rem]">
      <p className="mb-3 text-base font-bold text-brand" aria-hidden="true">
        Hold On
      </p>
      {children}
    </main>
  );
}

type H = { heading: React.RefObject<HTMLHeadingElement | null> };

function Title({ heading, children }: H & { children: React.ReactNode }) {
  return (
    <h1 ref={heading} tabIndex={-1} className="mb-4 text-3xl font-bold leading-tight outline-none">
      {children}
    </h1>
  );
}

// ---------------- Home ----------------

function Home({ data, heading, go }: H & { data: HouseholdView; go: (s: Screen) => void }) {
  const active = data.payments.find(isActive);
  return (
    <>
      <Title heading={heading}>Hello, {data.rose.name}</Title>
      <p className="mb-5 text-muted">
        Your safety person is <strong className="text-ink">{data.maya.name}</strong>.
      </p>

      {active && (
        <button className="card mb-5 w-full border-warn bg-warn-bg text-left" onClick={() => go({ name: "payment", id: active.id })}>
          <span className="block font-bold text-warn">Payment waiting</span>
          {money(active.amount)} to {active.to.name} · {STATUS_WORDS[active.status]}
        </button>
      )}

      {data.inbox.slice(0, 2).map((m) => (
        <section key={m.id} className="card mb-4" aria-label={`Message from ${m.from}`}>
          <p className="text-base text-muted">
            {m.kind === "sms" ? "Text message" : "Email"} from <strong className="text-ink">{m.from}</strong>
          </p>
          {m.subject && <p className="font-bold">{m.subject}</p>}
          <p className="mt-1">{m.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-secondary" onClick={() => go({ name: "check", text: `${m.subject ?? ""}\n${m.body}`.trim() })}>
              Is this real?
            </button>
            {data.draft && (
              <button className="btn btn-primary" onClick={() => go({ name: "send" })}>
                Send money
              </button>
            )}
          </div>
        </section>
      ))}

      <div className="grid gap-3">
        <button className="btn btn-primary text-2xl" onClick={() => go({ name: "send" })}>
          Send money
        </button>
        <button className="btn btn-secondary text-2xl" onClick={() => go({ name: "check" })}>
          Is this real?
        </button>
      </div>

      <h2 className="mb-2 mt-8 text-2xl font-bold">Recent</h2>
      <ul className="grid gap-2">
        {data.payments.slice(0, 5).map((p) => (
          <li key={p.id}>
            <button className="card flex w-full justify-between gap-3 text-left" onClick={() => go({ name: "payment", id: p.id })}>
              <span>
                <span className="block font-bold">{p.to.name}</span>
                <span className="text-base text-muted">{STATUS_WORDS[p.status]}</span>
              </span>
              <span className="font-bold">{money(p.amount)}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
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
      <div role="status" aria-live="polite" className="py-10 text-center">
        <Spinner />
        <p className="mt-4 text-2xl font-bold">One moment, {data.rose.name}…</p>
        <p className="text-muted">Hold On is checking this payment for you.</p>
      </div>
    );

  return (
    <form onSubmit={go}>
      <Title heading={heading}>Send money</Title>

      <fieldset className="mb-5">
        <legend className="mb-2 font-bold">Who are you paying?</legend>
        <div className="grid gap-2">
          {[...(d?.payee && !d.payee.known ? [d.payee] : []), ...data.payees].map((p) => (
            <label key={p.id} className={`card flex min-h-14 cursor-pointer items-center gap-3 ${payee !== "new" && payee?.id === p.id ? "border-brand outline-2 outline-brand" : ""}`}>
              <input type="radio" name="payee" className="size-6" checked={payee !== "new" && payee?.id === p.id} onChange={() => setPayee(p)} />
              <span>
                <span className="block font-bold">{p.name}</span>
                <span className="text-base text-muted">
                  {p.wallet === "VENMO" ? "Venmo" : "PayPal"} · {p.known ? "you've paid them before" : "new to you"}
                </span>
              </span>
            </label>
          ))}
          <label className={`card flex min-h-14 cursor-pointer items-center gap-3 ${payee === "new" ? "border-brand outline-2 outline-brand" : ""}`}>
            <input type="radio" name="payee" className="size-6" checked={payee === "new"} onChange={() => setPayee("new")} />
            <span className="font-bold">Someone new</span>
          </label>
        </div>
      </fieldset>

      {payee === "new" && (
        <div className="mb-5 grid gap-3">
          <label>
            <span className="mb-1 block font-bold">Their name</span>
            <input className="field" value={newName} onChange={(e) => setNewName(e.target.value)} autoComplete="off" />
          </label>
          <fieldset>
            <legend className="mb-1 font-bold">How do they get paid?</legend>
            <div className="flex gap-2">
              {(["PAYPAL", "VENMO"] as const).map((w) => (
                <label key={w} className={`btn flex-1 cursor-pointer ${wallet === w ? "btn-primary" : "btn-secondary"}`}>
                  <input type="radio" name="wallet" className="sr-only" checked={wallet === w} onChange={() => setWallet(w)} />
                  {w === "PAYPAL" ? "PayPal" : "Venmo"}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            <span className="mb-1 block font-bold">{wallet === "VENMO" ? "Their phone number" : "Their email"}</span>
            <input className="field" value={handle} onChange={(e) => setHandle(e.target.value)} inputMode={wallet === "VENMO" ? "tel" : "email"} autoComplete="off" />
          </label>
        </div>
      )}

      <label className="mb-5 block">
        <span className="mb-1 block font-bold">How much?</span>
        <span className="flex items-center gap-2">
          <span className="text-3xl font-bold" aria-hidden="true">
            $
          </span>
          <input className="field text-3xl font-bold" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Amount in dollars" />
        </span>
      </label>

      <label className="mb-2 block">
        <span className="mb-1 block font-bold">What is it for?</span>
        <input className="field" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      </label>
      {dict.supported && (
        <button type="button" className="btn btn-secondary mb-5" onClick={dict.toggle} aria-pressed={dict.listening}>
          {dict.listening ? "Listening… tap to stop" : "🎤 Say it instead"}
        </button>
      )}

      <details className="mb-6" open={Boolean(context)}>
        <summary className="cursor-pointer font-bold">Did someone ask you for this money?</summary>
        <label className="mt-2 block">
          <span className="mb-1 block text-muted">Paste their message here (optional). It helps Hold On check.</span>
          <textarea className="field min-h-28" value={context} onChange={(e) => setContext(e.target.value)} />
        </label>
      </details>

      <div className="grid gap-3">
        <button className="btn btn-primary text-2xl" disabled={!ready}>
          {amount ? `Send ${money(amount)}` : "Send"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={back}>
          Go back
        </button>
      </div>
    </form>
  );
}

// ---------------- One payment: question, hold, outcome ----------------

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
    <a className="btn btn-secondary" href="tel:+15550100200">
      📞 Call {data.maya.name}
    </a>
  );

  if (busy || p.status === "checking" || p.status === "releasing")
    return (
      <div role="status" aria-live="polite" className="py-10 text-center">
        <Spinner />
        <p className="mt-4 text-2xl font-bold">{p.status === "releasing" ? "Sending…" : "Checking…"}</p>
      </div>
    );

  if (p.status === "asking" && question)
    return (
      <div>
        <Title heading={heading}>Quick question</Title>
        <p className="mb-2 text-muted">
          Before we send {money(p.amount)} to {p.to.name}:
        </p>
        <p className="card mb-4 text-2xl font-bold" aria-live="polite">
          {question.text}
        </p>
        <button className="btn btn-secondary mb-4" onClick={() => speak(question.text)}>
          🔊 Read it to me
        </button>
        <label className="mb-4 flex items-center gap-3 text-base">
          <input type="checkbox" className="size-5" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} />
          Read questions out loud
        </label>
        <div className="mb-4 grid gap-2">
          {question.options?.map((o) => (
            <button key={o} className="btn btn-secondary justify-start text-left" onClick={() => act("answer", { text: o })}>
              {o}
            </button>
          ))}
        </div>
        <form
          className="mb-6 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) act("answer", { text });
          }}
        >
          <label>
            <span className="mb-1 block font-bold">Or answer in your own words</span>
            <input className="field" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary">Answer</button>
            {dict.supported && (
              <button type="button" className="btn btn-secondary" onClick={dict.toggle} aria-pressed={dict.listening}>
                {dict.listening ? "Listening…" : "🎤 Say it"}
              </button>
            )}
          </div>
        </form>
        <button className="btn btn-secondary w-full" onClick={() => act("cancel")}>
          Cancel this payment
        </button>
      </div>
    );

  if (p.status === "held")
    return (
      <div>
        <Title heading={heading}>Your money is safe</Title>
        <div className="card mb-4 border-warn bg-warn-bg">
          <p className="text-2xl font-bold text-warn">🛡️ {money(p.amount)} is being held</p>
          <p className="mt-1">Nothing has been sent to {p.to.name}. {data.maya.name} is taking a look.</p>
        </div>
        {p.verdict?.messageToRose && <p className="mb-4">{p.verdict.messageToRose}</p>}
        <RedFlags p={p} />
        <p className="mb-4 text-muted">
          If {data.maya.name} doesn&apos;t answer, this payment cancels itself in {timeLeft(p.holdUntil)} and your money stays with you.
        </p>
        <div className="grid gap-3">
          {callMaya}
          <button className="btn btn-secondary" onClick={() => act("cancel")}>
            Cancel this payment
          </button>
          <button className="btn btn-secondary" onClick={done}>
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
      <div>
        <Title heading={heading}>Your money is back</Title>
        <div className="card mb-4 border-safe bg-safe-bg">
          <p className="text-2xl font-bold text-safe">✓ {money(p.amount)} never left your account</p>
          <p className="mt-1">
            {p.status === "blocked" ? `${data.maya.name} stopped this payment.` : p.status === "cancelled" ? "You cancelled this payment." : `${data.maya.name} didn't answer in time, so we cancelled it to be safe.`}
          </p>
        </div>
        {lesson && (
          <section className="card mb-4" aria-label="What happened">
            <h2 className="mb-1 text-2xl font-bold">This looked like {lesson.name}</h2>
            <p>{lesson.how}</p>
            <p className="mt-2 font-bold">Many careful people get these messages. You did the right thing by checking.</p>
          </section>
        )}
        <div className="grid gap-3">
          {warning && typeof navigator !== "undefined" && "share" in navigator && (
            <button className="btn btn-secondary" onClick={() => navigator.share({ title: "Scam warning", text: warning }).catch(() => {})}>
              Warn a friend
            </button>
          )}
          <button className="btn btn-primary" onClick={done}>
            Back to home
          </button>
        </div>
      </div>
    );
  }

  if (p.status === "failed")
    return (
      <div>
        <Title heading={heading}>That didn&apos;t go through</Title>
        <p className="mb-4">{p.error ?? "Something went wrong."} No money was sent.</p>
        <button className="btn btn-primary w-full" onClick={done}>
          Back to home
        </button>
      </div>
    );

  return (
    <div>
      <Title heading={heading}>{p.status === "delivered" ? "Delivered" : "Sent"}</Title>
      <div className="card mb-4 border-safe bg-safe-bg">
        <p className="text-2xl font-bold text-safe">
          ✓ {money(p.amount)} {p.status === "delivered" ? "reached" : "is on its way to"} {p.to.name}
        </p>
      </div>
      {p.verdict?.messageToRose && <p className="mb-4">{p.verdict.messageToRose}</p>}
      <button className="btn btn-primary w-full" onClick={done}>
        Back to home
      </button>
    </div>
  );
}

function RedFlags({ p }: { p: Payment }) {
  if (!p.verdict?.redFlags.length) return null;
  return (
    <section className="card mb-4" aria-label="What we noticed">
      <h2 className="mb-2 text-xl font-bold">What we noticed</h2>
      <ul className="grid list-disc gap-1 pl-6">
        {p.verdict.redFlags.slice(0, 4).map((f) => (
          <li key={f.flag}>{f.flag}</li>
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
      <div role="status" aria-live="polite" className="py-10 text-center">
        <Spinner />
        <p className="mt-4 text-2xl font-bold">Looking at it…</p>
      </div>
    );

  if (result) {
    const v = result.verdict;
    const tone = v.level === "scam" ? "border-danger bg-danger-bg text-danger" : v.level === "careful" ? "border-warn bg-warn-bg text-warn" : "border-safe bg-safe-bg text-safe";
    const word = v.level === "scam" ? "⚠️ Scam" : v.level === "careful" ? "⚠️ Be careful" : "✓ Looks safe";
    return (
      <div>
        <Title heading={heading}>{v.title}</Title>
        <p className={`card mb-4 text-2xl font-bold ${tone}`}>{word}</p>
        <p className="mb-4">{v.explanation}</p>
        <h2 className="mb-2 text-xl font-bold">What to do</h2>
        <ol className="mb-6 grid list-decimal gap-1 pl-6">
          {v.whatToDo.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <div className="grid gap-3">
          <button className="btn btn-secondary" onClick={() => speak(`${v.title}. ${v.explanation}`)}>
            🔊 Read it to me
          </button>
          <button className="btn btn-primary" onClick={back}>
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await send("/api/check", { text: text || undefined, imageBase64: photo?.data, mediaType: photo?.type });
        if (r) setResultId(r.checks[0].id);
      }}
    >
      <Title heading={heading}>Is this real?</Title>
      <p className="mb-4 text-muted">Paste a message, email or invoice — or take a photo of it. Hold On will tell you if it looks like a scam.</p>
      <label className="mb-4 block">
        <span className="mb-1 block font-bold">The message</span>
        <textarea className="field min-h-40" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="btn btn-secondary mb-2 w-full cursor-pointer">
        📷 {photo ? `Photo added: ${photo.name}` : "Take or add a photo"}
        <input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      <div className="mt-4 grid gap-3">
        <button className="btn btn-primary text-2xl" disabled={!text.trim() && !photo}>
          Check it
        </button>
        <button type="button" className="btn btn-secondary" onClick={back}>
          Go back
        </button>
      </div>
    </form>
  );
}

function Spinner() {
  return <span aria-hidden="true" className="spin mx-auto block size-14 rounded-full border-[6px] border-line border-t-brand" />;
}
