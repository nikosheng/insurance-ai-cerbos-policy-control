# InsureAI — Multi-Tenant Insurance AI Chat Studio

A production-pattern AI chat application demonstrating **zero-trust multi-tenant data isolation** using Cerbos ABAC, MongoDB Atlas Vector Search, and Azure OpenAI — built with Next.js 14 and the Vercel AI SDK.

---

## What This Project Demonstrates

| Capability | Technology |
|---|---|
| Multi-tenant data isolation | Cerbos ABAC — `planResources` AST compiled to MongoDB filter |
| Role-based access control | Three roles: `insurance_agent`, `tenant_admin`, `customer` |
| AI policy querying | Azure OpenAI + mongodb-mcp-server (Pattern 3 filter injection) |
| Customer service sessions | LLM summarisation → Voyage AI embedding → BSON Binary storage |
| Semantic session search | Atlas Vector Search (`$vectorSearch`) + Cerbos-governed filter |
| Live security telemetry | Cerbos AST + MongoDB pipeline visualised in real time |
| Customer portal | Separate chat UI with AI agent persona |

---

## Architecture Overview

```
Browser
├── /                    Agent login page (4 agents + test scenarios)
├── /chat                Agent chat — policies + session search unified
└── /customer            Customer login + /customer/chat

Next.js API Routes
├── /api/chat            Agent AI stream (MCP tools + search_sessions)
├── /api/customer-chat   Customer AI stream (customer-scoped MCP tools)
├── /api/chat-session    End session: summarise → embed → save
├── /api/chat-session/search  Sidebar semantic search
├── /api/customer-session     Customer httpOnly cookie management
├── /api/session         Agent httpOnly cookie management
├── /api/seed            Seed / reset 20 mock insurance policies
└── /api/setup-vector-index   Create Atlas Vector Search index

Docker Compose
├── Cerbos PDP         :3592  (HTTP)  :3593 (gRPC)
└── mongodb-mcp-server :4000  (HTTP, --readOnly)

MongoDB Atlas
├── insurance_policies   20 mock documents (2 tenants, 3 agents, 20 customers)
└── chat_sessions        Voyage AI embeddings as BSON Binary (Float32Array, 1024 dims)
```

---

## Security Architecture: Cerbos ABAC

### The Core Principle

The LLM **never sees the user's identity**. Identity is stored in an `httpOnly` cookie, read server-side, and converted to a Cerbos `planResources` call. The resulting AST is compiled to a MongoDB filter and injected into every query — before the database is touched.

```
httpOnly Cookie (never visible to LLM or browser JS)
    ↓
buildCerbosPrincipal(session)
    ↓
cerbos.planResources({ principal, resource, action })
    ↓  returns KIND_CONDITIONAL AST
planResponseToMongoFilter(ast)
    ↓  compiles AST → MongoDB filter
mergeFilters(cerbosFilter, llmFilter)
    ↓  Cerbos boundary is always the primary constraint
mongodb-mcp-server.find(securedFilter)
```

### Three Roles, Two Resources

#### Resource: `insurance_policy` (`cerbos-policies/resource_policy.yaml`)

```yaml
# Rule 1: insurance_agent — own policies only
# Compiled filter: { $and: [{ tenant_id: "Tenant_A" }, { agent_id: "agent_1" }] }
- name: agent_own_policies
  roles: [insurance_agent]
  condition:
    match:
      all:
        of:
          - expr: R.attr.tenant_id == P.attr.tenant_id
          - expr: R.attr.agent_id == P.id

# Rule 2: tenant_admin — all policies in their tenant
# Compiled filter: { tenant_id: "Tenant_A" }
- name: admin_tenant_read
  roles: [tenant_admin]
  condition:
    match:
      expr: R.attr.tenant_id == P.attr.tenant_id

# Rule 3: customer — only their own policy row
# Compiled filter: { $and: [{ tenant_id: "Tenant_A" }, { client_name: "Alice Johnson" }] }
- name: customer_own_policies
  roles: [customer]
  condition:
    match:
      all:
        of:
          - expr: R.attr.tenant_id == P.attr.tenant_id
          - expr: R.attr.client_name == P.attr.client_name
```

#### Resource: `chat_session` (`cerbos-policies/chat_session_policy.yaml`)

