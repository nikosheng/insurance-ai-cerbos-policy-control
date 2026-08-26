import { NextRequest } from "next/server";
import { createAzure } from "@ai-sdk/azure";
import { streamText, convertToCoreMessages, StreamData, type JSONValue, tool } from "ai";
import { jsonSchema } from "ai";
import { getSessionFromRequest } from "@/lib/session";
import { createCerbosWrappedTools, DATA_TOOL_NAMES } from "@/mcp/mcpServer";
import { embedText } from "@/lib/voyage";
import { VECTOR_INDEX_NAME, CHAT_SESSIONS_COLLECTION } from "@/lib/chatSessions";
import type { AgentSession, McpToolResult, SessionSearchResult } from "@/types";

// ─── Azure OpenAI Client ───────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const azureProvider = createAzure({
  resourceName: process.env.AZURE_OPENAI_RESOURCE_NAME!,
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  apiVersion: "2025-03-01-preview",
}) as unknown as { chat: (deployment: string) => Parameters<typeof streamText>[0]["model"] };

const MODEL = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5.6-sol";

// ─── Session Search Tool Result shape ────────────────────────────────────────
export interface SessionSearchToolResult {
  results: SessionSearchResult[];
  total: number;
  query: string;
  security_filter: Record<string, string>;
}

// ─── System Prompt Builder ────────────────────────────────────────────────────
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
- find: Query CURRENT insurance policy documents with a MongoDB filter. Best for fetching live policy records.
- aggregate: Run a pipeline for grouping, statistics, and complex transformations on CURRENT policy data.
- count: Count matching CURRENT policy documents without fetching them. Best for "how many" questions.
- collection_schema: Inspect field names and types before querying.
- collection_indexes: List collection indexes for query planning.
- search_sessions: Semantic search over PAST CUSTOMER SERVICE CHAT SESSIONS.
  Use this for questions about previous conversations, historical issues, or follow-up actions.
  The server handles embedding — you only provide a natural language query string.
  Examples of when to use search_sessions (NOT find/aggregate):
    "What did I discuss with Alice last time?"       → search_sessions(query="Alice Johnson conversation")
    "Any sessions about claim disputes?"             → search_sessions(query="claim dispute escalation")
    "Show me pending follow-up actions"              → search_sessions(query="pending follow-up actions")
    "Past conversations about policy renewals"       → search_sessions(query="policy renewal")
    "Which customers asked about deductibles?"       → search_sessions(query="deductible question")
    "Did I have any sessions with home insurance issues?" → search_sessions(query="home insurance issue")

CHOOSING THE RIGHT TOOL:
- Question about a current policy record → find / aggregate / count
- Question about a past conversation or follow-up → search_sessions
- "Show me Alice's policy"     → find (current data)
- "What did I talk to Alice about?" → search_sessions (past session)
- "How many active auto policies?"  → count (current data)
- "Any past sessions about auto claims?" → search_sessions (past sessions)

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
- search_sessions is also Cerbos-secured: you can only search sessions within your authorized scope.

