import { z } from "zod";
import { startPayment } from "@/lib/flow.ts";
import { fail, handle, LIMIT, view } from "@/lib/http.ts";
import { getHousehold, newId } from "@/lib/store.ts";

const Body = z.object({
  h: z.string(),
  payeeId: z.string().optional(),
  newPayee: z
    .object({
      name: z.string().trim().min(1).max(60),
      wallet: z.enum(["PAYPAL", "VENMO"]),
      handle: z.string().trim().min(3).max(120),
    })
    .optional(),
  amount: z.string().regex(/^\d{1,5}(\.\d{1,2})?$/, "Enter an amount like 25 or 25.50"),
  purpose: z.string().trim().min(1).max(300),
  context: z.string().max(3000).optional(),
  initiator: z.enum(["rose", "agent"]).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const b = Body.parse(await req.json());
    const h = getHousehold(b.h);
    if (h.payments.length >= LIMIT.payments) return fail("Demo limit reached — open a fresh demo link", 429);
    const amount = Number(b.amount);
    if (!(amount >= 1 && amount <= 10_000)) return fail("Amount must be between $1 and $10,000");

    let payee = b.payeeId ? h.payees.find((p) => p.id === b.payeeId) : undefined;
    if (!payee && h.draft?.payee.id === b.payeeId) payee = h.draft?.payee;
    if (!payee && b.newPayee) payee = { id: newId("payee"), ...b.newPayee, known: false };
    if (!payee) return fail("Choose who to pay");

    await startPayment(h, { payee, amount: amount.toFixed(2), purpose: b.purpose, context: b.context, initiator: b.initiator });
    return view(h);
  });
}