```yaml
# Rule 1: insurance_agent — own sessions only (agent_id + tenant_id)
# Used as $vectorSearch filter: { tenant_id: "Tenant_A", agent_id: "agent_1" }
- name: agent_own_sessions
  roles: [insurance_agent]
  condition: R.attr.tenant_id == P.attr.tenant_id AND R.attr.agent_id == P.id

# Rule 2: tenant_admin — all sessions in their tenant
# Used as $vectorSearch filter: { tenant_id: "Tenant_A" }
- name: admin_tenant_sessions
  roles: [tenant_admin]
  condition: R.attr.tenant_id == P.attr.tenant_id
```

### Why This Is Structurally Secure

- The LLM can generate any MongoDB filter it wants — `{ "tenant_id": "Tenant_B" }` is ignored because `mergeFilters()` always applies the Cerbos boundary first
- The LLM cannot read identity fields — `agent_id`, `tenant_id`, and `client_name` are never in any tool parameter schema
- For vector search, the Cerbos filter is pushed **inside** the Atlas ANN index scan via `$vectorSearch.filter` — documents outside the boundary are excluded before scoring, not post-filtered
- `planResources` is called on every tool invocation — if the Cerbos PDP is unreachable, the system fails closed with a deny-all filter `{ _id: { $in: [] } }`

### Mock Data Distribution

| Tenant | Agent ID | Agent Name | Customers | Policies |
|---|---|---|---|---|
| Tenant_A | agent_1 | Sarah Chen | Alice, Bob, Frank, Grace, Henry, Irene, Jack | 7 |
| Tenant_A | agent_2 | Marcus Rivera | Carol, Karen, Leo, Mia, Nathan | 5 |
| Tenant_B | agent_3 | Priya Patel | David, Olivia, Peter, Quinn, Rachel, Sam, Tina, Uma | 8 |
| Tenant_A | agent_admin_a | James Wong | — | sees all 12 Tenant_A |

---

## Vector Search: Customer Session Memory

### How Sessions Are Stored

When a customer finishes a chat via the Customer Portal (or when an agent manually ends a session), the following pipeline runs:

```
1. Azure OpenAI — summarise the transcript into 2-3 sentences
                — extract follow-up actions as a JSON array

2. Voyage AI (voyage-4, MongoDB Atlas-managed endpoint)
   — embed the combined text: summary + follow-up actions
   — input_type="document" for storage
   — produces number[1024]

3. MongoDB Atlas
   — Binary.fromFloat32Array(new Float32Array(embedding))
   — stored as BinData(0, ...) — correct format for $vectorSearch
   — saved to chat_sessions collection with tenant_id + agent_id
```

### The Vector Search Index

```json
{
  "name": "chat_session_embedding_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      { "type": "vector",  "path": "embedding",  "numDimensions": 1024, "similarity": "cosine" },
      { "type": "filter",  "path": "tenant_id" },
      { "type": "filter",  "path": "agent_id"  }
    ]
  }
}
```

`tenant_id` and `agent_id` are declared as `filter` fields — Cerbos security is enforced **inside the ANN scan**, not after. Agents cannot retrieve sessions outside their scope even if they craft a direct API call.

### How Agents Search Sessions

In the agent chat, the `search_sessions` tool is available alongside the MCP policy tools. The LLM routes to it automatically when the question is about past conversations:

```
Agent: "Any pending follow-up actions from my client sessions?"

Server:
  1. cerbos.planResources(chat_session, action="search")
     → KIND_CONDITIONAL → { tenant_id: "Tenant_A", agent_id: "agent_1" }

  2. Voyage AI: embedText("pending follow-up actions", input_type="query")
     → number[1024]

  3. $vectorSearch pipeline:
     [
       { $vectorSearch: { index: "...", queryVector: [...], filter: { tenant_id, agent_id } } },
       { $addFields: { score: { $meta: "vectorSearchScore" } } },
       { $unset: ["embedding", "raw_transcript"] }
     ]

  4. Results returned to LLM — agent sees matching sessions with summaries + actions
```

The right-hand **Security Analytics Panel** in the chat UI shows:
- Cerbos AST from `planResources` on `chat_session`
- Voyage query input (what the LLM passed)
- Full `$vectorSearch` pipeline sent to `db.chat_sessions.aggregate()`

---

## Setup

### Prerequisites

- Node.js 22+
- Docker Desktop
- MongoDB Atlas cluster (free tier works)
- Azure OpenAI resource with a chat deployment
- MongoDB Atlas Model API Key (for Voyage AI)

### 1. Clone and install

