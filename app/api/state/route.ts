import { connection } from "next/server";
import { sweep } from "@/lib/flow.ts";
import { handle, view } from "@/lib/http.ts";
import { getHousehold } from "@/lib/store.ts";

export async function GET(req: Request) {
  await connection(); // always per-request, never prerendered
  return handle(async () => {
    const h = getHousehold(new URL(req.url).searchParams.get("h") ?? "");
    await sweep(h); // Rose's timeout rule runs whenever anyone looks
    return view(h);
  });
}
