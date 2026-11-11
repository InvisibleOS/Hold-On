// Maya's Block / Release buttons inside the phone notification land here.
import { release, stop } from "@/lib/flow.ts";
import { fail, handle } from "@/lib/http.ts";
import { verifyLink } from "@/lib/notify.ts";
import { findPayment } from "@/lib/store.ts";

export async function POST(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    const pid = q.get("pid") ?? "";
    const action = q.get("action") ?? "";
    if (!verifyLink(pid, action, Number(q.get("exp")), q.get("sig") ?? "")) return fail("Link expired or invalid", 403);
    const found = findPayment((p) => p.id === pid);
    if (!found) return fail("Payment not found", 404);
    if (action === "release") await release(found.h, found.p, "maya");
    else await stop(found.h, found.p, "maya");
    return Response.json({ ok: true, status: found.p.status });
  });
}
