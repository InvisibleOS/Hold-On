import { z } from "zod";
import { fail, handle, LIMIT, view } from "@/lib/http.ts";
import { runScenario, SCENARIOS, type ScenarioName } from "@/lib/scenarios.ts";
import { getHousehold } from "@/lib/store.ts";

const Body = z.object({ h: z.string(), name: z.enum(Object.keys(SCENARIOS) as [ScenarioName, ...ScenarioName[]]) });

export async function POST(req: Request) {
  return handle(async () => {
    const b = Body.parse(await req.json());
    const h = getHousehold(b.h);
    if (h.scenariosRun >= LIMIT.scenarios) return fail("Demo limit reached — open a fresh demo link", 429);
    await runScenario(h, b.name);
    return view(h);
  });
}
