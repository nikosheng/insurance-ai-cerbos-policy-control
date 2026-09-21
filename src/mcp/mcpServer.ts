import { tool, jsonSchema } from "ai";
import { createMCPClient } from "@ai-sdk/mcp";
import { getCerbosClient, buildCerbosPrincipal, INSURANCE_POLICY_RESOURCE_KIND, CUSTOMER_RESOURCE_KIND, DEAL_RESOURCE_KIND, ACTIVITY_RESOURCE_KIND } from "@/lib/cerbos";
import { planResponseToMongoFilter } from "@/lib/ast-to-mongo";
import { mergeFilters } from "@/lib/db";
import type { AgentSession, CustomerSession, InsurancePolicy, McpToolResult, SecurityContext } from "@/types";

// Re-export browser-safe static data so other server-side files can import
// from a single location without pulling in the Node.js-only DB layer.
export { AGENT_REGISTRY, TEST_SCENARIOS, buildSessionFromAgentId } from "@/lib/agents";
export type { AgentId } from "@/lib/agents";

// ─── Constants ────────────────────────────────────────────────────────────────
const DB_NAME = () => process.env.MONGODB_DB_NAME || "insurance_db";
const COLLECTION = "insurance_policies";
const CONNECTION_ID = "preconfigured";

// ─── Response Parser ──────────────────────────────────────────────────────────
// mongodb-mcp-server wraps document data in an <untrusted-user-data-{uuid}> tag
// to prevent prompt injection. This parser extracts the JSON from inside it.
//
// The same UUID appears multiple times in the text (preamble warning + actual
// opening tag + suffix). We find the opening tag immediately followed by
// JSON content (starts with [ or {) to locate the real data section.

const OPENING_TAG_RE = /<untrusted-user-data-([a-f0-9-]+)>/g;

function parseMcpContent(
  content: Array<{ type: string; text?: string }>
): InsurancePolicy[] {
  const docs: InsurancePolicy[] = [];

  for (const block of content) {
    if (block.type !== "text" || !block.text) continue;
    const text = block.text;

    let dataTagMatch: RegExpExecArray | null = null;
    let m: RegExpExecArray | null;
    const re = new RegExp(OPENING_TAG_RE.source, "g");

    while ((m = re.exec(text)) !== null) {
      const after = text.slice(m.index + m[0].length).trimStart();
      if (after.startsWith("[") || after.startsWith("{")) {
        dataTagMatch = m;
        break;
      }
    }

    if (dataTagMatch) {
      const startIdx = dataTagMatch.index + dataTagMatch[0].length;
      const closingTag = `</untrusted-user-data-${dataTagMatch[1]}>`;
      const closingIdx = text.indexOf(closingTag, startIdx);
      const jsonStr = (
        closingIdx >= 0 ? text.slice(startIdx, closingIdx) : text.slice(startIdx)
      ).trim();

      if (!jsonStr.startsWith("[") && !jsonStr.startsWith("{")) continue;
      try {
        const parsed: unknown = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) docs.push(...(parsed as InsurancePolicy[]));
        else if (parsed && typeof parsed === "object") docs.push(parsed as InsurancePolicy);
      } catch { /* malformed JSON — skip */ }
    } else {
      // No wrapper — try direct JSON (future-proofing)
      const trimmed = text.trim();
      if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) continue;
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) docs.push(...(parsed as InsurancePolicy[]));
        else if (parsed && typeof parsed === "object") docs.push(parsed as InsurancePolicy);
      } catch { /* not JSON */ }
    }
  }

  return docs;
}

// ─── Cerbos Context Builder ───────────────────────────────────────────────────
// Called once per tool execution. Returns the compiled security filter and
// the raw AST for the analytics panel.

interface CerbosContext {
  securityFilter: Record<string, unknown>;
  planKind: string;
  rawAst: SecurityContext["cerbosRawAst"];
}

async function buildCerbosContext(session: AgentSession): Promise<CerbosContext> {
  const cerbos = getCerbosClient();
  const principal = buildCerbosPrincipal(session);

  const planResponse = await cerbos.planResources({
    principal,
    resource: { kind: INSURANCE_POLICY_RESOURCE_KIND },
    action: "read",
  });

  const { filter: securityFilter, planKind, rawAst } = planResponseToMongoFilter(planResponse);
  console.log(`[Cerbos] Plan kind: ${planKind} → filter: ${JSON.stringify(securityFilter)}`);
  return { securityFilter, planKind, rawAst };
}

