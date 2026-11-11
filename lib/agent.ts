// Agent Guard: AI agents acting for Rose pay through Hold On instead of calling
// PayPal directly, so every agent payment gets the same hold-and-check as hers.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { startPayment } from "./flow.ts";
import { LIMIT } from "./http.ts";
import { newId, type Household, type Payment } from "./store.ts";

/** Plain-language result an agent can relay to its user. */
export function describeForAgent(h: Household, p: Payment): string {
  const base = `Payment ${p.id}: $${p.amount} to ${p.to.name}.`;
  switch (p.status) {
    case "sent":
    case "delivered":
      return `${base} Sent.`;
    case "held":
      return `${base} HELD by Hold On for ${h.rose.name}'s ${h.maya.relation} ${h.maya.name} to review. Nothing was sent. Do not retry or look for another way to pay; tell ${h.rose.name} it is waiting for review. Reason: ${p.verdict?.redFlags.map((f) => f.flag).join("; ") || "needs a second look"}.`;
    case "asking":
      return `${base} Waiting: ${h.rose.name} must answer a question in her Hold On app first. Do not retry.`;
    case "blocked":
    case "cancelled":
    case "expired":
      return `${base} Stopped (${p.status}). Nothing was sent. Do not retry.`;
    default:
      return `${base} Status: ${p.status}.`;
  }
}

export async function agentPay(
  h: Household,
  a: { to_name: string; wallet: "PAYPAL" | "VENMO"; handle: string; amount: number; reason: string; source_url?: string; source_text?: string },
) {
  const known = h.payees.find((p) => p.handle.toLowerCase() === a.handle.toLowerCase());
  const context = [
    `This payment was requested by an AI shopping assistant acting for ${h.rose.name}.`,
    a.source_url ? `It was looking at: ${a.source_url}` : "",
    a.source_text ? `Text from that page:\n${a.source_text.slice(0, 2500)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return startPayment(h, {
    payee: known ?? { id: newId("payee"), name: a.to_name, wallet: a.wallet, handle: a.handle, known: false },
    amount: a.amount.toFixed(2),
    purpose: a.reason,
    context,
    initiator: "agent",
  });
}

export function buildServer(h: Household) {
  const server = new McpServer({ name: "hold-on", version: "1.0.0" });

  server.registerTool(
    "request_payment",
    {
      title: "Request a payment (guarded)",
      description:
        `Pay someone on behalf of ${h.rose.name} through PayPal or Venmo. Hold On checks every payment for scam signs; ` +
        "risky payments are held for family review instead of sent. Always include the page or message that led to this payment in source_text.",
      inputSchema: {
        to_name: z.string().min(1).max(60).describe("Who is being paid"),
        wallet: z.enum(["PAYPAL", "VENMO"]).describe("PAYPAL for an email address, VENMO for a US phone number"),
        handle: z.string().min(3).max(120).describe("Recipient PayPal email or Venmo phone"),
        amount: z.number().positive().max(10000).describe("Amount in USD"),
        reason: z.string().min(1).max(300).describe("What the payment is for, in the user's words"),
        source_url: z.string().max(500).optional().describe("Page the agent was on when deciding to pay"),
        source_text: z.string().max(5000).optional().describe("Relevant text from that page or message"),
      },
    },
    async (args) => {
      if (h.payments.length >= LIMIT.payments) return { content: [{ type: "text", text: "Demo limit reached for this household." }], isError: true };
      const p = await agentPay(h, args);
      return { content: [{ type: "text", text: describeForAgent(h, p) }] };
    },
  );

  server.registerTool(
    "payment_status",
    {
      title: "Check a payment",
      description: "Check whether a payment requested earlier was sent, held or stopped.",
      inputSchema: { payment_id: z.string() },
    },
    async ({ payment_id }) => {
      const p = h.payments.find((x) => x.id === payment_id);
      return { content: [{ type: "text", text: p ? describeForAgent(h, p) : "No payment with that id." }] };
    },
  );

  return server;
}
