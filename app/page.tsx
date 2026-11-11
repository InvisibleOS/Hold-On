import Link from "next/link";
import { Icon, Logo, LogoMark, type IconName } from "./ui.tsx";

const REPO = "https://github.com/InvisibleOS/Hold-On";

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "sliders", title: "Rose sets her rules, while calm", body: "She picks her safety person and her limits once. Those rules form a floor that no one, not even the AI, can talk down." },
  { icon: "sparkles", title: "A guardian asks, like a kind teller", body: "When a payment looks wrong, Hold On asks at most two gentle questions, read aloud if she likes, in her own language." },
  { icon: "lock", title: "PayPal holds it. Family decides.", body: "Instead of sending, Hold On places a PayPal authorization. Maya gets a brief on her phone and taps Block or Release." },
];

const APIS: { name: string; use: string }[] = [
  { name: "Vault v3", use: "Rose links PayPal once, so there's no pop-up on each payment." },
  { name: "Orders v2 · AUTHORIZE", use: "The hold: money reserved on her account, nothing moved." },
  { name: "Payments v2", use: "Block voids the authorization. Release captures it." },
  { name: "Payouts v1", use: "Released money goes to the recipient by PayPal or Venmo." },
  { name: "Invoicing v2", use: "The fake-invoice scenario uses a real sandbox invoice." },
  { name: "Webhooks", use: "Signature-verified events mark payouts delivered." },
];

const STATS = [
  { value: "29/29", label: "scams caught in our 49-case Scam Lab" },
  { value: "$0", label: "leaves a held payment until family says yes" },
  { value: "6", label: "PayPal APIs, all live in sandbox" },
  { value: "100", label: "Lighthouse accessibility score" },
];

