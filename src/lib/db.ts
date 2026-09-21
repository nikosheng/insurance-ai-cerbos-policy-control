import { MongoClient, Db, Document } from "mongodb";
import type { Activity, Customer, Deal, InsurancePolicy } from "@/types";
import { CUSTOMER_REGISTRY } from "./customers";
import { ACTIVITIES_COLLECTION, CUSTOMERS_COLLECTION, DEALS_COLLECTION, seedCrmData } from "./crm";

// ─── In-Memory Mock Data ───────────────────────────────────────────────────────
// 20 policies across 2 tenants and 3 agents.
// Distribution:
//   Tenant_A / agent_1 → 7 policies (Alice, Bob, Frank, Grace, Henry, Irene, Jack)
//   Tenant_A / agent_2 → 5 policies (Carol, Karen, Leo, Mia, Nathan)
//   Tenant_B / agent_3 → 8 policies (David, Olivia, Peter, Quinn, Rachel, Sam, Tina, Uma)

const MOCK_POLICIES: InsurancePolicy[] = [
  // ── Tenant_A / agent_1 ────────────────────────────────────────────────────
  {
    _id: "pol_001",
    policy_number: "INS-2024-001",
    client_name: "Alice Johnson",
    client_email: "alice.johnson@email.com",
    policy_type: "Auto",
    coverage_amount: 50000,
    premium_monthly: 120,
    deductible: 500,
    status: "Active",
    start_date: "2024-01-15",
    end_date: "2025-01-15",
    notes: "Full coverage including collision and comprehensive. Clean driving record.",
    tenant_id: "Tenant_A",
    agent_id: "agent_1",
    agent_name: "Sarah Chen",
  },
  {
    _id: "pol_002",
    policy_number: "INS-2024-002",
    client_name: "Bob Smith",
    client_email: "bob.smith@email.com",
    policy_type: "Home",
    coverage_amount: 300000,
    premium_monthly: 85,
    deductible: 1000,
    status: "Pending",
    start_date: "2024-03-01",
    end_date: "2025-03-01",
    notes: "New construction home. Pending final inspection before activation.",
    tenant_id: "Tenant_A",
    agent_id: "agent_1",
    agent_name: "Sarah Chen",
  },
  {
    _id: "pol_005",
    policy_number: "INS-2024-005",
    client_name: "Frank Miller",
    client_email: "frank.miller@email.com",
    policy_type: "Life",
    coverage_amount: 250000,
    premium_monthly: 95,
    deductible: 0,
    status: "Active",
    start_date: "2023-11-01",
    end_date: "2033-11-01",
    notes: "10-year term life. Smoker surcharge applied. Annual review scheduled.",
    tenant_id: "Tenant_A",
    agent_id: "agent_1",
    agent_name: "Sarah Chen",
  },
  {
    _id: "pol_006",
    policy_number: "INS-2024-006",
    client_name: "Grace Liu",
    client_email: "grace.liu@email.com",
    policy_type: "Auto",
    coverage_amount: 35000,
    premium_monthly: 78,
    deductible: 500,
    status: "Cancelled",
    start_date: "2023-05-20",
    end_date: "2024-05-20",
    notes: "Policy cancelled by client. Vehicle sold. Refund of $234 issued.",
    tenant_id: "Tenant_A",
    agent_id: "agent_1",
    agent_name: "Sarah Chen",
  },
  {
    _id: "pol_007",
    policy_number: "INS-2024-007",
    client_name: "Henry Park",
    client_email: "henry.park@email.com",
    policy_type: "Home",
    coverage_amount: 550000,
    premium_monthly: 145,
    deductible: 2000,
    status: "Active",
    start_date: "2022-08-15",
    end_date: "2025-08-15",
    notes: "High-value property in flood zone. Flood rider attached. FEMA compliant.",
    tenant_id: "Tenant_A",
    agent_id: "agent_1",
    agent_name: "Sarah Chen",
  },
  {
    _id: "pol_008",
    policy_number: "INS-2024-008",
    client_name: "Irene Costa",
    client_email: "irene.costa@email.com",
    policy_type: "Auto",
    coverage_amount: 28000,
    premium_monthly: 62,
    deductible: 1000,
    status: "Expired",
    start_date: "2022-04-10",
    end_date: "2024-04-10",
    notes: "Policy expired. Client has not renewed. Follow-up required.",
    tenant_id: "Tenant_A",
    agent_id: "agent_1",
    agent_name: "Sarah Chen",
  },
  {
    _id: "pol_009",
    policy_number: "INS-2024-009",
    client_name: "Jack Turner",
    client_email: "jack.turner@email.com",
    policy_type: "Home",
    coverage_amount: 420000,
    premium_monthly: 110,
    deductible: 1500,
    status: "Pending",
    start_date: "2024-06-01",
    end_date: "2025-06-01",
    notes: "Awaiting roof inspection report before activation. Priority client.",
    tenant_id: "Tenant_A",
    agent_id: "agent_1",
    agent_name: "Sarah Chen",
  },

  // ── Tenant_A / agent_2 ────────────────────────────────────────────────────
  {
    _id: "pol_003",
    policy_number: "INS-2024-003",
    client_name: "Carol White",
    client_email: "carol.white@email.com",
    policy_type: "Life",
    coverage_amount: 500000,
    premium_monthly: 200,
    deductible: 0,
    status: "Active",
    start_date: "2023-06-10",
    end_date: "2043-06-10",
    notes: "20-year term life policy. Beneficiary: Michael White (spouse).",
    tenant_id: "Tenant_A",
    agent_id: "agent_2",
    agent_name: "Marcus Rivera",
  },
  {
    _id: "pol_010",
    policy_number: "INS-2024-010",
    client_name: "Karen Adams",
    client_email: "karen.adams@email.com",
    policy_type: "Life",
    coverage_amount: 1000000,
    premium_monthly: 380,
    deductible: 0,
    status: "Active",
    start_date: "2021-09-01",
    end_date: "2051-09-01",
    notes: "Whole life policy. Cash value accumulation active. VIP client — quarterly review.",
    tenant_id: "Tenant_A",
    agent_id: "agent_2",
    agent_name: "Marcus Rivera",
  },
  {
    _id: "pol_011",
    policy_number: "INS-2024-011",
    client_name: "Leo Nguyen",
    client_email: "leo.nguyen@email.com",
    policy_type: "Auto",
    coverage_amount: 42000,
    premium_monthly: 98,
    deductible: 750,
    status: "Active",
    start_date: "2024-02-01",
    end_date: "2025-02-01",
    notes: "Electric vehicle — reduced premium rate applied. Telematics enrolled.",
    tenant_id: "Tenant_A",
    agent_id: "agent_2",
    agent_name: "Marcus Rivera",
  },
  {
    _id: "pol_012",
    policy_number: "INS-2024-012",
    client_name: "Mia Pham",
    client_email: "mia.pham@email.com",
    policy_type: "Home",
    coverage_amount: 680000,
    premium_monthly: 175,
    deductible: 2500,
    status: "Pending",
    start_date: "2024-07-15",
    end_date: "2025-07-15",
    notes: "Luxury condo. Contents rider pending valuation. Smart home discount applied.",
    tenant_id: "Tenant_A",
    agent_id: "agent_2",
    agent_name: "Marcus Rivera",
  },
  {
    _id: "pol_013",
    policy_number: "INS-2024-013",
    client_name: "Nathan Brooks",
    client_email: "nathan.brooks@email.com",
    policy_type: "Life",
    coverage_amount: 150000,
    premium_monthly: 55,
    deductible: 0,
    status: "Cancelled",
    start_date: "2023-01-20",
    end_date: "2038-01-20",
    notes: "Cancelled mid-term due to non-payment. 60-day grace period exhausted.",
    tenant_id: "Tenant_A",
    agent_id: "agent_2",
    agent_name: "Marcus Rivera",
  },

  // ── Tenant_B / agent_3 ────────────────────────────────────────────────────
  {
    _id: "pol_004",
    policy_number: "INS-2024-004",
    client_name: "David Brown",
    client_email: "david.brown@email.com",
    policy_type: "Auto",
    coverage_amount: 45000,
    premium_monthly: 110,
    deductible: 750,
    status: "Active",
    start_date: "2024-02-20",
    end_date: "2025-02-20",
    notes: "Commercial vehicle policy. Includes roadside assistance.",
    tenant_id: "Tenant_B",
    agent_id: "agent_3",
    agent_name: "Priya Patel",
  },
  {
    _id: "pol_014",
    policy_number: "INS-2024-014",
    client_name: "Olivia Santos",
    client_email: "olivia.santos@email.com",
    policy_type: "Home",
    coverage_amount: 390000,
    premium_monthly: 102,
    deductible: 1000,
    status: "Active",
    start_date: "2023-03-15",
    end_date: "2026-03-15",
    notes: "3-year policy. Multi-policy discount applied (also holds Auto with us).",
    tenant_id: "Tenant_B",
    agent_id: "agent_3",
    agent_name: "Priya Patel",
  },
  {
    _id: "pol_015",
    policy_number: "INS-2024-015",
    client_name: "Peter Walsh",
    client_email: "peter.walsh@email.com",
    policy_type: "Life",
    coverage_amount: 750000,
    premium_monthly: 290,
    deductible: 0,
    status: "Active",
    start_date: "2022-12-01",
    end_date: "2042-12-01",
    notes: "20-year term. Business owner policy. Key-person rider attached.",
    tenant_id: "Tenant_B",
    agent_id: "agent_3",
    agent_name: "Priya Patel",
  },
  {
    _id: "pol_016",
    policy_number: "INS-2024-016",
    client_name: "Quinn Foster",
    client_email: "quinn.foster@email.com",
    policy_type: "Auto",
    coverage_amount: 60000,
    premium_monthly: 155,
    deductible: 500,
    status: "Pending",
    start_date: "2024-08-01",
    end_date: "2025-08-01",
    notes: "New customer. MVR check in progress. Provisional policy issued.",
    tenant_id: "Tenant_B",
    agent_id: "agent_3",
    agent_name: "Priya Patel",
  },
  {
    _id: "pol_017",
    policy_number: "INS-2024-017",
    client_name: "Rachel Kim",
    client_email: "rachel.kim@email.com",
    policy_type: "Home",
    coverage_amount: 275000,
    premium_monthly: 72,
    deductible: 750,
    status: "Cancelled",
    start_date: "2023-07-01",
    end_date: "2024-07-01",
    notes: "Cancelled — property sold. Pro-rated refund of $189 processed.",
    tenant_id: "Tenant_B",
    agent_id: "agent_3",
    agent_name: "Priya Patel",
  },
  {
    _id: "pol_018",
    policy_number: "INS-2024-018",
    client_name: "Samuel Wright",
    client_email: "samuel.wright@email.com",
    policy_type: "Auto",
    coverage_amount: 22000,
    premium_monthly: 55,
    deductible: 1000,
    status: "Expired",
    start_date: "2022-01-10",
    end_date: "2024-01-10",
    notes: "Expired. Client is shopping for new vehicle. Renewal quote sent.",
    tenant_id: "Tenant_B",
    agent_id: "agent_3",
    agent_name: "Priya Patel",
  },
  {
    _id: "pol_019",
    policy_number: "INS-2024-019",
    client_name: "Tina Morrison",
    client_email: "tina.morrison@email.com",
    policy_type: "Life",
    coverage_amount: 200000,
    premium_monthly: 75,
    deductible: 0,
    status: "Active",
    start_date: "2024-04-01",
    end_date: "2034-04-01",
    notes: "10-year term. Non-smoker discount applied. Automatic payment enrolled.",
    tenant_id: "Tenant_B",
    agent_id: "agent_3",
    agent_name: "Priya Patel",
  },
  {
    _id: "pol_020",
    policy_number: "INS-2024-020",
    client_name: "Uma Patel",
    client_email: "uma.patel@email.com",
    policy_type: "Home",
    coverage_amount: 820000,
    premium_monthly: 210,
    deductible: 3000,
    status: "Active",
    start_date: "2023-10-15",
    end_date: "2026-10-15",
    notes: "High-value home. Jewellery and art rider. Annual appraisal required.",
    tenant_id: "Tenant_B",
    agent_id: "agent_3",
    agent_name: "Priya Patel",
  },
];

