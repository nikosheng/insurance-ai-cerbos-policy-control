// ─── Customer Session ─────────────────────────────────────────────────────────
// Stored in a separate httpOnly cookie (insurance_customer_session).
// Never collides with the agent session cookie.
export interface CustomerSession {
  clientId: string;       // slug: "alice-johnson" — Cerbos P.id
  clientName: string;     // "Alice Johnson" — Cerbos P.attr.client_name
  clientEmail: string;    // "alice.johnson@email.com"
  agentId: string;        // "agent_1" — whose MCP connection + persona to use
  agentName: string;      // "Sarah Chen" — shown in UI + AI persona
  tenantId: string;       // "Tenant_A" — Cerbos P.attr.tenant_id
  roles: string[];        // ["customer"]
}

// ─── Chat Session Types ───────────────────────────────────────────────────────
export type {
  ChatSession,
  EndSessionRequest,
  EndSessionResponse,
  SessionSearchRequest,
  SessionSearchResult,
  SessionSummaryOutput,
} from "./chat-session";

// ─── Agent Session ─────────────────────────────────────────────────────────────
// Stored in the httpOnly session cookie; never exposed to the LLM as tool input.
export interface AgentSession {
  id: string;           // e.g. "agent_1"
  name: string;         // e.g. "Agent 1 — Sarah Chen"
  tenantId: string;     // e.g. "Tenant_A"
  roles: string[];      // e.g. ["insurance_agent"]
}

// ─── Insurance Policy Document ────────────────────────────────────────────────
// The shape of every document in the insurance_policies collection.
export interface InsurancePolicy {
  _id?: string;
  policy_number: string;
  client_name: string;
  client_email: string;
  // Canonical relationship to the Customer 360 profile. Client fields remain for
  // the existing customer portal and backwards-compatible policy queries.
  customer_id?: string;
  policy_type: "Auto" | "Home" | "Life";
  coverage_amount: number;
  premium_monthly: number;
  deductible: number;
  status: "Active" | "Pending" | "Cancelled" | "Expired";
  start_date: string;
  end_date: string;
  notes: string;
  // Mandatory security boundary fields — enforced by Cerbos
  tenant_id: string;
  agent_id: string;
  // Human-readable agent name stored alongside agent_id so queries like
  // "show me Sarah Chen's policies" resolve without a directory lookup.
  agent_name: string;
}

// ─── Customer 360 Documents ───────────────────────────────────────────────────
// Every CRM resource carries the same ownership fields. Cerbos compiles these
// fields into the mandatory query and vector-search filters.
export interface Customer {
  customer_id: string;
  full_name: string;
  email: string;
  phone: string;
  lifecycle_stage: "Prospect" | "Active" | "At Risk" | "Renewal";
  preferred_contact_method: "Email" | "Phone" | "SMS";
  segment: string;
  profile_summary: string;
  tenant_id: string;
  agent_id: string;
  agent_name: string;
}

export interface Deal {
  deal_id: string;
  customer_id: string;
  customer_name: string;
  title: string;
  stage: "Qualification" | "Proposal" | "Negotiation" | "Closed Won" | "Closed Lost";
  amount: number;
  probability: number;
  expected_close_date: string;
  product_or_policy_type: "Auto" | "Home" | "Life";
  next_step: string;
  tenant_id: string;
  agent_id: string;
  agent_name: string;
}

export interface Activity {
  activity_id: string;
  customer_id: string;
  customer_name: string;
  deal_id: string | null;
  type: "Call" | "Email" | "Meeting" | "Note" | "Task";
  occurred_at: string;
  summary: string;
  outcome: string;
  follow_up_due_at: string | null;
  status: "Completed" | "Open";
  tenant_id: string;
  agent_id: string;
  agent_name: string;
}

export interface ActivitySearchResult extends Activity {
  score: number;
}

export interface Customer360Profile {
  customer: Customer;
  policies: InsurancePolicy[];
  deals: Deal[];
  activities: Activity[];
}

// ─── Cerbos Plan Telemetry ────────────────────────────────────────────────────
// Raw AST node representation for the analytics panel.
export interface CerbosAstNode {
  operator?: string;
  operands?: CerbosAstNode[];
  variable?: string;
  value?: unknown;
}

// ─── Security Context ─────────────────────────────────────────────────────────
// Assembled by each wrapped tool executor and streamed back to the client as a
// data annotation to power the right-hand security analytics panel.
export interface SecurityContext {
  principal: {
    id: string;
    tenantId: string;
    roles: string[];
    name: string;
  };
  // Which mongodb-mcp-server tool the LLM invoked: "find" | "aggregate" | "count"
  toolName: string;
  cerbosPlanKind: string;
  cerbosRawAst: CerbosAstNode | null;
  // The security-boundary filter compiled from the Cerbos AST alone.
  // For find/count: { tenant_id, agent_id } compound.
  // For aggregate: this is the $match stage object prepended to the pipeline.
  compiledMongoFilter: Record<string, unknown>;
  // The raw filter/pipeline the LLM generated BEFORE Cerbos injection.
  // This is exactly what the LLM passed as its tool argument.
  llmGeneratedFilter: Record<string, unknown>;
  // The exact, final filter/pipeline sent to MongoDB after merging Cerbos + LLM.
  // This is what actually hits the database — the source of truth shown in Step 3.
  finalMongoQuery: Record<string, unknown>;
  queriedAt: string;
  resultCount: number;
}

// ─── Tool Execution Result ────────────────────────────────────────────────────
// Returned by every Cerbos-wrapped mongodb-mcp-server tool.
export interface McpToolResult {
  documents: InsurancePolicy[];
  security_context: SecurityContext;
  total_count: number;
  message: string;
}

// ─── Chat Data Annotation ────────────────────────────────────────────────────
// Sent as streamData alongside the AI text stream to update the analytics panel.
export interface ChatDataAnnotation {
  type: "security_context";
  payload: SecurityContext;
}

// ─── Agent Registry Entry ─────────────────────────────────────────────────────
export interface AgentRegistryEntry {
  id: string;
  name: string;
  tenantId: string;
  roles: string[];
  description: string;
  avatar: string;
  tenantColor: string;
}

// ─── Test Scenario ───────────────────────────────────────────────────────────
export interface TestScenario {
  id: string;
  agentId: string;
  prompt: string;
  expectedFilter: Record<string, unknown>;
  description: string;
  expectedResultCount: number;
}