export default function Home() {
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 text-[0.9375rem]">
          <a className="btn btn-ghost hidden min-h-11 px-4 sm:inline-flex" href="#how">
            How it works
          </a>
          <a className="btn btn-ghost hidden min-h-11 px-4 sm:inline-flex" href="#paypal">
            Built on PayPal
          </a>
          <a className="btn btn-ghost hidden min-h-11 px-4 md:inline-flex" href={REPO}>
            GitHub
          </a>
          <Link className="btn btn-primary min-h-11 px-5" href="/judge">
            Live demo
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 pt-10 pb-20 lg:grid-cols-[1.15fr_1fr]">
          <div className="rise">
            <p className="pill pill-brand mb-6">
              <Icon name="shieldCheck" className="size-4" />
              PayPal + AI · scam protection for older adults
            </p>
            <h1 className="font-display text-[2.75rem] leading-[1.02] font-semibold sm:text-[4rem]">
              Fraud systems stop payments you didn&apos;t make.
              <span className="block text-brand-2">Hold On stops the ones you&apos;re tricked into making.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Scammers now clone a grandchild&apos;s voice with AI. When Rose, 78, tries to send money that looks like a scam, Hold On puts it on a real PayPal hold and asks her daughter to take a look. Nothing moves until family says yes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn btn-primary btn-lg" href="/judge">
                Try it in 60 seconds
                <Icon name="arrowRight" className="size-5" />
              </Link>
              <a className="btn btn-secondary btn-lg" href="#how">
                How it works
              </a>
            </div>
            <p className="mt-5 text-sm text-muted">No sign-up. Both phones side by side, live PayPal sandbox calls.</p>
          </div>

          <HeroVisual />
        </section>

        {/* Stats */}
        <section aria-label="By the numbers" className="border-y border-line bg-surface">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-6 py-10 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="px-2">
                <dd className="font-display text-[2.75rem] leading-none font-semibold tabular-nums">{s.value}</dd>
                <dt className="mt-2 max-w-[14rem] text-[0.9375rem] text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-6 px-6 py-24">
          <p className="eyebrow mb-3">How it works</p>
          <h2 className="font-display max-w-3xl text-[2.5rem] leading-tight font-semibold">A pause, a kind question, and a family that&apos;s there.</h2>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card p-7">
                <div className="mb-6 flex items-center justify-between">
                  <span className="icon-badge size-12 bg-brand text-brand-ink">
                    <Icon name={s.icon} className="size-6" />
                  </span>
                  <span className="font-display text-4xl text-line-strong">0{i + 1}</span>
                </div>
                <h3 className="mb-2 text-xl font-bold">{s.title}</h3>
                <p className="leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Money path */}
        <section id="paypal" className="scroll-mt-6 bg-[#10131b] text-[#eef0f5]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <p className="eyebrow mb-3 text-[#a9afbd]">Built on real PayPal</p>
            <h2 className="font-display max-w-3xl text-[2.5rem] leading-tight font-semibold">The hold is a PayPal authorization, so &ldquo;blocked&rdquo; means the money never moved.</h2>

            <div className="mt-12 grid items-center gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <Node title="Rose taps Send" body="Rules + Gemini check it. Known payee? It just goes." />
              <Arrow />
              <Node title="Authorization · held" body="Orders v2 with her vaulted PayPal. Up to 72 hours." accent />
              <Arrow />
              <div className="grid gap-3">
                <Node title="Maya blocks → Void" body="Payments v2 void. Money never left." tone="safe" />
                <Node title="Maya releases → Capture + Payout" body="To a PayPal email or a Venmo phone." />
              </div>
            </div>

            <ul className="mt-14 grid gap-px overflow-hidden rounded-[1.25rem] border border-[#232838] bg-[#232838] sm:grid-cols-2 lg:grid-cols-3">
              {APIS.map((a) => (
                <li key={a.name} className="bg-[#10131b] p-6">
                  <p className="mb-1.5 font-mono text-sm font-bold text-[#9db8ff]">{a.name}</p>
                  <p className="text-[0.9375rem] leading-relaxed text-[#c3c8d4]">{a.use}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Design principles */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <p className="eyebrow mb-3">Designed to be trusted</p>
          <h2 className="font-display max-w-3xl text-[2.5rem] leading-tight font-semibold">Safe enough to put between an older adult and her money.</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <Principle icon="shield" title="AI can only raise risk">
              Rose&apos;s rules set a floor. Gemini adds judgment on top, but a coached victim or a prompt hidden in a pasted message can&apos;t talk a payment through. If the AI is slow or down, the rules decide alone.
            </Principle>
            <Principle icon="bot" title="Agent Guard">
              AI agents will soon shop for people like Rose. Hold On is also an MCP server: agents pay through it and get the same hold-and-check. In our demo, a shopping agent tricked by hidden page text is stopped.
            </Principle>
            <Principle icon="ear" title="Built for 78, not 28">
              Atkinson Hyperlegible type, 20px+ text, 7:1 contrast, voice in and out, no time pressure, and Lighthouse accessibility 100 on every page. Rose keeps her independence; Maya can stop a payment but never move her money.
            </Principle>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="relative overflow-hidden rounded-[2rem] bg-brand px-8 py-14 text-brand-ink sm:px-14">
            <h2 className="font-display max-w-2xl text-[2.25rem] leading-tight font-semibold">See it stop the grandparent scam, start to finish.</h2>
            <p className="mt-3 max-w-xl opacity-85">Five scenarios, two phones, one PayPal ledger. About a minute each.</p>
            <Link className="btn btn-lg mt-8 bg-brand-ink text-brand" href="/judge">
              Open Judge Mode
              <Icon name="arrowRight" className="size-5" />
            </Link>
            <LogoMark className="pointer-events-none absolute -right-10 -bottom-12 size-64 opacity-10" />
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted">
          <Logo />
          <p>Built for the PayPal AI Hackathon · MIT licensed · Sandbox only, no real money.</p>
          <div className="flex gap-4">
            <Link className="underline underline-offset-4" href="/rose">
              Rose&apos;s app
            </Link>
            <Link className="underline underline-offset-4" href="/maya">
              Maya&apos;s app
            </Link>
            <a className="underline underline-offset-4" href={REPO}>
              Source
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Node({ title, body, accent, tone }: { title: string; body: string; accent?: boolean; tone?: "safe" }) {
  return (
    <div
      className={`rounded-[1.25rem] border p-5 ${accent ? "border-[#e7a948]/50 bg-[#2a1f0c]" : tone === "safe" ? "border-[#7fe0a8]/40 bg-[#0f2a1c]" : "border-[#232838] bg-[#161a24]"}`}
    >
      <p className={`font-bold ${accent ? "text-[#ffc46f]" : tone === "safe" ? "text-[#7fe0a8]" : "text-white"}`}>{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-[#b7bdc9]">{body}</p>
    </div>
  );
}

function Arrow() {
  return (
    <span aria-hidden="true" className="mx-auto text-[#5c6478]">
      <Icon name="arrowRight" className="size-6 rotate-90 md:rotate-0" />
    </span>
  );
}

function Principle({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-7">
      <span className="icon-badge pill-brand mb-5 size-12">
        <Icon name={icon} className="size-6" />
      </span>
      <h3 className="mb-2 text-xl font-bold">{title}</h3>
      <p className="leading-relaxed text-muted">{children}</p>
    </div>
  );
}

/** A static phone showing the hold screen, with Maya's notification floating over it. */
function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[24rem] py-6" aria-hidden="true">
      <div className="absolute inset-x-6 top-14 bottom-0 -z-10 rounded-[3rem] bg-brand-soft blur-2xl" />
      <div className="rounded-[2.75rem] bg-[#0b0d12] p-3 shadow-lg">
        <div className="overflow-hidden rounded-[2.2rem] bg-bg px-6 pt-10 pb-8">
          <div className="mb-8 flex items-center justify-between">
            <Logo />
            <span className="pill pill-safe">Protected</span>
          </div>
          <div className="text-center">
            <span className="icon-badge pill-warn mx-auto mb-4 size-20">
              <Icon name="shieldCheck" className="size-10" strokeWidth={1.75} />
            </span>
            <p className="text-2xl font-bold">Your money is safe</p>
            <p className="mt-3 text-[2.25rem] leading-none font-bold">$2,400.00</p>
            <p className="mt-2 text-sm text-muted">is on hold. Nothing has been sent.</p>
          </div>
          <ul className="card mt-6 grid gap-3 py-4 text-sm">
            {["Checked by Hold On", "Held safely on your PayPal"].map((t) => (
              <li key={t} className="flex items-center gap-3 font-bold">
                <span className="icon-badge size-6 bg-safe text-surface">
                  <Icon name="check" className="size-3.5" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
            <li className="flex items-center gap-3 font-bold">
              <span className="icon-badge size-6 bg-warn text-surface">
                <Icon name="clock" className="size-3.5" strokeWidth={2.5} />
              </span>
              Maya is taking a look
            </li>
          </ul>
          <div className="btn btn-primary btn-block mt-5 min-h-12 text-base">
            <Icon name="phone" className="size-4" />
            Call Maya
          </div>
        </div>
      </div>

      <div className="absolute -bottom-6 -left-4 w-[17rem] rounded-2xl sm:-left-24 border border-line bg-surface/95 p-4 shadow-lg backdrop-blur sm:-right-14">
        <div className="mb-1.5 flex items-center gap-2 text-xs text-muted">
          <span className="icon-badge size-5 bg-warn text-surface">
            <Icon name="bell" className="size-3" strokeWidth={2.5} />
          </span>
          Hold On · now
        </div>
        <p className="text-sm font-bold">Rose needs you ($2,400.00)</p>
        <p className="mt-0.5 text-xs leading-snug text-muted">New Venmo contact asking for bail money, and to keep it secret from you.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
          <span className="rounded-lg bg-danger py-2 text-center text-surface">Block it</span>
          <span className="rounded-lg border border-line-strong py-2 text-center">Release</span>
        </div>
      </div>
    </div>
  );
}
