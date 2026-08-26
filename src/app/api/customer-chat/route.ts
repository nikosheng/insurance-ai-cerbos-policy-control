// ─── POST /api/customer-chat ──────────────────────────────────────────────────
// Customer-facing AI chat endpoint.
//
// Key differences from /api/chat (agent endpoint):
//   - Reads CustomerSession cookie (not AgentSession)
//   - Uses createCerbosWrappedToolsForCustomer → Cerbos role "customer"
//     → security filter = { tenant_id, client_name } (not agent_id)
//   - AI persona = the customer's assigned agent (e.g. "Sarah Chen")
//   - System prompt is customer-facing: empathetic, plain language, no MQL jargon
//   - No telemetry annotations streamed (no analytics panel in customer UI)

import { NextRequest } from "next/server";
import { createAzure } from "@ai-sdk/azure";
import { streamText, convertToCoreMessages, type JSONValue, StreamData } from "ai";
import { getCustomerSessionFromRequest } from "@/lib/session";
import { createCerbosWrappedToolsForCustomer, DATA_TOOL_NAMES } from "@/mcp/mcpServer";
import type { CustomerSession, McpToolResult } from "@/types";

// ─── Azure provider ───────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const azureProvider = createAzure({
  resourceName: process.env.AZURE_OPENAI_RESOURCE_NAME!,
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  apiVersion: "2025-03-01-preview",
}) as unknown as { chat: (deployment: string) => Parameters<typeof streamText>[0]["model"] };

const MODEL = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5.6-luna";

// ─── Customer system prompt ───────────────────────────────────────────────────
// The AI speaks as the customer's assigned agent. Tone is warm and helpful.
// No internal field names or MQL are mentioned. Cerbos ensures the customer
// can only ever see their own policy data regardless of what the AI generates.

function buildCustomerSystemPrompt(session: CustomerSession): string {
  return `You are ${session.agentName}, a friendly and knowledgeable insurance agent at SecureInsure Corp.
You are currently in a live chat session with your client, ${session.clientName}.

YOUR ROLE:
- Greet ${session.clientName} warmly and help them with any questions about their insurance policies.
- When they ask about their coverage, premiums, deductible, policy status, or renewal dates,
  use the available tools to look up their policy information from the system.
- Explain policy details in plain, clear language — no jargon or technical field names.
- If they ask about claims, escalate procedures, or anything not in the policy data,
  let them know you'll follow up or connect them to the right team.
- Keep responses concise and friendly. Use bullet points for policy details.

TOOLS AVAILABLE AND HOW TO USE THEM:
Always call collection_schema before calling find or count, to verify the exact
field names. Do not reveal internal field names to the customer in your response.

- collection_schema: Call this first before any data lookup to confirm field names.
  Known fields (verify before use):
    policy_type      — "Auto" | "Home" | "Life"
    status           — "Active" | "Pending" | "Cancelled" | "Expired"
    coverage_amount  — numeric dollars
    premium_monthly  — numeric monthly dollars
    deductible       — numeric dollars
    start_date       — ISO date "YYYY-MM-DD"
    end_date         — ISO date "YYYY-MM-DD"
    notes            — free text

- find: Look up the customer's policy records. ALWAYS call collection_schema first.
  Use filter '{}' to get all their policies, or filter by policy_type/status/dates.
  NEVER include client_name, tenant_id, or agent_id in filters — enforced automatically.

- count: Count how many policies they have. ALWAYS call collection_schema first.

IMPORTANT SECURITY:
- The customer can ONLY see their own policies — the system guarantees this.
- DO NOT reveal internal field names (client_name, tenant_id, agent_id) to the customer.

TONE:
- Warm, professional, and reassuring.
- Address the customer by their first name: ${session.clientName.split(" ")[0]}.
- If they seem worried about a policy status (e.g. Expired/Cancelled), be empathetic
  and explain next steps clearly.

The customer's assigned policy is under your management as ${session.agentName}.
Start by greeting them and asking how you can help today if this is the start of the conversation.`;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Auth: read customer session from httpOnly cookie ───────────────────
  const session = getCustomerSessionFromRequest(req);
  if (!session) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: No customer session. Please log in at /customer." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── 2. Parse messages ─────────────────────────────────────────────────────
  let body: { messages: unknown[] };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── 3. Build Cerbos-wrapped tools for customer role ───────────────────────
  const { _mcpClient, _connectionId, ...wrappedTools } =
    await createCerbosWrappedToolsForCustomer(session);

  // ── 4. Stream with customer persona system prompt ─────────────────────────
  // StreamData is still used so the client can receive security annotations
  // for optional display (customer chat page doesn't show the panel, but the
  // hook still expects a data stream compatible response).
  const streamData = new StreamData();

  const result = await streamText({
    model: azureProvider.chat(MODEL),
    system: buildCustomerSystemPrompt(session),
    messages: convertToCoreMessages(
      body.messages as Parameters<typeof convertToCoreMessages>[0]
    ),
    tools: wrappedTools,
    maxSteps: 8,
    temperature: 0.2,
    onStepFinish: async ({ toolResults }) => {
      // Stream security context annotations (same as agent flow)
      // Customer chat page doesn't display these but the protocol still sends them.
      if (!toolResults?.length) return;
      for (const tr of toolResults) {
        if (!DATA_TOOL_NAMES.has(tr.toolName)) continue;
        const toolResult = tr.result as McpToolResult;
        if (!toolResult?.security_context) continue;
        const annotation = JSON.parse(
          JSON.stringify({ type: "security_context", payload: toolResult.security_context })
        ) as JSONValue;
        streamData.append(annotation);
      }
    },
    onFinish: () => {
      void (async () => {
        try {
          if (_connectionId && _connectionId !== "preconfigured") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tools = await (_mcpClient as any).tools?.();
            if (tools?.disconnect) {
              await tools.disconnect.execute({ connectionId: _connectionId }, { abortSignal: undefined });
            }
          }
        } catch { /* ignore */ }
        try { await _mcpClient.close(); } catch { /* ignore */ }
        finally { streamData.close(); }
      })();
    },
  });

  return result.toDataStreamResponse({ data: streamData });
}
