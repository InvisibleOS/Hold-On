import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 text-[1.25rem]">
      <p className="font-bold text-brand">Hold On</p>
      <h1 className="mb-4 text-4xl font-bold leading-tight">Fraud systems stop payments you didn&apos;t make. Hold On protects the ones you&apos;re tricked into making.</h1>
      <p className="mb-4">
        Scammers now use AI to sound exactly like a grandchild in trouble. When Rose, 78, tries to send money that looks like a scam, Hold On uses PayPal
        to <strong>hold</strong> it instead of sending it. Her money stays in her account while her daughter Maya takes a look — and Rose chose those rules
        herself, while calm.
      </p>
      <ul className="mb-8 grid list-disc gap-1 pl-6">
        <li>The hold is a real PayPal authorization: void it and nothing ever moved.</li>
        <li>An AI guardian asks gentle questions like a kind bank teller, in Rose&apos;s language, by voice or by tap.</li>
        <li>Rose&apos;s own rules set a floor the AI can never talk down.</li>
      </ul>
      <div className="flex flex-wrap gap-3">
        <Link className="btn btn-primary text-2xl" href="/judge">
          Try Judge Mode
        </Link>
        <Link className="btn btn-secondary" href="/rose">
          Rose&apos;s app
        </Link>
        <Link className="btn btn-secondary" href="/maya">
          Maya&apos;s app
        </Link>
      </div>
    </main>
  );
}
