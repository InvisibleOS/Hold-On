// Rose sets her rules while calm. Only her setup screen can change them.
import { z } from "zod";
import { handle, view } from "@/lib/http.ts";
import { getHousehold, log } from "@/lib/store.ts";

const Body = z.object({
  h: z.string(),
  rosePhone: z.string().trim().max(30).optional(),
  maya: z.object({
    name: z.string().trim().min(1).max(40),
    relation: z.string().trim().min(1).max(40),
    phone: z.string().trim().max(30).optional(),
  }),
  rules: z.object({
    newPayeeLimit: z.number().int().min(0).max(5000),
    secrecyPause: z.boolean(),
    timeoutHours: z.number().int().min(1).max(72), // PayPal's 3-day honor period
  }),
});

export async function POST(req: Request) {
  return handle(async () => {
    const b = Body.parse(await req.json());
    const h = getHousehold(b.h);
    h.maya = { ...b.maya };
    h.rose.phone = b.rosePhone || undefined;
    h.rules = b.rules;
    h.rose.rulesSignedAt = Date.now();
    log(
      h,
      "rose",
      `${h.rose.name} set her rules: check new people over $${b.rules.newPayeeLimit}, ${b.rules.secrecyPause ? "pause secrets" : "no secrecy pause"}, cancel after ${b.rules.timeoutHours} h`,
    );
    return view(h);
  });
}
