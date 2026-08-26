// ─── Agent Registry (browser-safe — no Node.js imports) ──────────────────────
// This file can be imported by both server and client components safely.
// It contains only static data with no mongodb / @cerbos dependencies.

export const AGENT_REGISTRY = {
  agent_1: {
    id: "agent_1",
    name: "Sarah Chen",
    displayName: "Agent 1 — Sarah Chen",
    tenantId: "Tenant_A",
    roles: ["insurance_agent"],
    description: "Senior agent handling Auto & Home portfolios for Tenant A.",
    initials: "SC",
    tenantLabel: "Tenant A",
    tenantColor: "indigo",
  },
  agent_2: {
    id: "agent_2",
    name: "Marcus Rivera",
    displayName: "Agent 2 — Marcus Rivera",
    tenantId: "Tenant_A",
    roles: ["insurance_agent"],
    description: "Life insurance specialist with Tenant A. Manages long-term policies.",
    initials: "MR",
    tenantLabel: "Tenant A",
    tenantColor: "indigo",
  },
  agent_3: {
    id: "agent_3",
    name: "Priya Patel",
    displayName: "Agent 3 — Priya Patel",
    tenantId: "Tenant_B",
    roles: ["insurance_agent"],
    description: "Commercial vehicle specialist. Sole agent for Tenant B portfolio.",
    initials: "PP",
    tenantLabel: "Tenant B",
    tenantColor: "violet",
  },
  // ── Tenant Admin ─────────────────────────────────────────────────────────────
  // Holds the "tenant_admin" role. Cerbos rule 2 (admin_tenant_read) fires:
  //   planResources → KIND_CONDITIONAL → { tenant_id: "Tenant_A" }
  // Sees ALL policies in Tenant_A regardless of agent_id, but ZERO Tenant_B data.
  agent_admin_a: {
    id: "agent_admin_a",
    name: "James Wong",
    displayName: "Admin A — James Wong",
    tenantId: "Tenant_A",
    roles: ["tenant_admin"],
    description: "Tenant A administrator. Full read access across all Tenant A agents. Cerbos rule: admin_tenant_read.",
    initials: "JW",
    tenantLabel: "Tenant A",
    tenantColor: "emerald",
  },
} as const;

export type AgentId = keyof typeof AGENT_REGISTRY;

export type AgentEntry = (typeof AGENT_REGISTRY)[AgentId];

export function buildSessionFromAgentId(agentId: AgentId) {
  const agent = AGENT_REGISTRY[agentId];
  return {
    id: agent.id,
    name: agent.displayName,
    tenantId: agent.tenantId,
    roles: [...agent.roles] as string[],
  };
}

// ─── Test Scenarios (browser-safe) ───────────────────────────────────────────

export const TEST_SCENARIOS = [
  {
    id: "tc_01",
    agentId: "agent_1",
    label: "TC-01: Agent 1 — All Policies",
    prompt: "Show me all my clients' policies.",
    description: "Returns Alice Johnson (Auto) + Bob Smith (Home) + Frank Miller (Life) + more. Tenant_A / agent_1 scope only.",
    expectedCount: 7,
  },
  {
    id: "tc_02",
    agentId: "agent_1",
    label: "TC-02: Agent 1 — Active Auto Only",
    prompt: "Show me only active auto insurance policies.",
    description: "Returns only Alice Johnson. Bob Smith is Pending, Grace Liu is Cancelled.",
    expectedCount: 1,
  },
  {
    id: "tc_03",
    agentId: "agent_2",
    label: "TC-03: Agent 2 — All Policies",
    prompt: "List all policies under my name.",
    description: "Returns Carol White, Karen Adams, Leo Nguyen, Mia Pham, Nathan Brooks. agent_2 scope enforced.",
    expectedCount: 5,
  },
  {
    id: "tc_04",
    agentId: "agent_2",
    label: "TC-04: Agent 2 — Cross-Agent Isolation",
    prompt: "What about Bob Smith's home insurance? Can you find it?",
    description: "Zero results — Bob belongs to agent_1, not agent_2. ABAC cross-agent isolation enforced.",
    expectedCount: 0,
  },
  {
    id: "tc_05",
    agentId: "agent_3",
    label: "TC-05: Agent 3 — All Policies",
    prompt: "Summarize all my clients and their coverage.",
    description: "Returns all 8 Tenant_B policies (David, Olivia, Peter, Quinn, Rachel, Samuel, Tina, Uma).",
    expectedCount: 8,
  },
  {
    id: "tc_06",
    agentId: "agent_3",
    label: "TC-06: Agent 3 — Cross-Tenant Attempt",
    prompt: "Show me policies from Tenant A.",
    description: "Zero results — Cerbos anchors tenant_id=Tenant_B in the MongoDB filter regardless of the prompt.",
    expectedCount: 0,
  },
  {
    id: "tc_07",
    agentId: "agent_1",
    label: "TC-07: Agent 1 — Cancelled Policies",
    prompt: "Find any cancelled policies in my portfolio.",
    description: "Returns Grace Liu (Cancelled Auto). Status filter applied on top of Cerbos security filter.",
    expectedCount: 1,
  },
  {
    id: "tc_08",
    agentId: "agent_admin_a",
    label: "TC-08: Admin A — Full Tenant Visibility",
    prompt: "Show me all policies across all agents in my organisation.",
    description: "Returns all 12 Tenant_A policies (agent_1 + agent_2). Cerbos filter: { tenant_id: Tenant_A } — no agent_id clause.",
    expectedCount: 12,
  },
  {
    id: "tc_09",
    agentId: "agent_admin_a",
    label: "TC-09: Admin A — Cross-Tenant Isolation",
    prompt: "Can you show me David Brown's auto policy from Tenant B?",
    description: "Zero results — Cerbos still enforces tenant boundary for admin. Tenant_B data is unreachable.",
    expectedCount: 0,
  },
] as const;
