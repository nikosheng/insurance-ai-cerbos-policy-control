// ─── Customer Registry (browser-safe) ────────────────────────────────────────
// Static mapping of every mock customer to their assigned agent.
// Derived directly from the 20 MOCK_POLICIES in db.ts — no extra DB needed.
//
// Cerbos principal built from this:
//   { id: clientId,  roles: ["customer"],
//     attr: { tenant_id, client_name } }
//
// The customer rule in resource_policy.yaml compares:
//   R.attr.client_name == P.attr.client_name  AND
//   R.attr.tenant_id   == P.attr.tenant_id
// which compiles to: { client_name: "Alice Johnson", tenant_id: "Tenant_A" }

import type { CustomerSession } from "@/types";

export interface CustomerEntry {
  clientId: string;       // URL-safe slug, used as Cerbos P.id
  clientName: string;     // Full name matching policy.client_name exactly
  clientEmail: string;
  agentId: string;        // Assigned agent
  agentName: string;      // AI persona shown to customer
  tenantId: string;
  policyNumber: string;   // Primary policy number (for display)
  policyType: string;     // "Auto" | "Home" | "Life"
}

// ─── All 20 mock customers ────────────────────────────────────────────────────
// Grouped by agent for the dropdown UI.

export const CUSTOMER_REGISTRY: CustomerEntry[] = [
  // ── Sarah Chen (agent_1, Tenant_A) ────────────────────────────────────────
  {
    clientId: "alice-johnson",
    clientName: "Alice Johnson",
    clientEmail: "alice.johnson@email.com",
    agentId: "agent_1",
    agentName: "Sarah Chen",
    tenantId: "Tenant_A",
    policyNumber: "INS-2024-001",
    policyType: "Auto",
  },
  {
    clientId: "bob-smith",
    clientName: "Bob Smith",
    clientEmail: "bob.smith@email.com",
    agentId: "agent_1",
    agentName: "Sarah Chen",
    tenantId: "Tenant_A",
    policyNumber: "INS-2024-002",
    policyType: "Home",
  },
  {
    clientId: "frank-miller",
    clientName: "Frank Miller",
    clientEmail: "frank.miller@email.com",
    agentId: "agent_1",
    agentName: "Sarah Chen",
    tenantId: "Tenant_A",
    policyNumber: "INS-2024-005",
    policyType: "Life",
  },
  {
    clientId: "grace-liu",
    clientName: "Grace Liu",
    clientEmail: "grace.liu@email.com",
    agentId: "agent_1",
    agentName: "Sarah Chen",
    tenantId: "Tenant_A",
    policyNumber: "INS-2024-006",
    policyType: "Auto",
  },
  {
    clientId: "henry-park",
    clientName: "Henry Park",
    clientEmail: "henry.park@email.com",
    agentId: "agent_1",
    agentName: "Sarah Chen",
    tenantId: "Tenant_A",
    policyNumber: "INS-2024-007",
    policyType: "Home",
  },
  {
    clientId: "irene-costa",
    clientName: "Irene Costa",
    clientEmail: "irene.costa@email.com",
    agentId: "agent_1",
    agentName: "Sarah Chen",
    tenantId: "Tenant_A",
    policyNumber: "INS-2024-008",
    policyType: "Auto",
  },
  {
    clientId: "jack-turner",
    clientName: "Jack Turner",
    clientEmail: "jack.turner@email.com",
    agentId: "agent_1",
    agentName: "Sarah Chen",
    tenantId: "Tenant_A",
    policyNumber: "INS-2024-009",
    policyType: "Home",
  },

  // ── Marcus Rivera (agent_2, Tenant_A) ─────────────────────────────────────
  {
    clientId: "carol-white",
    clientName: "Carol White",
    clientEmail: "carol.white@email.com",
    agentId: "agent_2",
    agentName: "Marcus Rivera",
    tenantId: "Tenant_A",
    policyNumber: "INS-2024-003",
    policyType: "Life",
  },
  {
    clientId: "karen-adams",
    clientName: "Karen Adams",
    clientEmail: "karen.adams@email.com",
    agentId: "agent_2",
    agentName: "Marcus Rivera",
    tenantId: "Tenant_A",
    policyNumber: "INS-2024-010",
    policyType: "Life",
  },
  {
    clientId: "leo-nguyen",
    clientName: "Leo Nguyen",
    clientEmail: "leo.nguyen@email.com",
    agentId: "agent_2",
    agentName: "Marcus Rivera",
    tenantId: "Tenant_A",
    policyNumber: "INS-2024-011",
    policyType: "Auto",
  },
  {
    clientId: "mia-pham",
    clientName: "Mia Pham",
    clientEmail: "mia.pham@email.com",
    agentId: "agent_2",
    agentName: "Marcus Rivera",
    tenantId: "Tenant_A",
    policyNumber: "INS-2024-012",
    policyType: "Home",
  },
  {
    clientId: "nathan-brooks",
    clientName: "Nathan Brooks",
    clientEmail: "nathan.brooks@email.com",
    agentId: "agent_2",
    agentName: "Marcus Rivera",
    tenantId: "Tenant_A",
    policyNumber: "INS-2024-013",
    policyType: "Life",
  },

  // ── Priya Patel (agent_3, Tenant_B) ───────────────────────────────────────
  {
    clientId: "david-brown",
    clientName: "David Brown",
    clientEmail: "david.brown@email.com",
    agentId: "agent_3",
    agentName: "Priya Patel",
    tenantId: "Tenant_B",
    policyNumber: "INS-2024-004",
    policyType: "Auto",
  },
  {
    clientId: "olivia-santos",
    clientName: "Olivia Santos",
    clientEmail: "olivia.santos@email.com",
    agentId: "agent_3",
    agentName: "Priya Patel",
    tenantId: "Tenant_B",
    policyNumber: "INS-2024-014",
    policyType: "Home",
  },
  {
    clientId: "peter-walsh",
    clientName: "Peter Walsh",
    clientEmail: "peter.walsh@email.com",
    agentId: "agent_3",
    agentName: "Priya Patel",
    tenantId: "Tenant_B",
    policyNumber: "INS-2024-015",
    policyType: "Life",
  },
  {
    clientId: "quinn-foster",
    clientName: "Quinn Foster",
    clientEmail: "quinn.foster@email.com",
    agentId: "agent_3",
    agentName: "Priya Patel",
    tenantId: "Tenant_B",
    policyNumber: "INS-2024-016",
    policyType: "Auto",
  },
  {
    clientId: "rachel-kim",
    clientName: "Rachel Kim",
    clientEmail: "rachel.kim@email.com",
    agentId: "agent_3",
    agentName: "Priya Patel",
    tenantId: "Tenant_B",
    policyNumber: "INS-2024-017",
    policyType: "Home",
  },
  {
    clientId: "sam-torres",
    clientName: "Sam Torres",
    clientEmail: "sam.torres@email.com",
    agentId: "agent_3",
    agentName: "Priya Patel",
    tenantId: "Tenant_B",
    policyNumber: "INS-2024-018",
    policyType: "Life",
  },
  {
    clientId: "tina-okafor",
    clientName: "Tina Okafor",
    clientEmail: "tina.okafor@email.com",
    agentId: "agent_3",
    agentName: "Priya Patel",
    tenantId: "Tenant_B",
    policyNumber: "INS-2024-019",
    policyType: "Auto",
  },
  {
    clientId: "uma-sharma",
    clientName: "Uma Sharma",
    clientEmail: "uma.sharma@email.com",
    agentId: "agent_3",
    agentName: "Priya Patel",
    tenantId: "Tenant_B",
    policyNumber: "INS-2024-020",
    policyType: "Life",
  },
];