RESPONSE FORMAT:
- Use markdown tables for multi-record summaries.
- If a query returns 0 results, state that clearly — do not speculate.
- Summarize coverage amounts, premiums, status, and dates concisely.
- For search_sessions results: present each session as a clear summary with customer name,
  date, what was discussed, and any follow-up actions still pending.`;
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

  // ── Step 3: Build Cerbos-wrapped MCP tool registry ───────────────────────
  const { _mcpClient, _connectionId, ...mcpTools } = await createCerbosWrappedTools(session);

  // ── Step 4: Build search_sessions tool ───────────────────────────────────
  // This tool lives in the chat route (not mcpServer.ts) because it needs:
  //   a) The Voyage API to embed the query (LLM cannot do this)
  //   b) The existing MCP connection (_connectionId) to call aggregate on chat_sessions
  //   c) The session (httpOnly cookie) to derive the Cerbos security filter
  //
  // The LLM supplies only a natural language query string.
  // Everything else (embedding, security filter, collection routing) is server-side.
  const db = process.env.MONGODB_DB_NAME || "insurance_cerbos_ai";

  // Helper to call the real MCP aggregate tool on the chat_sessions collection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function callMcpAggregate(pipeline: unknown[]): Promise<any> {
    const tools = await _mcpClient.tools() as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const aggregateTool = tools["aggregate"];
    if (!aggregateTool) throw new Error("aggregate tool not found in MCP server");
    return aggregateTool.execute(
      {
        connectionId: _connectionId,
        database: db,
        collection: CHAT_SESSIONS_COLLECTION,
        pipeline,
      },
      { abortSignal: undefined }
    );
  }

  // Parse results from MCP aggregate response (same wrapper pattern as mcpServer.ts)
  const OPENING_TAG_RE = /<untrusted-user-data-([a-f0-9-]+)>/g;
  function parseMcpAggregate(content: Array<{ type: string; text?: string }>): SessionSearchResult[] {
    const docs: SessionSearchResult[] = [];
    for (const block of content) {
      if (block.type !== "text" || !block.text) continue;
      const text = block.text;
      let dataTagMatch: RegExpExecArray | null = null;
      let m: RegExpExecArray | null;
      const re = new RegExp(OPENING_TAG_RE.source, "g");
      while ((m = re.exec(text)) !== null) {
        const after = text.slice(m.index + m[0].length).trimStart();
        if (after.startsWith("[") || after.startsWith("{")) { dataTagMatch = m; break; }
      }
      if (dataTagMatch) {
        const startIdx = dataTagMatch.index + dataTagMatch[0].length;
        const closingTag = `</untrusted-user-data-${dataTagMatch[1]}>`;
        const closingIdx = text.indexOf(closingTag, startIdx);
        const jsonStr = (closingIdx >= 0 ? text.slice(startIdx, closingIdx) : text.slice(startIdx)).trim();
        if (!jsonStr.startsWith("[") && !jsonStr.startsWith("{")) continue;
        try {
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed)) docs.push(...parsed as SessionSearchResult[]);
          else if (parsed && typeof parsed === "object") docs.push(parsed as SessionSearchResult);
        } catch { /* skip */ }
      } else {
        const trimmed = text.trim();
        if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) docs.push(...parsed as SessionSearchResult[]);
          else if (parsed && typeof parsed === "object") docs.push(parsed as SessionSearchResult);
        } catch { /* skip */ }
      }
    }
    return docs;
  }

  const isAdmin = session.roles.includes("tenant_admin");
  // Cerbos security filter — mirrors chat-session/search/route.ts exactly
  const sessionSecurityFilter: Record<string, string> = {
    tenant_id: session.tenantId,
    ...(isAdmin ? {} : { agent_id: session.id }),
  };

  const searchSessionsTool = tool({
    description: `Semantic search over past customer service chat sessions.
Use this when the agent asks about PREVIOUS CONVERSATIONS, PAST ISSUES, or FOLLOW-UP ACTIONS
from prior customer interactions — NOT for current live policy data (use find/aggregate/count for that).

The server handles embedding automatically — only provide a natural language query string.
Results are Cerbos-secured to your authorized scope.