// ─── Customer Principal Builder ───────────────────────────────────────────────
// Builds a Cerbos principal for the "customer" role.
// P.id             = clientId slug  (e.g. "alice-johnson")
// P.attr.tenant_id = "Tenant_A"
// P.attr.client_name = "Alice Johnson"   ← matched by customer_own_policies rule
//
// The Cerbos rule compiles to: { tenant_id: "Tenant_A", client_name: "Alice Johnson" }
// This filter is injected into every MCP tool call — customer cannot see any other row.

export function buildCerbosCustomerPrincipal(session: CustomerSession) {
  return {
    id: session.clientId,
    roles: session.roles,
    attr: {
      tenant_id: session.tenantId,
      client_name: session.clientName,
    },
  };
}

async function buildCerbosContextForCustomer(session: CustomerSession): Promise<CerbosContext> {
  const cerbos = getCerbosClient();
  const principal = buildCerbosCustomerPrincipal(session);

  const planResponse = await cerbos.planResources({
    principal,
    resource: { kind: INSURANCE_POLICY_RESOURCE_KIND },
    action: "read",
  });

  const { filter: securityFilter, planKind, rawAst } = planResponseToMongoFilter(planResponse);
  console.log(`[Cerbos/Customer] Plan kind: ${planKind} → filter: ${JSON.stringify(securityFilter)}`);
  return { securityFilter, planKind, rawAst };
}

// ─── SecurityContext Assembler ────────────────────────────────────────────────

function buildSecurityContext(
  session: AgentSession,
  toolName: string,
  cerbos: CerbosContext,
  llmGeneratedFilter: Record<string, unknown>,
  finalMongoQuery: Record<string, unknown>,
  resultCount: number,
  queriedAt: string
): SecurityContext {
  return {
    principal: {
      id: session.id,
      tenantId: session.tenantId,
      roles: session.roles,
      name: session.name,
    },
    toolName,
    cerbosPlanKind: cerbos.planKind,
    cerbosRawAst: cerbos.rawAst,
    compiledMongoFilter: cerbos.securityFilter,
    llmGeneratedFilter,
    finalMongoQuery,
    queriedAt,
    resultCount,
  };
}

// ─── Cerbos-Wrapped Tools Factory ─────────────────────────────────────────────
// Returns an object of AI SDK tools, one per mongodb-mcp-server tool exposed to
// the LLM. Each data-touching tool (find, aggregate, count) has a Cerbos
// injection wrapper that:
//   1. Reads the LLM's MQL arguments
//   2. Calls Cerbos planResources with the server-side session
//   3. Merges the Cerbos security filter into the LLM's filter/pipeline
//   4. Calls the real mongodb-mcp-server tool with the secured arguments
//   5. Returns parsed documents + SecurityContext for the analytics panel
//
// Passthrough tools (collection-schema, collection-indexes, etc.) are forwarded
// directly — they don't return document contents so Cerbos injection is not needed.
//
// ZERO-TRUST DESIGN:
//   - connectionId, database, collection are NEVER exposed to the LLM.
//     They are always injected server-side as "preconfigured"/"insurance_db"/
//     "insurance_policies". The LLM cannot redirect queries to other collections.
//   - tenant_id and agent_id are NEVER in any tool parameter schema. The LLM
//     cannot influence the security boundary under any circumstance.
//   - Even if the LLM generates a filter like { tenant_id: "Tenant_B" }, the
//     Cerbos $and merge overwrites it with the authorised value.