```bash
git clone https://github.com/your-org/mongodb-cerbos-mcp
cd mongodb-cerbos-mcp
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```bash
# Azure OpenAI
AZURE_OPENAI_RESOURCE_NAME=your-resource-name
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=your-deployment-name

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=insurance_cerbos_ai

# Cerbos PDP (Docker)
CERBOS_URL=http://localhost:3592

# mongodb-mcp-server (Docker)
MDB_MCP_SERVER_URL=http://localhost:4000/mcp

# Session secret — generate with: openssl rand -hex 32
SESSION_SECRET=your-random-secret

# Voyage AI (MongoDB Atlas Model API Key)
# Create in: Atlas UI → Voyage AI → API Keys
VOYAGE_ENDPOINT=https://ai.mongodb.com/v1/embeddings
VOYAGE_API_KEY=your-atlas-model-api-key
```

### 3. Start infrastructure

```bash
make up          # starts Cerbos + mongodb-mcp-server containers
```

### 4. Start the app

```bash
make dev         # Next.js on port 3888
# or
make boot        # up + dev in one command
```

### 5. Seed the database

```bash
make seed        # inserts 20 mock insurance policies (idempotent)
```

### 6. Create the Vector Search index

```bash
make vector-index   # calls GET /api/setup-vector-index
```

Wait ~2 minutes for Atlas to build the index (check Atlas UI → Search Indexes → READY).

---

## Demo Walkthrough

### Phase 1: Agent Policy Queries (Cerbos ABAC)

**Login as Sarah Chen** (agent_1, Tenant_A, `insurance_agent` role)

Try these questions in the chat:

| Question | What to observe |
|---|---|
| `Show me all my clients' policies` | Returns 7 policies — Cerbos filter `{ tenant_id: "Tenant_A", agent_id: "agent_1" }` visible in analytics panel |
| `Show me Alice Johnson's policy details` | AI calls `collection_schema` first (mandatory), then `find({ client_name: "Alice Johnson" })` |
| `How many active auto policies do I have?` | Uses `count` tool with merged Cerbos + LLM filter |
| `Which of my policies expire before 2026?` | Date range filter merged with security boundary |
| `Show me policies from Tenant B` | Returns 0 — Cerbos `tenant_id` boundary cannot be bypassed |

**Switch to Marcus Rivera** (agent_2, Tenant_A) via Test Cases dropdown:

| Question | What to observe |
|---|---|
| `What about Bob Smith's home insurance?` | Returns 0 — Bob belongs to agent_1, cross-agent isolation enforced |
| `List all policies under my name` | Returns 5 — only agent_2's clients |

**Switch to James Wong** (admin, Tenant_A, `tenant_admin` role):

| Question | What to observe |
|---|---|
| `Show me all policies across all agents` | Returns 12 — Cerbos filter is `{ tenant_id: "Tenant_A" }` only (no agent_id clause) |
| `Show me Sarah Chen's policies` | Filter includes `agent_name: "Sarah Chen"` — admin can filter by agent |
| `Show me David Brown's policy from Tenant B` | Returns 0 — tenant boundary enforced even for admin |

---

### Phase 2: Customer Service Session (Vector Search)

**Step 1 — Create a customer chat session**

1. Open the Customer Portal: click **"Open Customer Portal"** on the landing page, or go to `http://localhost:3888/customer`
2. Select **Alice Johnson** from the dropdown → click **Start Chat**
3. Chat with "Sarah Chen" (the AI agent persona):
   - `What insurance do I have?`
   - `What is my deductible?`
   - `When does my policy expire?`
4. Click **End Chat** — the transcript is summarised, embedded with Voyage AI, and saved to `chat_sessions`

**Step 2 — Check what was saved in Atlas**

In MongoDB Atlas UI → Browse Collections → `insurance_cerbos_ai` → `chat_sessions`:
- The `embedding` field shows as `BinData(0, ...)` — confirming `Binary.fromFloat32Array` is working
- `summary` contains the LLM-generated paragraph
- `follow_up_actions` contains extracted action items

**Step 3 — Search sessions from the agent chat**

1. Go back to the agent chat (`http://localhost:3888/chat`) and log in as **Sarah Chen**
2. Ask one of these questions — the LLM automatically calls `search_sessions`:

| Question | What to observe |
|---|---|
| `What did I discuss with Alice Johnson last time?` | Vector search returns Alice's session with summary + actions |
| `Show me any pending follow-up actions from my client sessions` | Matches sessions where follow-up actions were extracted |
| `Any clients who asked about deductibles?` | Semantic match on conversation content |
| `Which customers called about policy expiry?` | Matches sessions discussing renewal or expiry dates |