// ─── MongoDB Client Singleton ──────────────────────────────────────────────────

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

// Guards auto-seed so it only fires once per process lifetime,
// not on every incoming request.
let dbSeeded = false;

async function connectToMongo(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const uri = process.env.MONGODB_URI!;
  const dbName = process.env.MONGODB_DB_NAME || "insurance_db";

  const client = new MongoClient(uri, {
    // Increased for Atlas: SRV lookup + TLS handshake adds latency vs local.
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  await client.connect();
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

// ─── Database Seeder ───────────────────────────────────────────────────────────
// Deterministic demo reset. Every invocation clears and recreates every
// Customer 360 collection so new schema/data changes are always applied.

export interface SeedResult {
  insurance_policies: number;
  customers: number;
  deals: number;
  activities: number;
}

export async function seedDatabase(): Promise<SeedResult> {
  const { db } = await connectToMongo();
  const collection = db.collection<Document>("insurance_policies");

  const customers: Customer[] = CUSTOMER_REGISTRY.map((entry, index) => ({
    customer_id: entry.clientId,
    full_name: entry.clientName,
    email: entry.clientEmail,
    phone: `+1-555-01${String(index + 10).padStart(2, "0")}`,
    lifecycle_stage: index % 6 === 0 ? "At Risk" : index % 5 === 0 ? "Renewal" : "Active",
    preferred_contact_method: index % 3 === 0 ? "Phone" : index % 3 === 1 ? "Email" : "SMS",
    segment: index % 2 === 0 ? "Personal Lines" : "Household Growth",
    profile_summary: `${entry.clientName} is a ${entry.policyType.toLowerCase()} insurance customer managed by ${entry.agentName}.`,
    tenant_id: entry.tenantId,
    agent_id: entry.agentId,
    agent_name: entry.agentName,
  }));
  const deals: Deal[] = customers.filter((_, index) => index % 2 === 0).map((customer, index) => ({
    deal_id: `deal_${String(index + 1).padStart(3, "0")}`,
    customer_id: customer.customer_id,
    customer_name: customer.full_name,
    title: `${index % 3 === 0 ? "Coverage" : "Renewal"} review`,
    stage: index % 4 === 0 ? "Proposal" : index % 4 === 1 ? "Qualification" : "Negotiation",
    amount: 500 + index * 175,
    probability: 40 + (index % 4) * 15,
    expected_close_date: `2026-${String((index % 9) + 4).padStart(2, "0")}-15`,
    product_or_policy_type: CUSTOMER_REGISTRY.find((entry) => entry.clientId === customer.customer_id)?.policyType as Deal["product_or_policy_type"],
    next_step: index % 2 === 0 ? "Schedule coverage review" : "Send proposal summary",
    tenant_id: customer.tenant_id,
    agent_id: customer.agent_id,
    agent_name: customer.agent_name,
  }));
  const activityScenarios: Array<{ type: Activity["type"]; summary: string; outcome: string; followUp: boolean }> = [
    { type: "Call", summary: "Discussed a $1,200 collision repair estimate after a parking-lot incident. Customer asked whether the $500 deductible applies before repairs begin and whether rental reimbursement is included while the vehicle is in the shop.", outcome: "Send the repair-claim checklist and confirm rental reimbursement limits by email.", followUp: true },
    { type: "Meeting", summary: "Reviewed homeowners coverage pending a final construction inspection. Customer is concerned the inspection could slip beyond the closing date and create a temporary coverage gap while the builder completes outstanding work.", outcome: "Collect inspection certificate and call the builder about timing before binding coverage.", followUp: true },
    { type: "Email", summary: "Customer asked whether current term-life coverage remains sufficient after welcoming a second child and increasing their mortgage. Requested a side-by-side comparison of higher coverage versus a supplemental term policy.", outcome: "Prepare a life-insurance needs analysis for the annual review.", followUp: true },
    { type: "Note", summary: "Former auto-policy customer sold their vehicle and asked about non-owner coverage for occasional rental cars and car-share services. They may revisit bundled renters coverage after an upcoming move.", outcome: "Reconnect after move date with non-owner and renters bundle options.", followUp: false },
    { type: "Call", summary: "Customer raised concerns about renewal pricing after a premium increase. Reviewed discounts for bundled coverage, telematics enrollment, and annual payment; customer prefers a simple breakdown of savings before deciding.", outcome: "Send renewal comparison and discount eligibility summary.", followUp: true },
    { type: "Email", summary: "Customer reported adding a teenage driver to the household and wants to understand the impact on auto premiums, safe-driving discounts, and deductible options before the learner permit becomes active.", outcome: "Quote household driver change and share safe-driver program details.", followUp: true },
    { type: "Meeting", summary: "Reviewed high-value home coverage after a recent appraisal identified additional jewelry and art. Customer wants confirmation that scheduled-property limits cover the updated valuation and asked about annual appraisal requirements.", outcome: "Request appraisal documents and prepare scheduled-property rider recommendation.", followUp: true },
    { type: "Task", summary: "Follow-up task from a prior claim conversation: verify whether water damage was caused by a sudden pipe failure or gradual seepage, because coverage and documentation requirements differ.", outcome: "Await plumber report and photographs before advising on claim submission.", followUp: true },
    { type: "Call", summary: "Customer planning international travel asked whether their home policy includes protection for valuables away from home and whether a vacant-home endorsement is needed during an extended trip.", outcome: "Send travel and vacancy coverage guidance with endorsement quote.", followUp: false },
    { type: "Note", summary: "Customer expressed interest in combining auto and home policies but is hesitant after a previous claims experience. They want to see service commitments and bundled premium savings before changing providers.", outcome: "Share bundle proposal and claims-service overview at the next check-in.", followUp: true },
  ];
  const activities: Activity[] = customers.flatMap((customer, index) => [0, 1, 2].map((offset) => {
    const scenario = activityScenarios[(index * 3 + offset) % activityScenarios.length];
    const day = String(((index * 3 + offset) % 25) + 1).padStart(2, "0");
    return {
      activity_id: `act_${String(index * 3 + offset + 1).padStart(3, "0")}`,
      customer_id: customer.customer_id,
      customer_name: customer.full_name,
      deal_id: deals.find((deal) => deal.customer_id === customer.customer_id)?.deal_id ?? null,
      type: scenario.type,
      occurred_at: `2026-02-${day}T${String(9 + offset * 2).padStart(2, "0")}:00:00.000Z`,
      summary: scenario.summary,
      outcome: scenario.outcome,
      follow_up_due_at: scenario.followUp ? `2026-03-${day}T16:00:00.000Z` : null,
      status: scenario.followUp && offset === 0 ? "Open" : "Completed",
      tenant_id: customer.tenant_id,
      agent_id: customer.agent_id,
      agent_name: customer.agent_name,
    };
  }));

  const policies = MOCK_POLICIES.map((policy) => ({
    ...policy,
    customer_id: CUSTOMER_REGISTRY.find((entry) => entry.clientName === policy.client_name)?.clientId,
  }));

  await Promise.all([
    collection.deleteMany({}),
    db.collection(CUSTOMERS_COLLECTION).deleteMany({}),
    db.collection(DEALS_COLLECTION).deleteMany({}),
    db.collection(ACTIVITIES_COLLECTION).deleteMany({}),
  ]);

  await collection.insertMany(policies as unknown as Document[]);
  const crmCounts = await seedCrmData(db, customers, deals, activities);
  console.log(`[DB] Reset and seeded ${policies.length} policies, ${crmCounts.customers} customers, ${crmCounts.deals} deals, and ${crmCounts.activities} activities.`);

  // Indexes for query performance on the security filter fields
  await collection.createIndex({ tenant_id: 1, agent_id: 1 });
  await collection.createIndex({ policy_type: 1 });
  await collection.createIndex({ status: 1 });
  await collection.createIndex({ tenant_id: 1, customer_id: 1 });

  dbSeeded = true;
  return { insurance_policies: policies.length, ...crmCounts };
}

// ─── Database Reset ────────────────────────────────────────────────────────────
// Drops the collection and re-seeds from scratch.
// Exposed by DELETE /api/seed for test data resets.

export async function resetAndReseedDatabase(): Promise<SeedResult> {
  dbSeeded = false;
  return seedDatabase();
}

// ─── Query Engine ──────────────────────────────────────────────────────────────

export async function searchPolicies(
  securityFilter: Record<string, unknown>,
  additionalFilter: Record<string, unknown> = {}
): Promise<InsurancePolicy[]> {
  // ── Merge security filter + additional filter safely ─────────────────────────
  // The naive spread `{ ...securityFilter, ...additionalFilter }` silently
  // overwrites a top-level `$and` key if both filters carry one. Instead we
  // collect all clauses and wrap them under a single `$and` so neither side
  // can ever stomp on the other.
  const finalFilter = mergeFilters(securityFilter, additionalFilter);

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    // ── In-Memory Fallback ────────────────────────────────────────────────────
    console.log("[DB] No MONGODB_URI set — using in-memory mock data.");
    return MOCK_POLICIES.filter((policy) =>
      matchesFilter(policy as unknown as Record<string, unknown>, finalFilter)
    );
  }

  // ── Live MongoDB ──────────────────────────────────────────────────────────────
  try {
    const { db } = await connectToMongo();

    // Auto-seed on the very first live query if the collection is empty.
    if (!dbSeeded) {
      await seedDatabase();
      dbSeeded = true;
    }

    const collection = db.collection<Document>("insurance_policies");

    const results = await collection
      .find(finalFilter as Document)
      .sort({ start_date: -1 })
      .toArray();

    console.log(`[DB] Query returned ${results.length} document(s). Filter:`, JSON.stringify(finalFilter));
    return results as unknown as InsurancePolicy[];
  } catch (err) {
    console.error("[DB] MongoDB query failed — falling back to in-memory mock:", err);
    return MOCK_POLICIES.filter((policy) =>
      matchesFilter(policy as unknown as Record<string, unknown>, finalFilter)
    );
  }
}

// ─── Safe Filter Merger ───────────────────────────────────────────────────────
// Combines two MongoDB filter objects without ever overwriting an existing $and.
// Both filters may independently carry $and arrays; all clauses are united
// under a single top-level $and so every condition is enforced.
// Exported so mcpServer.ts can pre-compute the final query for telemetry.

export function mergeFilters(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): Record<string, unknown> {
  const hasA = Object.keys(a).length > 0;
  const hasB = Object.keys(b).length > 0;

  if (!hasA) return b;
  if (!hasB) return a;

  // Normalise each side into an array of clause objects
  const clausesA: Record<string, unknown>[] = a["$and"]
    ? (a["$and"] as Record<string, unknown>[])
    : [a];

  const clausesB: Record<string, unknown>[] = b["$and"]
    ? (b["$and"] as Record<string, unknown>[])
    : [b];

  const all = [...clausesA, ...clausesB];
  return all.length === 1 ? all[0] : { $and: all };
}

// ─── In-Memory Filter Matcher ─────────────────────────────────────────────────
// Interprets a MongoDB-style filter object against plain JS objects.
// Supports: direct equality, $eq, $ne, $in, $nin, $gt, $gte, $lt, $lte,
//           $and, $or, $nor.

function matchesFilter(
  doc: Record<string, unknown>,
  filter: Record<string, unknown>
): boolean {
  for (const [key, condition] of Object.entries(filter)) {
    if (key === "$and") {
      const conditions = condition as Record<string, unknown>[];
      if (!conditions.every((c) => matchesFilter(doc, c))) return false;
      continue;
    }
    if (key === "$or") {
      const conditions = condition as Record<string, unknown>[];
      if (!conditions.some((c) => matchesFilter(doc, c))) return false;
      continue;
    }
    if (key === "$nor") {
      const conditions = condition as Record<string, unknown>[];
      if (conditions.some((c) => matchesFilter(doc, c))) return false;
      continue;
    }

    const docValue = doc[key];

    if (condition !== null && typeof condition === "object" && !Array.isArray(condition)) {
      const ops = condition as Record<string, unknown>;

      if ("$eq" in ops && docValue !== ops["$eq"]) return false;
      if ("$ne" in ops && docValue === ops["$ne"]) return false;
      if ("$in" in ops) {
        const list = ops["$in"] as unknown[];
        if (list.length === 0 || !list.includes(docValue)) return false;
      }
      if ("$nin" in ops && (ops["$nin"] as unknown[]).includes(docValue)) return false;
      if ("$gt" in ops && !((docValue as number) > (ops["$gt"] as number))) return false;
      if ("$gte" in ops && !((docValue as number) >= (ops["$gte"] as number))) return false;
      if ("$lt" in ops && !((docValue as number) < (ops["$lt"] as number))) return false;
      if ("$lte" in ops && !((docValue as number) <= (ops["$lte"] as number))) return false;
    } else {
      // Direct equality
      if (docValue !== condition) return false;
    }
  }
  return true;
}

// ─── Mock Data Accessor ────────────────────────────────────────────────────────
export function getMockPolicies(): InsurancePolicy[] {
  return MOCK_POLICIES;
}