export async function createCerbosWrappedTools(session: AgentSession) {
  const mcpServerUrl = process.env.MDB_MCP_SERVER_URL;
  if (!mcpServerUrl) {
    throw new Error("MDB_MCP_SERVER_URL is not set. Start the mongodb-mcp-server via docker-compose.");
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not set. Add your MongoDB Atlas connection string to .env.local.");
  }

  // One MCP client per chat request — shared across all tool calls within the
  // same conversation turn. Closed by the caller (chat route onFinish).
  const mcpClient = await createMCPClient({
    transport: { type: "http", url: mcpServerUrl },
  });

  // Discover all tools from the running mongodb-mcp-server instance.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mcpTools = await mcpClient.tools() as Record<string, any>;

  // ── Establish a MongoDB connection via the connect tool ────────────────────
  // mongodb-mcp-server requires an active connection before any data tool can
  // run. When MDB_MCP_CONNECTION_STRING is not set in the container (e.g. when
  // using a dynamic Atlas URI from .env.local), there is no "preconfigured"
  // connection. We call the connect tool once per request to get a connectionId,
  // then pass it to every subsequent tool call. The connection is closed in the
  // chat route's onFinish callback.
  const db = DB_NAME();
  let connectionId = CONNECTION_ID; // start with "preconfigured" as optimistic default

  try {
    const connectResult = await mcpTools["connect"].execute(
      { connectionString: mongoUri, connectionName: "insurance-session" },
      { abortSignal: undefined }
    );
    // Extract connectionId from the response text.
    // Success response: "Successfully connected to MongoDB. Your connectionId is "<uuid>"..."
    const responseText = connectResult.content
      ?.filter((b: { type: string }) => b.type === "text")
      .map((b: { text?: string }) => b.text ?? "")
      .join(" ") ?? "";

    const idMatch = responseText.match(/connectionId[^"]*"([a-f0-9-]{36})"/i)
      || responseText.match(/"([a-f0-9-]{36})"/);
    if (idMatch) {
      connectionId = idMatch[1];
      console.log(`[MCP] Connected to MongoDB. connectionId: ${connectionId}`);
    } else {
      // connect returned something unexpected — log and fall through to "preconfigured"
      console.warn("[MCP] connect tool response did not contain a connectionId:", responseText.slice(0, 200));
    }
  } catch (connErr) {
    // If connect fails (e.g. preconfigured already exists), log and proceed
    console.warn("[MCP] connect tool error (may already have preconfigured):", connErr);
  }

  // ── Helper: call real MCP tool's execute() ─────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function callRealTool(name: string, args: Record<string, unknown>): Promise<any> {
    const realTool = mcpTools[name];
    if (!realTool) throw new Error(`mongodb-mcp-server did not expose tool "${name}"`);
    return realTool.execute(args, { abortSignal: undefined });
  }

  // ── Denied context (when Cerbos PDP is unreachable) ────────────────────────
  function deniedResult(toolName: string, llmFilter: Record<string, unknown>, queriedAt: string): McpToolResult {
    return {
      documents: [],
      security_context: {
        principal: { id: session.id, tenantId: session.tenantId, roles: session.roles, name: session.name },
        toolName,
        cerbosPlanKind: "CERBOS_UNREACHABLE",
        cerbosRawAst: null,
        compiledMongoFilter: { _id: { $in: [] } },
        llmGeneratedFilter: llmFilter,
        finalMongoQuery: { _id: { $in: [] } },
        queriedAt,
        resultCount: 0,
      },
      total_count: 0,
      message: "Authorization service unavailable. Access denied.",
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TOOL 1: find
  // The LLM supplies any MongoDB filter expression. Cerbos security filter is
  // $and-merged on top before the query reaches MongoDB.
  // ════════════════════════════════════════════════════════════════════════════
  const findTool = tool({
    description: `Query insurance policy documents using a MongoDB filter expressed as a JSON string.
Express any filter condition: date ranges, comparisons, logical operators, nested field checks.

Examples (pass as a JSON string):
  '{ "end_date": { "$lt": "2027-01-01" } }'
  '{ "coverage_amount": { "$gt": 100000 } }'
  '{ "policy_type": "Auto", "status": "Active" }'
  '{ "$or": [{ "status": "Pending" }, { "status": "Expired" }] }'
  '{}' to return all documents in your authorized scope.

IMPORTANT: Pass an empty object string '{}' if you want all records with no extra filter.
DO NOT include tenant_id, agent_id, or any identity fields — those are automatically
enforced by the authorization layer.
DO NOT specify connectionId, database, or collection — they are fixed server-side.`,

    parameters: jsonSchema<{
      filter_json: string;
      sort_json: string;
      limit: number;
    }>({
      type: "object",
      properties: {
        filter_json: {
          type: "string",
          description: "MongoDB query filter as a JSON string. Do NOT include tenant_id or agent_id. Use '{}' for no filter.",
          default: "{}",
        },
        sort_json: {
          type: "string",
          description: "Sort order as a JSON string. E.g. '{\"end_date\":1}' for ascending. Use '{}' for no sort.",
          default: "{}",
        },
        limit: {
          type: "number",
          description: "Maximum documents to return. Defaults to 50.",
          default: 50,
        },
      },
      required: ["filter_json", "sort_json", "limit"],
      additionalProperties: false,
    }),

    execute: async (args): Promise<McpToolResult> => {
      const queriedAt = new Date().toISOString();

      // Parse the JSON strings supplied by the LLM. Fall back to empty objects
      // if the LLM passes invalid JSON — this prevents the tool from crashing.
      let llmFilter: Record<string, unknown> = {};
      let llmSort: Record<string, unknown> = {};
      try { llmFilter = JSON.parse(args.filter_json || "{}"); } catch { llmFilter = {}; }
      try { llmSort = JSON.parse(args.sort_json || "{}"); } catch { llmSort = {}; }

      console.log(`\n${"═".repeat(60)}`);
      console.log(`[Tool: find] Session: ${session.id} @ ${session.tenantId}`);
      console.log(`[Tool: find] LLM filter: ${JSON.stringify(llmFilter)}`);

      // Step 1: Get Cerbos security boundary
      let cerbos: CerbosContext;
      try {
        cerbos = await buildCerbosContext(session);
      } catch (err) {
        console.error("[Cerbos] PDP unreachable:", err);
        return deniedResult("find", llmFilter, queriedAt);
      }

      // Step 2: Merge Cerbos filter + LLM filter
      // Security filter is always the primary constraint — it cannot be
      // weakened or overridden by anything the LLM passes.
      const finalFilter = mergeFilters(cerbos.securityFilter, llmFilter);
      console.log(`[Tool: find] Final merged filter: ${JSON.stringify(finalFilter)}`);

      // Step 3: Call real mongodb-mcp-server find tool with secured args
      const result = await callRealTool("find", {
        connectionId: connectionId,
        database: db,
        collection: COLLECTION,
        filter: finalFilter,
        limit: args.limit ?? 50,
        ...(Object.keys(llmSort).length > 0 && { sort: llmSort }),
      });

      const docs = parseMcpContent(result.content ?? []);
      console.log(`[Tool: find] Returned ${docs.length} document(s)`);
      console.log(`${"═".repeat(60)}\n`);

      const securityContext = buildSecurityContext(
        session, "find", cerbos, llmFilter, finalFilter, docs.length, queriedAt
      );

      return {
        documents: docs,
        security_context: securityContext,
        total_count: docs.length,
        message: docs.length === 0
          ? "No documents found matching your filter within your authorized scope."
          : `Found ${docs.length} document${docs.length > 1 ? "s" : ""} within your authorized scope.`,
      };
    },
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TOOL 2: aggregate
  // The LLM supplies a pipeline array. Cerbos security filter is prepended as
  // a mandatory $match stage 0 so it always runs before any LLM pipeline stage.
  // ════════════════════════════════════════════════════════════════════════════
  const aggregateTool = tool({
    description: `Run an aggregation pipeline on insurance policy documents. Pass the pipeline as a JSON string.
Use this for grouping, statistics, transformations, and complex multi-stage queries.
A security $match stage is automatically prepended — do NOT add one for tenant_id or agent_id.
DO NOT specify connectionId, database, or collection.

Example pipeline_json strings:
  Count by policy type:
    '[{ "$group": { "_id": "$policy_type", "count": { "$sum": 1 } } }]'
  Average premium by status:
    '[{ "$group": { "_id": "$status", "avg_premium": { "$avg": "$premium_monthly" } } }]'
  Policies expiring before 2026, sorted:
    '[{ "$match": { "end_date": { "$lt": "2026-01-01" } } }, { "$sort": { "end_date": 1 } }]'`,

    parameters: jsonSchema<{ pipeline_json: string }>({
      type: "object",
      properties: {
        pipeline_json: {
          type: "string",
          description: "Aggregation pipeline stages as a JSON array string. Do NOT add $match for tenant_id or agent_id — injected automatically.",
          default: "[]",
        },
      },
      required: ["pipeline_json"],
      additionalProperties: false,
    }),

    execute: async (args): Promise<McpToolResult> => {
      const queriedAt = new Date().toISOString();

      let llmPipeline: Record<string, unknown>[] = [];
      try { llmPipeline = JSON.parse(args.pipeline_json || "[]"); } catch { llmPipeline = []; }
      if (!Array.isArray(llmPipeline)) llmPipeline = [];

      console.log(`\n${"═".repeat(60)}`);
      console.log(`[Tool: aggregate] Session: ${session.id} @ ${session.tenantId}`);
      console.log(`[Tool: aggregate] LLM pipeline stages: ${llmPipeline.length}`);

      // Step 1: Get Cerbos security boundary
      let cerbos: CerbosContext;
      try {
        cerbos = await buildCerbosContext(session);
      } catch (err) {
        console.error("[Cerbos] PDP unreachable:", err);
        return deniedResult("aggregate", { pipeline: llmPipeline }, queriedAt);
      }

      // Step 2: Prepend Cerbos $match as pipeline stage 0
      // MongoDB executes pipeline stages in order — stage 0 always runs first,
      // ensuring the security boundary is enforced before any LLM stage.
      const securedPipeline = [
        { $match: cerbos.securityFilter },
        ...llmPipeline,
      ];
      console.log(`[Tool: aggregate] Final pipeline: ${JSON.stringify(securedPipeline)}`);

      // Step 3: Call real mongodb-mcp-server aggregate tool
      const result = await callRealTool("aggregate", {
        connectionId: connectionId,
        database: db,
        collection: COLLECTION,
        pipeline: securedPipeline,
      });

      const docs = parseMcpContent(result.content ?? []);
      console.log(`[Tool: aggregate] Returned ${docs.length} result(s)`);
      console.log(`${"═".repeat(60)}\n`);

      // For telemetry: llmGeneratedFilter = the raw pipeline, finalMongoQuery = secured pipeline
      const securityContext = buildSecurityContext(
        session, "aggregate", cerbos,
        { pipeline: llmPipeline },
        { pipeline: securedPipeline },
        docs.length, queriedAt
      );

      return {
        documents: docs,
        security_context: securityContext,
        total_count: docs.length,
        message: docs.length === 0
          ? "Aggregation returned no results within your authorized scope."
          : `Aggregation returned ${docs.length} result${docs.length > 1 ? "s" : ""} within your authorized scope.`,
      };
    },
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TOOL 3: count
  // The LLM supplies a query filter. Cerbos security filter is $and-merged
  // before the count is executed — same pattern as find.
  // ════════════════════════════════════════════════════════════════════════════
  const countTool = tool({
    description: `Count insurance policy documents matching a query.
Use this to answer "how many policies..." questions without fetching full documents.
DO NOT include tenant_id or agent_id in the query — those are enforced automatically.
DO NOT specify connectionId, database, or collection.

Examples:
  Count all active policies: { "status": "Active" }
  Count auto policies:       { "policy_type": "Auto" }
  Count expiring before 2027: { "end_date": { "$lt": "2027-01-01" } }`,

    parameters: jsonSchema<{ query_json: string }>({
      type: "object",
      properties: {
        query_json: {
          type: "string",
          description: "MongoDB filter for counting as a JSON string. Do NOT include tenant_id or agent_id. Use '{}' for all.",
          default: "{}",
        },
      },
      required: ["query_json"],
      additionalProperties: false,
    }),

    execute: async (args): Promise<McpToolResult> => {
      const queriedAt = new Date().toISOString();

      let llmQuery: Record<string, unknown> = {};
      try { llmQuery = JSON.parse(args.query_json || "{}"); } catch { llmQuery = {}; }

      console.log(`\n${"═".repeat(60)}`);
      console.log(`[Tool: count] Session: ${session.id} @ ${session.tenantId}`);
      console.log(`[Tool: count] LLM query: ${JSON.stringify(llmQuery)}`);

      // Step 1: Get Cerbos security boundary
      let cerbos: CerbosContext;
      try {
        cerbos = await buildCerbosContext(session);
      } catch (err) {
        console.error("[Cerbos] PDP unreachable:", err);
        return deniedResult("count", llmQuery, queriedAt);
      }

      // Step 2: Merge security filter with LLM query
      const finalQuery = mergeFilters(cerbos.securityFilter, llmQuery);
      console.log(`[Tool: count] Final merged query: ${JSON.stringify(finalQuery)}`);

      // Step 3: Call real mongodb-mcp-server count tool
      const result = await callRealTool("count", {
        connectionId: connectionId,
        database: db,
        collection: COLLECTION,
        query: finalQuery,
      });

      // Count tool returns a text message like "Found N documents in the collection"
      let count = 0;
      if (result.content?.[0]?.text) {
        const match = result.content[0].text.match(/(\d+)/);
        if (match) count = parseInt(match[1], 10);
      }
      console.log(`[Tool: count] Count result: ${count}`);
      console.log(`${"═".repeat(60)}\n`);

      const securityContext = buildSecurityContext(
        session, "count", cerbos, llmQuery, finalQuery, count, queriedAt
      );

      return {
        documents: [],
        security_context: securityContext,
        total_count: count,
        message: `Count result: ${count} document${count !== 1 ? "s" : ""} match your filter within your authorized scope.`,
      };
    },
  });

  // ════════════════════════════════════════════════════════════════════════════
  // PASSTHROUGH TOOLS — no document data returned, no Cerbos injection needed.
  // connectionId, database, collection are still fixed server-side to prevent
  // the LLM from inspecting arbitrary collections.
  // ════════════════════════════════════════════════════════════════════════════

  const collectionSchemaTool = tool({
    description: `Describe the schema (field names and types) of the insurance_policies collection.
Use this to understand available fields before writing a filter or pipeline.
The schema is derived from a sample of existing documents.`,
    parameters: jsonSchema<Record<string, never>>({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    }),
    execute: async (): Promise<{ schema: unknown; message: string }> => {
      const result = await callRealTool("collection-schema", {
        connectionId: connectionId,
        database: db,
        collection: COLLECTION,
      });
      const text = result.content?.map((b: { text?: string }) => b.text).join("\n") ?? "";
      return { schema: text, message: "Schema retrieved for insurance_policies." };
    },
  });

  const collectionIndexesTool = tool({
    description: `List the indexes defined on the insurance_policies collection.
Use this to understand which fields are indexed for efficient querying.`,
    parameters: jsonSchema<Record<string, never>>({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    }),
    execute: async (): Promise<{ indexes: unknown; message: string }> => {
      const result = await callRealTool("collection-indexes", {
        connectionId: connectionId,
        database: db,
        collection: COLLECTION,
      });
      const text = result.content?.map((b: { text?: string }) => b.text).join("\n") ?? "";
      return { indexes: text, message: "Indexes retrieved for insurance_policies." };
    },
  });

  // Return the complete tool registry. The caller spreads this into streamText tools.
  // _mcpClient and _connectionId are prefixed with _ so they are excluded from the
  // tools spread via destructuring in the chat route.
  return {
    find: findTool,
    aggregate: aggregateTool,
    count: countTool,
    collection_schema: collectionSchemaTool,
    collection_indexes: collectionIndexesTool,
    _mcpClient: mcpClient,
    _connectionId: connectionId,
  };
}

// ─── Tool name set for telemetry detection ────────────────────────────────────
// Used by the chat route's onStepFinish to detect which tool calls carry
// SecurityContext telemetry that should be streamed to the analytics panel.
export const DATA_TOOL_NAMES = new Set(["find", "aggregate", "count"]);

// CRM tools use fixed collection/resource pairs. The LLM supplies a query only;
// Cerbos derives and injects the assigned-agent scope on every call.
export async function createCustomer360Tools(session: AgentSession) {
  const url = process.env.MDB_MCP_SERVER_URL;
  const uri = process.env.MONGODB_URI;
  if (!url || !uri) throw new Error("MDB_MCP_SERVER_URL and MONGODB_URI are required.");
  const client = await createMCPClient({ transport: { type: "http", url } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mcp = await client.tools() as Record<string, any>;
  let connectionId = CONNECTION_ID;
  try {
    const result = await mcp.connect.execute({ connectionString: uri, connectionName: "customer-360" }, { abortSignal: undefined });
    const text = result.content?.map((part: { text?: string }) => part.text ?? "").join(" ") ?? "";
    const match = text.match(/\"([a-f0-9-]{36})\"/);
    if (match) connectionId = match[1];
  } catch { /* use preconfigured connection */ }

  function resourceTools(prefix: string, collection: string, kind: string) {
    async function secured(filter: Record<string, unknown>) {
      const plan = await getCerbosClient().planResources({ principal: buildCerbosPrincipal(session), resource: { kind }, action: "read" });
      return mergeFilters(planResponseToMongoFilter(plan).filter, filter);
    }
    return {
      [`find_${prefix}`]: tool({
        description: `Query authorized ${prefix}. Identity and collection fields are server-enforced.`,
        parameters: jsonSchema<{ filter_json: string; limit: number }>({ type: "object", properties: { filter_json: { type: "string", default: "{}" }, limit: { type: "number", default: 50 } }, required: ["filter_json", "limit"], additionalProperties: false }),
        execute: async ({ filter_json, limit }) => {
          let filter: Record<string, unknown> = {}; try { filter = JSON.parse(filter_json || "{}"); } catch { /* empty filter */ }
          const result = await mcp.find.execute({ connectionId, database: DB_NAME(), collection, filter: await secured(filter), limit: Math.min(Math.max(limit, 1), 100) }, { abortSignal: undefined });
          const documents = parseMcpContent(result.content ?? []);
          return { documents, total_count: documents.length, message: `Found ${documents.length} authorized ${prefix} record(s).` };
        },
      }),
      [`aggregate_${prefix}`]: tool({
        description: `Aggregate authorized ${prefix}. Cerbos prepends the mandatory ownership match.`,
        parameters: jsonSchema<{ pipeline_json: string }>({ type: "object", properties: { pipeline_json: { type: "string", default: "[]" } }, required: ["pipeline_json"], additionalProperties: false }),
        execute: async ({ pipeline_json }) => {
          let pipeline: Record<string, unknown>[] = []; try { pipeline = JSON.parse(pipeline_json || "[]"); } catch { /* empty pipeline */ }
          if (!Array.isArray(pipeline)) pipeline = [];
          const result = await mcp.aggregate.execute({ connectionId, database: DB_NAME(), collection, pipeline: [{ $match: await secured({}) }, ...pipeline] }, { abortSignal: undefined });
          const documents = parseMcpContent(result.content ?? []);
          return { documents, total_count: documents.length, message: `Aggregation returned ${documents.length} authorized ${prefix} result(s).` };
        },
      }),
      [`count_${prefix}`]: tool({
        description: `Count authorized ${prefix}. Cerbos injects ownership scope.`,
        parameters: jsonSchema<{ query_json: string }>({ type: "object", properties: { query_json: { type: "string", default: "{}" } }, required: ["query_json"], additionalProperties: false }),
        execute: async ({ query_json }) => {
          let query: Record<string, unknown> = {}; try { query = JSON.parse(query_json || "{}"); } catch { /* empty query */ }
          const result = await mcp.count.execute({ connectionId, database: DB_NAME(), collection, query: await secured(query) }, { abortSignal: undefined });
          const total_count = Number((result.content?.[0]?.text ?? "").match(/(\d+)/)?.[1] ?? 0);
          return { documents: [], total_count, message: `Count result: ${total_count} authorized ${prefix} record(s).` };
        },
      }),
    };
  }
  return {
    ...resourceTools("customers", "customers", CUSTOMER_RESOURCE_KIND),
    ...resourceTools("deals", "deals", DEAL_RESOURCE_KIND),
    ...resourceTools("activities", "activities", ACTIVITY_RESOURCE_KIND),
    _customer360McpClient: client,
  };
}

// ─── Customer SecurityContext builder ─────────────────────────────────────────
function buildSecurityContextForCustomer(
  session: CustomerSession,
  toolName: string,
  cerbos: CerbosContext,
  llmGeneratedFilter: Record<string, unknown>,
  finalMongoQuery: Record<string, unknown>,
  resultCount: number,
  queriedAt: string
): SecurityContext {
  return {
    principal: {
      id: session.clientId,
      tenantId: session.tenantId,
      roles: session.roles,
      name: session.clientName,
    },
    toolName,
    cerbosPlanKind: cerbos.planKind,
    cerbosRawAst: cerbos.rawAst,
    compiledMongoFilter: cerbos.securityFilter,
    llmGeneratedFilter,
    finalMongoQuery,
    queriedAt,
    resultCount,
  };
}

// ─── Cerbos-Wrapped Tools for Customer portal ─────────────────────────────────
// Same architecture as createCerbosWrappedTools, but:
//   - Principal has role "customer" + attr.client_name instead of agent_id
//   - Cerbos compiles to { tenant_id, client_name } filter (not agent_id)
//   - Only find + count exposed — customers don't need aggregate for the demo
//   - collection_schema passthrough still included so AI can inspect fields

export async function createCerbosWrappedToolsForCustomer(session: CustomerSession) {
  const mcpServerUrl = process.env.MDB_MCP_SERVER_URL;
  if (!mcpServerUrl) throw new Error("MDB_MCP_SERVER_URL is not set.");

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI is not set.");

  const mcpClient = await createMCPClient({
    transport: { type: "http", url: mcpServerUrl },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mcpTools = await mcpClient.tools() as Record<string, any>;

  const db = DB_NAME();
  let connectionId = CONNECTION_ID;

  try {
    const connectResult = await mcpTools["connect"].execute(
      { connectionString: mongoUri, connectionName: `customer-${session.clientId}` },
      { abortSignal: undefined }
    );
    const responseText = connectResult.content
      ?.filter((b: { type: string }) => b.type === "text")
      .map((b: { text?: string }) => b.text ?? "")
      .join(" ") ?? "";

    const idMatch = responseText.match(/connectionId[^"]*"([a-f0-9-]{36})"/i)
      || responseText.match(/"([a-f0-9-]{36})"/);
    if (idMatch) {
      connectionId = idMatch[1];
      console.log(`[MCP/Customer] Connected. connectionId: ${connectionId}`);
    }
  } catch (connErr) {
    console.warn("[MCP/Customer] connect error:", connErr);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function callRealTool(name: string, args: Record<string, unknown>): Promise<any> {
    const realTool = mcpTools[name];
    if (!realTool) throw new Error(`mongodb-mcp-server did not expose tool "${name}"`);
    return realTool.execute(args, { abortSignal: undefined });
  }

  function deniedResult(toolName: string, llmFilter: Record<string, unknown>, queriedAt: string): McpToolResult {
    return {
      documents: [],
      security_context: {
        principal: { id: session.clientId, tenantId: session.tenantId, roles: session.roles, name: session.clientName },
        toolName,
        cerbosPlanKind: "CERBOS_UNREACHABLE",
        cerbosRawAst: null,
        compiledMongoFilter: { _id: { $in: [] } },
        llmGeneratedFilter: llmFilter,
        finalMongoQuery: { _id: { $in: [] } },
        queriedAt,
        resultCount: 0,
      },
      total_count: 0,
      message: "Authorization service unavailable. Access denied.",
    };
  }

  // ── TOOL: find ───────────────────────────────────────────────────────────────
  const findTool = tool({
    description: `Query the customer's insurance policy documents using a MongoDB filter JSON string.
Use this when the customer asks about their coverage, premium, deductible, policy status, or dates.
IMPORTANT: DO NOT include client_name, tenant_id, or any identity fields — enforced automatically.
Use '{}' to return all policies for this customer.

Examples:
  '{}' — all policies
  '{ "status": "Active" }' — active policies only
  '{ "policy_type": "Auto" }' — auto policies`,

    parameters: jsonSchema<{ filter_json: string; limit: number }>({
      type: "object",
      properties: {
        filter_json: {
          type: "string",
          description: "MongoDB filter as JSON string. Do NOT include client_name or tenant_id. Use '{}' for all.",
          default: "{}",
        },
        limit: {
          type: "number",
          description: "Max documents to return. Default 20.",
          default: 20,
        },
      },
      required: ["filter_json", "limit"],
      additionalProperties: false,
    }),

    execute: async (args): Promise<McpToolResult> => {
      const queriedAt = new Date().toISOString();
      let llmFilter: Record<string, unknown> = {};
      try { llmFilter = JSON.parse(args.filter_json || "{}"); } catch { llmFilter = {}; }

      console.log(`[Customer Tool: find] ${session.clientName} @ ${session.tenantId}`);

      let cerbos: CerbosContext;
      try {
        cerbos = await buildCerbosContextForCustomer(session);
      } catch (err) {
        console.error("[Cerbos/Customer] PDP unreachable:", err);
        return deniedResult("find", llmFilter, queriedAt);
      }

      const finalFilter = mergeFilters(cerbos.securityFilter, llmFilter);
      console.log(`[Customer Tool: find] Final filter: ${JSON.stringify(finalFilter)}`);

      const result = await callRealTool("find", {
        connectionId,
        database: db,
        collection: COLLECTION,
        filter: finalFilter,
        limit: args.limit ?? 20,
      });

      const docs = parseMcpContent(result.content ?? []);
      return {
        documents: docs,
        security_context: buildSecurityContextForCustomer(
          session, "find", cerbos, llmFilter, finalFilter, docs.length, queriedAt
        ),
        total_count: docs.length,
        message: docs.length === 0
          ? "No policies found."
          : `Found ${docs.length} policy record${docs.length > 1 ? "s" : ""}.`,
      };
    },
  });

  // ── TOOL: count ──────────────────────────────────────────────────────────────
  const countTool = tool({
    description: `Count the customer's insurance policy documents. Use for "how many policies" questions.
DO NOT include client_name or tenant_id — enforced automatically.`,

    parameters: jsonSchema<{ query_json: string }>({
      type: "object",
      properties: {
        query_json: {
          type: "string",
          description: "MongoDB filter for counting as JSON string. Use '{}' for all.",
          default: "{}",
        },
      },
      required: ["query_json"],
      additionalProperties: false,
    }),

    execute: async (args): Promise<McpToolResult> => {
      const queriedAt = new Date().toISOString();
      let llmQuery: Record<string, unknown> = {};
      try { llmQuery = JSON.parse(args.query_json || "{}"); } catch { llmQuery = {}; }

      let cerbos: CerbosContext;
      try {
        cerbos = await buildCerbosContextForCustomer(session);
      } catch (err) {
        console.error("[Cerbos/Customer] PDP unreachable:", err);
        return deniedResult("count", llmQuery, queriedAt);
      }

      const finalQuery = mergeFilters(cerbos.securityFilter, llmQuery);
      const result = await callRealTool("count", {
        connectionId, database: db, collection: COLLECTION, query: finalQuery,
      });

      let count = 0;
      if (result.content?.[0]?.text) {
        const match = result.content[0].text.match(/(\d+)/);
        if (match) count = parseInt(match[1], 10);
      }

      return {
        documents: [],
        security_context: buildSecurityContextForCustomer(
          session, "count", cerbos, llmQuery, finalQuery, count, queriedAt
        ),
        total_count: count,
        message: `You have ${count} policy record${count !== 1 ? "s" : ""} matching your query.`,
      };
    },
  });

  // ── TOOL: collection_schema (passthrough) ────────────────────────────────────
  const collectionSchemaTool = tool({
    description: "Describe the available fields in the insurance policy records. Use before querying if unsure of field names.",
    parameters: jsonSchema<Record<string, never>>({
      type: "object", properties: {}, required: [], additionalProperties: false,
    }),
    execute: async (): Promise<{ schema: unknown; message: string }> => {
      const result = await callRealTool("collection-schema", {
        connectionId, database: db, collection: COLLECTION,
      });
      const text = result.content?.map((b: { text?: string }) => b.text).join("\n") ?? "";
      return { schema: text, message: "Schema retrieved." };
    },
  });

  return {
    find: findTool,
    count: countTool,
    collection_schema: collectionSchemaTool,
    _mcpClient: mcpClient,
    _connectionId: connectionId,
  };
}