// ─── Lookup by clientId ───────────────────────────────────────────────────────
export function getCustomerById(clientId: string): CustomerEntry | undefined {
  return CUSTOMER_REGISTRY.find((c) => c.clientId === clientId);
}

// ─── Build CustomerSession from registry entry ────────────────────────────────
export function buildCustomerSession(entry: CustomerEntry): CustomerSession {
  return {
    clientId: entry.clientId,
    clientName: entry.clientName,
    clientEmail: entry.clientEmail,
    agentId: entry.agentId,
    agentName: entry.agentName,
    tenantId: entry.tenantId,
    roles: ["customer"],
  };
}

// ─── Grouped by agent (for the dropdown UI) ───────────────────────────────────
export interface CustomerGroup {
  agentId: string;
  agentName: string;
  tenantId: string;
  customers: CustomerEntry[];
}

export function getCustomerGroups(): CustomerGroup[] {
  const groups: Record<string, CustomerGroup> = {};
  for (const c of CUSTOMER_REGISTRY) {
    if (!groups[c.agentId]) {
      groups[c.agentId] = {
        agentId: c.agentId,
        agentName: c.agentName,
        tenantId: c.tenantId,
        customers: [],
      };
    }
    groups[c.agentId].customers.push(c);
  }
  return Object.values(groups);
}