Examples of queries that should use this tool:
  "What did I discuss with Alice last time?"
  "Any sessions with claim disputes?"
  "Show me pending follow-up actions"
  "Past conversations about policy renewals"
  "Which customers asked about deductibles?"`,

    parameters: jsonSchema<{ query: string; limit: number }>({
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language search query describing the past sessions to find.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return. Use 5 unless the user asks for more.",
        },
      },
      required: ["query", "limit"],
      additionalProperties: false,
    }),

    execute: async ({ query, limit }): Promise<SessionSearchToolResult> => {
      const safeLimit = Math.min(Math.max(limit ?? 5, 1), 10);

      console.log(`\n${"═".repeat(60)}`);
      console.log(`[Tool: search_sessions] Session: ${session.id} @ ${session.tenantId}`);
      console.log(`[Tool: search_sessions] Query: "${query}" | limit: ${safeLimit}`);
      console.log(`[Tool: search_sessions] Security filter: ${JSON.stringify(sessionSecurityFilter)}`);

      // Step 1: Embed the query with Voyage AI (server-side — LLM cannot do this)
      let queryVector: number[];
      try {
        queryVector = await embedText(query, "query");
        console.log(`[Tool: search_sessions] Embedded query → ${queryVector.length} dims`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Tool: search_sessions] Voyage embedding failed: ${msg}`);
        return { results: [], total: 0, query, security_filter: sessionSecurityFilter };
      }

      // Step 2: Build $vectorSearch pipeline
      // - $vectorSearch must be first stage (per MCP aggregate tool docs)
      // - filter uses Cerbos-derived security boundary (tenant_id + agent_id)
      // - $unset at end is mandatory per mongodb-mcp-server docs to avoid context bloat
      const pipeline = [
        {
          $vectorSearch: {
            index: VECTOR_INDEX_NAME,
            path: "embedding",
            queryVector,                                    // real float array from Voyage
            numCandidates: Math.max(safeLimit * 20, 100),
            limit: safeLimit,
            filter: sessionSecurityFilter,                 // Cerbos boundary inside ANN scan
          },
        },
        {
          $addFields: { score: { $meta: "vectorSearchScore" } },
        },
        {
          // Remove heavy fields — embedding binary + raw transcript never sent to LLM
          $unset: ["embedding", "raw_transcript"],
        },
      ];

      // Step 3: Call MCP aggregate tool with the chat_sessions collection
      let results: SessionSearchResult[] = [];
      try {
        const mcpResult = await callMcpAggregate(pipeline);
        results = parseMcpAggregate(mcpResult.content ?? []);
        console.log(`[Tool: search_sessions] Returned ${results.length} session(s)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Tool: search_sessions] MCP aggregate failed: ${msg}`);
        // Return empty results rather than crashing the chat stream
        return { results: [], total: 0, query, security_filter: sessionSecurityFilter };
      }

      console.log(`${"═".repeat(60)}\n`);

      return {
        results,
        total: results.length,
        query,
        security_filter: sessionSecurityFilter,
      };
    },
  });

  // ── Step 5: Merge all tools ───────────────────────────────────────────────
  const allTools = {
    ...mcpTools,
    search_sessions: searchSessionsTool,
  };

  // ── Step 6: StreamData for telemetry annotations ──────────────────────────
  const streamData = new StreamData();

  // ── Step 7: Stream the AI response ───────────────────────────────────────
  const result = await streamText({
    model: azureProvider.chat(MODEL),
    system: buildSystemPrompt(session),
    messages: convertToCoreMessages(body.messages as Parameters<typeof convertToCoreMessages>[0]),
    tools: allTools,
    maxSteps: 8,
    temperature: 0.1,
    onStepFinish: async ({ toolResults }) => {
      if (!toolResults?.length) return;
      for (const tr of toolResults) {
        // Stream SecurityContext for MCP data tools (find/aggregate/count)
        if (DATA_TOOL_NAMES.has(tr.toolName)) {
          const toolResult = tr.result as McpToolResult;
          if (!toolResult?.security_context) continue;
          const annotation = JSON.parse(
            JSON.stringify({ type: "security_context", payload: toolResult.security_context })
          ) as JSONValue;
          streamData.append(annotation);
        }
        // Stream session search results as a separate annotation type
        if (tr.toolName === "search_sessions") {
          const toolResult = tr.result as SessionSearchToolResult;
          if (!toolResult) continue;
          const annotation = JSON.parse(
            JSON.stringify({ type: "session_search_result", payload: toolResult })
          ) as JSONValue;
          streamData.append(annotation);
        }
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

  // ── Step 8: Return stream + data annotations ──────────────────────────────
  return result.toDataStreamResponse({ data: streamData });
}
