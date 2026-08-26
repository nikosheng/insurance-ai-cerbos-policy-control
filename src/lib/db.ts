import { MongoClient, Db, Document } from "mongodb";
import type { InsurancePolicy } from "@/types";

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
// Idempotent — checks document count before inserting.
// Safe to call multiple times; only inserts when the collection is empty.

export async function seedDatabase(): Promise<{ seeded: boolean; count: number }> {
  const { db } = await connectToMongo();
  const collection = db.collection<Document>("insurance_policies");

  const count = await collection.countDocuments();
  if (count > 0) {
    console.log(`[DB] Collection already has ${count} document(s) — skipping seed.`);
    return { seeded: false, count };
  }

  await collection.insertMany(MOCK_POLICIES as unknown as Document[]);
  console.log("[DB] Seeded insurance_policies with 4 documents.");

  // Indexes for query performance on the security filter fields
  await collection.createIndex({ tenant_id: 1, agent_id: 1 });
  await collection.createIndex({ policy_type: 1 });
  await collection.createIndex({ status: 1 });

  dbSeeded = true;
  return { seeded: true, count: MOCK_POLICIES.length };
}

// ─── Database Reset ────────────────────────────────────────────────────────────
// Drops the collection and re-seeds from scratch.
// Exposed by DELETE /api/seed for test data resets.

export async function resetAndReseedDatabase(): Promise<{ count: number }> {
  const { db } = await connectToMongo();
  const collection = db.collection<Document>("insurance_policies");

  await collection.drop().catch(() => {
    // Collection may not exist yet — that's fine
  });

  dbSeeded = false;
  const result = await seedDatabase();
  console.log(`[DB] Reset complete. Re-seeded ${result.count} document(s).`);
  return { count: result.count };
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
