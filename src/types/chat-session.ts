// ─── Chat Session Document ────────────────────────────────────────────────────
// Shape of every document in the chat_sessions collection.
// The `embedding` field is stored as BSON Binary (Float32Array) in MongoDB —
// it is excluded from all API responses (never sent to the browser).
export interface ChatSession {
  _id?: string;
  session_id: string;              // uuid-v4, client-facing stable ID
  tenant_id: string;               // Cerbos security boundary
  agent_id: string;                // Ownership boundary — only this agent can read
  agent_name: string;              // e.g. "Sarah Chen"
  customer_name: string;           // entered by agent when ending session
  customer_policy_number: string | null;  // optional — links to insurance_policies
  started_at: string;              // ISO 8601 — when chat began
  ended_at: string;                // ISO 8601 — when "End Session" was clicked
  raw_transcript: string;          // full chat history as plain text
  summary: string;                 // LLM-generated 1-paragraph summary
  follow_up_actions: string[];     // LLM-extracted action items
  // embedding stored as Binary.fromFloat32Array in MongoDB — omitted from API responses
  embedding_model: string;         // "voyage-4"
}

// ─── End Session Request ──────────────────────────────────────────────────────
// Body of POST /api/chat-session — sent by the client when the agent clicks
// "End Session". The server reads the AgentSession from the httpOnly cookie.
export interface EndSessionRequest {
  transcript: string;              // Full chat history serialised as plain text
  customerName: string;            // Required — entered in the end-session modal
  customerPolicyNumber?: string;   // Optional — links to an insurance_policies doc
  startedAt: string;               // ISO 8601 — when the chat session began
}

// ─── LLM Summarisation Output ────────────────────────────────────────────────
// Structured output expected from the Azure OpenAI summarise call.
export interface SessionSummaryOutput {
  summary: string;
  follow_up_actions: string[];
}

// ─── Session Search Result ────────────────────────────────────────────────────
// Returned by POST /api/chat-session/search — the embedding field is stripped,
// a `score` field (vectorSearchScore) is added for display.
export interface SessionSearchResult {
  session_id: string;
  tenant_id: string;
  agent_id: string;
  agent_name: string;
  customer_name: string;
  customer_policy_number: string | null;
  started_at: string;
  ended_at: string;
  summary: string;
  follow_up_actions: string[];
  embedding_model: string;
  score: number;                   // cosine similarity from $vectorSearch
}

// ─── End Session API Response ─────────────────────────────────────────────────
export interface EndSessionResponse {
  session_id: string;
  summary: string;
  follow_up_actions: string[];
  saved_at: string;
}

// ─── Session Search Request ───────────────────────────────────────────────────
export interface SessionSearchRequest {
  query: string;
  limit?: number;                  // defaults to 5
}