3. The **Vector Search Pipeline** section in the analytics panel shows:
   - **Cerbos AST** from `planResources` on `chat_session` resource
   - **Voyage Query Input** — natural language query the LLM passed
   - **Final `$vectorSearch` Pipeline** — `db.chat_sessions.aggregate([...])` with the security filter embedded

**Step 4 — Verify cross-agent isolation**

1. Log out, log in as **Marcus Rivera** (agent_2, same tenant)
2. Ask: `What did I discuss with Alice Johnson last time?`
3. **Expected: 0 results** — Alice's session was created under agent_1's scope. Marcus's `$vectorSearch` filter is `{ tenant_id: "Tenant_A", agent_id: "agent_2" }` — agent_1's sessions are excluded at the ANN index scan level.

**Step 5 — Admin sees across agents**

1. Log in as **James Wong** (admin, Tenant_A)
2. Ask: `Show me all recent customer service sessions`
3. **Expected: Alice's session appears** — admin filter is `{ tenant_id: "Tenant_A" }` only, no `agent_id` restriction.

---

## Demo Questions Reference

### Agent Chat — Policy Queries

```
# Basic retrieval
Show me all my clients' policies
Show me Alice Johnson's policy details
What is Bob Smith's home insurance deductible?
List all my active policies

# Filtering
Show me only active auto insurance policies
Which policies expire before 2027?
Find any cancelled policies in my portfolio
Show policies with coverage over $200,000

# Aggregation
What is the average premium across my portfolio?
Summarize my portfolio by policy type
How many active auto policies do I have?
What is my total coverage amount?

# Cross-boundary attempts (should return 0)
Show me policies from Tenant B                    # blocked by tenant_id
Show me Bob Smith's policy (as Marcus Rivera)     # blocked by agent_id
```

### Agent Chat — Session Search

```
# Find past conversations
What did I discuss with Alice Johnson last time?
Any past sessions about claim disputes?
Show me conversations about policy renewals
Which customers called about deductibles?

# Find follow-up actions
Show me pending follow-up actions from my sessions
What tasks do I still need to complete for my clients?
Any sessions where I promised to send documents?
Which clients need a callback?

# Combined (policy + session)
Show me Alice Johnson's current policy — then what did we discuss last time?
Which of my clients with Life policies have had service issues?
```

### Admin Chat — Cross-Agent Visibility

```
Show me all policies across all agents in Tenant A
Show me Sarah Chen's client portfolio
How many policies does each agent manage?
Compare premiums across agents in my tenant
Show me all customer service sessions this week
Which agent had the most client issues?

# Still blocked (cross-tenant)
Show me Tenant B policies    # returns 0
```

### Customer Portal

```
What insurance do I have?
What is my deductible?
When does my policy expire?
How much is my monthly premium?
What does my Auto policy cover?
Is my policy still active?
How do I make a claim?
```

---

## Makefile Commands

```bash
make up           # Start Cerbos + mongodb-mcp-server containers
make down         # Stop containers
make restart      # down + up
make logs         # Tail all container logs
make status       # Show container health

make dev          # Start Next.js dev server (port 3888)
make build        # Production build
make boot         # up + dev (one command start)

make seed         # Seed 20 mock policies (idempotent)
make reset        # Drop + re-seed all policies
make db-count     # Show document count
make vector-index # Create Atlas Vector Search index

make mcp-status   # Check mongodb-mcp-server health
make mcp-logs     # Tail mongodb-mcp-server logs
make nuke         # Stop containers + delete volumes
```

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Agent login page
│   ├── chat/page.tsx               # Agent chat UI + security analytics panel
│   ├── customer/
│   │   ├── page.tsx                # Customer login (dropdown, no password)
│   │   └── chat/page.tsx           # Customer chat UI (simplified)
│   └── api/
│       ├── chat/route.ts           # Agent AI stream + search_sessions tool
│       ├── customer-chat/route.ts  # Customer AI stream
│       ├── chat-session/route.ts   # End session: summarise → embed → save
│       ├── chat-session/search/    # Sidebar semantic search
│       ├── customer-session/       # Customer cookie management
│       ├── session/route.ts        # Agent cookie management
│       ├── seed/route.ts           # Seed / reset mock data
│       └── setup-vector-index/     # Create Atlas Vector Search index
├── lib/
│   ├── agents.ts                   # Agent registry + roles (edit here to change roles)
│   ├── customers.ts                # Customer registry (20 mock customers)
│   ├── cerbos.ts                   # Cerbos HTTP client + principal builders
│   ├── ast-to-mongo.ts             # Cerbos AST → MongoDB filter compiler
│   ├── db.ts                       # MongoDB client + 20 mock insurance policies
│   ├── chatSessions.ts             # chat_sessions CRUD + vectorSearchSessions()
│   ├── voyage.ts                   # Voyage AI embedding client
│   └── session.ts                  # httpOnly cookie readers (agent + customer)
├── mcp/
│   └── mcpServer.ts                # Cerbos-wrapped MCP tools (find/aggregate/count)
│                                   # + createCerbosWrappedToolsForCustomer()
└── types/
    ├── index.ts                    # AgentSession, CustomerSession, SecurityContext...
    └── chat-session.ts             # ChatSession, SessionSearchResult...

