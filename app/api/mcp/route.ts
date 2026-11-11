// Agent Guard MCP endpoint (Streamable HTTP, stateless).
// Connect an agent: MCP endpoint (Streamable HTTP): <PUBLIC_URL>/api/mcp?h=<household>
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildServer } from "@/lib/agent.ts";
import { fail } from "@/lib/http.ts";
import { getHousehold } from "@/lib/store.ts";

async function handle(req: Request) {
  let h;
  try {
    h = getHousehold(new URL(req.url).searchParams.get("h") ?? "");
  } catch {
    return fail("Add ?h=<household id> to the MCP URL");
  }
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await buildServer(h).connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
