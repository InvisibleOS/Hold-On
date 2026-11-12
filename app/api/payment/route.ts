import { z } from "zod";
import { answer, release, stop, sweep, trustPayee } from "@/lib/flow.ts";
import { fail, handle, view } from "@/lib/http.ts";
import { getHousehold } from "@/lib/store.ts";

const Body = z.object({
  h: z.string(),
  id: z.string(),
  action: z.enum(["answer", "release", "block", "cancel", "skip_time"]),
  text: z.string().trim().min(1).max(500).optional(),
  trust: z.boolean().optional(), // release only: trust this person from now on
});

// Note: the household link is the only credential (fine for a sandbox demo).
// Real users would sign in, and only Maya's session could release or block.
export async function POST(req: Request) {
  return handle(async () => {
    const b = Body.parse(await req.json());
    const h = getHousehold(b.h);
    const p = h.payments.find((x) => x.id === b.id);
    if (!p) return fail("Payment not found", 404);

    if (b.action === "answer") {
      if (!b.text) return fail("Answer is empty");
      await answer(h, p, b.text);
    } else if (b.action === "release") {
      await release(h, p, "maya");
      if (b.trust) trustPayee(h, p);
    }
    else if (b.action === "block") await stop(h, p, "maya");
    else if (b.action === "cancel") await stop(h, p, "rose");
    else {
      // Judge Mode: jump to the end of the hold to show Rose's timeout rule.
      if (p.status !== "held") return fail("Only a held payment can skip ahead", 409);
      p.holdUntil = Date.now() - 1;
      await sweep(h);
    }
    return view(h);
  });
}