cerbos-policies/
├── resource_policy.yaml            # insurance_policy: agent + admin + customer rules
└── chat_session_policy.yaml        # chat_session: agent + admin rules
```

---

## Key Design Decisions

### Pattern 3: Filter Injection

The LLM generates real MongoDB MQL via the mongodb-mcp-server tools. The Cerbos filter is injected **server-side** before the query reaches MongoDB — the LLM cannot influence the security boundary under any circumstance.

```
LLM generates: { "status": "Active" }
Cerbos provides: { "$and": [{ "tenant_id": "Tenant_A" }, { "agent_id": "agent_1" }] }
Merged:         { "$and": [{ "tenant_id": "Tenant_A" }, { "agent_id": "agent_1" }, { "status": "Active" }] }
```

### BSON Binary Float32 for Embeddings

Embeddings are stored as `Binary.fromFloat32Array(new Float32Array(embedding))` — `BinData(0, ...)` subtype. This is the correct representation for Atlas Vector Search and is significantly more storage-efficient than JSON float arrays.

### Voyage `input_type` Distinction

- **Storing** (chat session end): `embedText(text, "document")` — Voyage prepends *"Represent the document for retrieval: "*
- **Querying** (agent search): `embedText(query, "query")` — Voyage prepends *"Represent the query for retrieving supporting documents: "*

This asymmetry significantly improves retrieval quality.

### Single Source of Truth for Access Policy

`search_sessions` calls `cerbos.planResources()` on the `chat_session` resource (not a hardcoded `if/else`). This means Cerbos YAML is the single authoritative source — adding a new role to `chat_session_policy.yaml` automatically propagates without any code change.

### Mandatory Schema Check

The system prompt mandates that the LLM calls `collection_schema` before every `find`/`aggregate`/`count` call. This prevents field name guessing errors (e.g. using `customer_name` instead of `client_name`).

---

## Configuring Agent Roles

To change a user's role or add a new agent, edit `src/lib/agents.ts`:

```typescript
export const AGENT_REGISTRY = {
  agent_1: {
    id: "agent_1",
    name: "Sarah Chen",
    tenantId: "Tenant_A",
    roles: ["insurance_agent"],   // ← change role here
    ...
  },
  agent_admin_a: {
    id: "agent_admin_a",
    name: "James Wong",
    tenantId: "Tenant_A",
    roles: ["tenant_admin"],      // ← tenant_admin sees all in Tenant_A
    ...
  },
}
```

Valid roles: `insurance_agent` · `tenant_admin` · `customer` (customer role is set in `src/lib/customers.ts`)

The role propagates automatically through the cookie → Cerbos principal → policy rules → compiled MongoDB filter chain. No other files need changing.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| AI Streaming | Vercel AI SDK v3 (`ai@3.x`), `useChat` |
| LLM | Azure OpenAI (configurable deployment) |
| MCP | `@ai-sdk/mcp` HTTP transport → `mongodb-mcp-server@2.1.0` |
| Authorization | Cerbos v0.55+ (`@cerbos/http`, `@cerbos/core`) |
| Database | MongoDB Atlas (Node.js driver v6) |
| Vector Embeddings | Voyage AI `voyage-4` via MongoDB Atlas managed endpoint |
| Vector Search | Atlas Vector Search (`$vectorSearch`, 1024-dim cosine) |
| Session | httpOnly cookies, `SameSite=Strict` |
| Infrastructure | Docker Compose (Cerbos + mongodb-mcp-server) |
