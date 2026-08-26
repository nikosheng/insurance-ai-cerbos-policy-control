import { NextRequest } from "next/server";
import { createAzure } from "@ai-sdk/azure";
import { streamText, convertToCoreMessages, StreamData, type JSONValue } from "ai";
import { getSessionFromRequest } from "@/lib/session";
import { createCerbosWrappedTools, DATA_TOOL_NAMES } from "@/mcp/mcpServer";
import type { AgentSession, McpToolResult } from "@/types";

// ─── Azure OpenAI Client ───────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const azureProvider = createAzure({
  resourceName: process.env.AZURE_OPENAI_RESOURCE_NAME!,
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  apiVersion: "2025-03-01-preview",
}) as unknown as { chat: (deployment: string) => Parameters<typeof streamText>[0]["model"] };

const MODEL = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5.6-sol";

// ─── System Prompt Builder ────────────────────────────────────────────────────
// Returns a role-tailored prompt based on the authenticated session.
//
// The key split:
//   insurance_agent — must NEVER filter by agent_id / agent_name.
//                     Their scope is fixed by Cerbos to their own policies only.
//   tenant_admin    — MAY filter by agent_name or agent_id to view a specific
//                     agent's portfolio. Cerbos still enforces the tenant boundary.
//
// This prevents the LLM from misclassifying agent_name as a forbidden identity
// field when an admin legitimately asks "show me Sarah Chen's policies".

function buildSystemPrompt(session: AgentSession): string {
  const isAdmin = session.roles.includes("tenant_admin");

  const securityRules = isAdmin
    ? `SECURITY — tenant_admin rules:
- NEVER include tenant_id in your filter. Your tenant scope (${session.tenantId}) is
  enforced automatically by Cerbos on every query — you cannot see other tenants' data.
- You MAY filter by agent_name or agent_id to view a specific agent's portfolio.
  agent_name stores the agent's full name and is the preferred field for human queries.
  Examples:
    "Show me Sarah Chen's policies"    → filter_json='{"agent_name":"Sarah Chen"}'
    "Marcus Rivera's active policies"  → filter_json='{"agent_name":"Marcus Rivera","status":"Active"}'
    "How many policies does each agent manage?" → aggregate with $group on agent_name
    "All policies in my tenant"        → filter_json='{}'
- NEVER include connectionId, database, or collection — fixed server-side.`
    : `SECURITY — insurance_agent rules:
- NEVER include tenant_id, agent_id, agent_name, or any identity field in your filter.
  Your scope is fixed by Cerbos to your own assigned policies only. Any identity field
  you add is irrelevant — the Cerbos security boundary is enforced server-side regardless.
- NEVER include connectionId, database, or collection — fixed server-side.`;

  return `You are InsureAI, a professional AI assistant for insurance ${isAdmin ? "administrators" : "agents"} at SecureInsure Corp.

${securityRules}

AVAILABLE TOOLS:
- find: Query documents with any MongoDB filter expression. Best for fetching records.
- aggregate: Run a pipeline for grouping, statistics, and complex transformations.
- count: Count matching documents without fetching them. Best for "how many" questions.
- collection_schema: Inspect field names and types before querying.
- collection_indexes: List collection indexes for query planning.

QUERY STRATEGY — filter/query/pipeline must be passed as JSON STRINGS:
- "show me policies expiring before 2027"      → find  filter_json='{"end_date":{"$lt":"2027-01-01"}}'
- "how many active auto policies?"             → count  query_json='{"status":"Active","policy_type":"Auto"}'
- "average premium by policy type"            → aggregate  pipeline_json='[{"$group":{"_id":"$policy_type","avg":{"$avg":"$premium_monthly"}}}]'
- "policies with coverage over $200k"         → find  filter_json='{"coverage_amount":{"$gt":200000}}'
- "all policies" (no extra filter)            → find  filter_json='{}'
- Always use ISO date strings YYYY-MM-DD for date comparisons.
- Use collection_schema if you are unsure of available field names.

ROLE-BASED SCOPE:
- Your current role: ${session.roles.join(", ")}
- Your tenant: ${session.tenantId}
- Cerbos enforces your authorized scope on every query. You will never see data outside it.

RESPONSE FORMAT:
- Use markdown tables for multi-record summaries.
- If a query returns 0 results, state that clearly — do not speculate.
- Summarize coverage amounts, premiums, status, and dates concisely.`;
}

// ─── POST /api/chat ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Step 1: Extract session from httpOnly cookie ──────────────────────────
  const session = getSessionFromRequest(req);
  if (!session) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: No valid session. Please log in." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Step 2: Parse request body ────────────────────────────────────────────
  let body: { messages: unknown[] };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Step 3: Build Cerbos-wrapped tool registry ────────────────────────────
  const { _mcpClient, _connectionId, ...wrappedTools } = await createCerbosWrappedTools(session);

  // ── Step 4: StreamData for telemetry annotations ──────────────────────────
  const streamData = new StreamData();

  // ── Step 5: Stream the AI response with role-tailored system prompt ───────
  const result = await streamText({
    model: azureProvider.chat(MODEL),
    system: buildSystemPrompt(session),
    messages: convertToCoreMessages(body.messages as Parameters<typeof convertToCoreMessages>[0]),
    tools: wrappedTools,
    maxSteps: 8,
    temperature: 0.1,
    onStepFinish: async ({ toolResults }) => {
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
    onFinish: async () => {
      try {
        if (_connectionId && _connectionId !== "preconfigured") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tools = await (_mcpClient as any).tools?.();
          if (tools?.disconnect) {
            await tools.disconnect.execute({ connectionId: _connectionId }, { abortSignal: undefined });
          }
        }
      } catch { /* ignore disconnect errors */ }
      try { await _mcpClient.close(); } catch { /* ignore close errors */ }
      streamData.close();
    },
  });

  // ── Step 6: Return stream + data annotations ──────────────────────────────
  return result.toDataStreamResponse({ data: streamData });
}
