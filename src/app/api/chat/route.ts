import { NextRequest } from "next/server";
import { createAzure } from "@ai-sdk/azure";
import { streamText, convertToCoreMessages, StreamData, type JSONValue, tool } from "ai";
import { jsonSchema } from "ai";
import { getSessionFromRequest } from "@/lib/session";
import { createCerbosWrappedTools, DATA_TOOL_NAMES } from "@/mcp/mcpServer";
import { getCerbosClient, buildCerbosPrincipal, CHAT_SESSION_RESOURCE_KIND } from "@/lib/cerbos";
import { planResponseToMongoFilter } from "@/lib/ast-to-mongo";
import { embedText } from "@/lib/voyage";
import { VECTOR_INDEX_NAME, CHAT_SESSIONS_COLLECTION } from "@/lib/chatSessions";
import type { AgentSession, McpToolResult, SessionSearchResult, SecurityContext } from "@/types";

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
  security_context: SecurityContext;   // powers the analytics panel — same as MCP tools
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

═══════════════════════════════════════════════════════════════
MANDATORY FIRST STEP — SCHEMA CHECK BEFORE EVERY DATA QUERY
═══════════════════════════════════════════════════════════════
Before calling find, aggregate, or count, you MUST call collection_schema first.
No exceptions — even if you believe you know the field names.

Reason: field names in the database may differ from natural language.
For example:
  "Alice Johnson" → field is client_name  (NOT customer_name, NOT name, NOT customer)
  "auto policy"   → field is policy_type  (NOT type, NOT coverage_type)

KNOWN FIELD NAMES (always verify via collection_schema before use):
  client_name      — customer's full name (e.g. "Alice Johnson")
  policy_number    — policy ID string (e.g. "INS-2024-001")
  policy_type      — "Auto" | "Home" | "Life"
  status           — "Active" | "Pending" | "Cancelled" | "Expired"
  coverage_amount  — numeric, in dollars
  premium_monthly  — numeric, monthly premium in dollars
  deductible       — numeric, in dollars
  start_date       — ISO date string "YYYY-MM-DD"
  end_date         — ISO date string "YYYY-MM-DD"
  agent_name       — agent's full name (e.g. "Sarah Chen")
  notes            — free text notes on the policy

MANDATORY QUERY WORKFLOW for every data question:
  1. Call collection_schema          ← ALWAYS FIRST, NO EXCEPTIONS
  2. Read the field names from schema output
  3. Call find / aggregate / count   ← using the verified field names

═══════════════════════════════════════════════════════════════
AVAILABLE TOOLS
═══════════════════════════════════════════════════════════════
- collection_schema: ALWAYS call this first before any data query.
  Returns exact field names and types for the insurance_policies collection.

- collection_indexes: List indexes for query planning. Call after collection_schema
  if you need to understand which fields are indexed.

- find: Query CURRENT insurance policy documents. Use after collection_schema.
  filter_json must be a JSON string with verified field names.

- aggregate: Run a pipeline on CURRENT policy data. Use after collection_schema.
  pipeline_json must be a JSON string array.

- count: Count CURRENT policy documents. Use after collection_schema.
  query_json must be a JSON string with verified field names.

- search_sessions: Semantic search over PAST CUSTOMER SERVICE CHAT SESSIONS.
  Does NOT query insurance_policies — do NOT call collection_schema before this.
  The server handles embedding. Provide only a natural language query string.

  Use search_sessions for questions about past conversations, NOT for current data:
    "What did I discuss with Alice last time?"       → search_sessions(query="Alice Johnson conversation")
    "Any sessions about claim disputes?"             → search_sessions(query="claim dispute escalation")
    "Show me pending follow-up actions"              → search_sessions(query="pending follow-up actions")
    "Past conversations about policy renewals"       → search_sessions(query="policy renewal")
    "Which customers asked about deductibles?"       → search_sessions(query="deductible question")

═══════════════════════════════════════════════════════════════
CHOOSING THE RIGHT TOOL
═══════════════════════════════════════════════════════════════
Current policy data   → collection_schema → find / aggregate / count
Past chat sessions    → search_sessions (skip schema step)

Examples:
  "Show me Alice's policy"        → collection_schema → find(client_name: "Alice Johnson")
  "What did I talk to Alice about?" → search_sessions(query="Alice Johnson")
  "How many active auto policies?"  → collection_schema → count(status:"Active", policy_type:"Auto")
  "Any past sessions about auto claims?" → search_sessions(query="auto insurance claim")

═══════════════════════════════════════════════════════════════
QUERY SYNTAX — always pass filter/pipeline as JSON STRINGS
═══════════════════════════════════════════════════════════════
- Customer name query:  filter_json='{"client_name":"Alice Johnson"}'
- Status + type filter: filter_json='{"status":"Active","policy_type":"Auto"}'
- Date range:           filter_json='{"end_date":{"$lt":"2027-01-01"}}'
- Coverage threshold:   filter_json='{"coverage_amount":{"$gt":200000}}'
- All records:          filter_json='{}'
- Group by type:        pipeline_json='[{"$group":{"_id":"$policy_type","count":{"$sum":1}}}]'
- Always use ISO dates YYYY-MM-DD for date comparisons.

ROLE-BASED SCOPE:
- Your current role: ${session.roles.join(", ")}
- Your tenant: ${session.tenantId}
- Cerbos enforces your authorized scope on every query. You will never see data outside it.
- search_sessions is also Cerbos-secured: only sessions within your scope are returned.

