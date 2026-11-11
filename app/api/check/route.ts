import { z } from "zod";
import { checkItem } from "@/lib/guardian.ts";
import { fail, handle, LIMIT, view } from "@/lib/http.ts";
import { getHousehold, log, newId } from "@/lib/store.ts";

const Body = z.object({
  h: z.string(),
  text: z.string().max(5000).optional(),
  imageBase64: z.string().max(7_000_000).optional(), // ~5 MB photo
  mediaType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const b = Body.parse(await req.json());
    if (!b.text?.trim() && !b.imageBase64) return fail("Paste a message or add a photo");
    const h = getHousehold(b.h);
    if (h.checks.length >= LIMIT.checks) return fail("Demo limit reached — open a fresh demo link", 429);
    const verdict = await checkItem(b);
    h.checks.unshift({ id: newId("chk"), at: Date.now(), input: b.imageBase64 ? "photo" : b.text!.slice(0, 300), verdict });
    log(h, "guardian", `"Is this real?" → ${verdict.level.toUpperCase()} (${verdict.source})`);
    return view(h);
  });
}
