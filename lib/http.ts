import { z } from "zod";
import { FlowError, paypalMode } from "./flow.ts";
import type { Household } from "./store.ts";

export const fail = (error: string, status = 400) => Response.json({ error }, { status });

/** Wraps a route: bad input and invalid transitions become 400s, anything else a 500. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if ((err as { digest?: string })?.digest) throw err; // Next.js internal control flow
    if (err instanceof z.ZodError) return fail(err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    if (err instanceof FlowError) return fail(err.message, 409);
    if (err instanceof Error && err.message === "Bad household id") return fail(err.message);
    console.error(err);
    return fail("Something went wrong", 500);
  }
}

/** What the screens see: the household plus which integrations are live. */
export const view = (h: Household) =>
  Response.json({
    ...h,
    mode: paypalMode(),
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    push: Boolean(process.env.NTFY_TOPIC && process.env.PUBLIC_URL && process.env.APP_SECRET),
  });

export const LIMIT = { payments: 60, checks: 40, scenarios: 40 };