RESPONSE FORMAT:
- Use markdown tables for multi-record summaries.
- If a query returns 0 results, state that clearly — do not speculate.
- Summarize coverage amounts, premiums, status, and dates concisely.
- For search_sessions results: present customer name, date, summary, and any pending follow-up actions.`;
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
      const queriedAt = new Date().toISOString();

      console.log(`\n${"═".repeat(60)}`);
      console.log(`[Tool: search_sessions] Session: ${session.id} @ ${session.tenantId}`);
      console.log(`[Tool: search_sessions] Query: "${query}" | limit: ${safeLimit}`);

      // ── Gap 1 Fix: call planResources on chat_session (not hardcoded if/else) ──
      // This makes Cerbos the single source of truth for session access policy.
      // Any future role changes in chat_session_policy.yaml automatically propagate.
      const cerbos = getCerbosClient();
      const principal = buildCerbosPrincipal(session);

      let planKind: string = "CERBOS_UNREACHABLE";
      let rawAst: SecurityContext["cerbosRawAst"] = null;
      let securityFilter: Record<string, unknown> = { _id: { $in: [] } }; // deny-all default

      try {
        const planResponse = await cerbos.planResources({
          principal,
          resource: { kind: CHAT_SESSION_RESOURCE_KIND },
          action: "search",
        });
        const compiled = planResponseToMongoFilter(planResponse);
        securityFilter = compiled.filter;
        planKind       = compiled.planKind;
        rawAst         = compiled.rawAst;
        console.log(`[Cerbos/chat_session] Plan: ${planKind} → ${JSON.stringify(securityFilter)}`);
      } catch (err) {
        console.error("[Cerbos/chat_session] PDP unreachable:", err);
        // Fail closed — deny-all filter already set above
      }

      // ── Step 1: Embed the query with Voyage AI ──────────────────────────────
      let queryVector: number[];
      try {
        queryVector = await embedText(query, "query");
        console.log(`[Tool: search_sessions] Embedded query → ${queryVector.length} dims`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Tool: search_sessions] Voyage embedding failed: ${msg}`);
        return {
          results: [], total: 0, query,
          security_context: {
            principal: { id: session.id, tenantId: session.tenantId, roles: session.roles, name: session.name },
            toolName: "search_sessions",
            cerbosPlanKind: planKind,
            cerbosRawAst: rawAst,
            compiledMongoFilter: securityFilter,
            llmGeneratedFilter: { query, limit: safeLimit },
            finalMongoQuery: { pipeline: [] },
            queriedAt,
            resultCount: 0,
          },
        };
      }

      // ── Step 2: Build $vectorSearch pipeline ────────────────────────────────
      // $vectorSearch must be first stage (per MCP aggregate tool docs).
      // filter = Cerbos-compiled security boundary, enforced inside the ANN scan.
      // $unset at end is mandatory to avoid sending binary embeddings to the LLM.
      const pipeline = [
        {
          $vectorSearch: {
            index: VECTOR_INDEX_NAME,
            path: "embedding",
            queryVector,
            numCandidates: Math.max(safeLimit * 20, 100),
            limit: safeLimit,
            filter: securityFilter,
          },
        },
        { $addFields: { score: { $meta: "vectorSearchScore" } } },
        { $unset: ["embedding", "raw_transcript"] },
      ];

      // ── Step 3: Call MCP aggregate on chat_sessions ─────────────────────────
      let results: SessionSearchResult[] = [];
      try {
        const mcpResult = await callMcpAggregate(pipeline);
        results = parseMcpAggregate(mcpResult.content ?? []);
        console.log(`[Tool: search_sessions] Returned ${results.length} session(s)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Tool: search_sessions] MCP aggregate failed: ${msg}`);
      }

      console.log(`${"═".repeat(60)}\n`);

      // ── Gap 2 Fix: build full SecurityContext so the analytics panel works ──
      const security_context: SecurityContext = {
        principal: {
          id: session.id,
          tenantId: session.tenantId,
          roles: session.roles,
          name: session.name,
        },
        toolName: "search_sessions",
        cerbosPlanKind: planKind,
        cerbosRawAst: rawAst,
        compiledMongoFilter: securityFilter,         // Cerbos-compiled filter → Step 1 in panel
        llmGeneratedFilter: { query, limit: safeLimit }, // what LLM passed → Step 2 in panel
        finalMongoQuery: { pipeline },               // full $vectorSearch pipeline → Step 3 in panel
        queriedAt,
        resultCount: results.length,
      };

      return { results, total: results.length, query, security_context };
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
    maxSteps: 10,
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
        // Stream SecurityContext for search_sessions — same annotation type as MCP tools
        // so the existing useEffect in the UI picks it up without any changes.
        if (tr.toolName === "search_sessions") {
          const toolResult = tr.result as SessionSearchToolResult;
          if (!toolResult?.security_context) continue;
          const annotation = JSON.parse(
            JSON.stringify({ type: "security_context", payload: toolResult.security_context })
          ) as JSONValue;
          streamData.append(annotation);
        }
      }
    },
    onFinish: () => {
      // Fire cleanup as a detached promise so the stream response is not blocked.
      // streamData.close() is in finally — guaranteed to run regardless of errors.
      void (async () => {
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
        finally { streamData.close(); }
      })();
    },
  });

  // ── Step 8: Return stream + data annotations ──────────────────────────────
  return result.toDataStreamResponse({ data: streamData });
}
