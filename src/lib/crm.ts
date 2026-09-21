import { Binary, Db, Document, MongoClient } from "mongodb";
import { embedText, VOYAGE_EMBEDDING_MODEL } from "./voyage";
import type { Activity, ActivitySearchResult, Customer, Customer360Profile, Deal, InsurancePolicy } from "@/types";

export const CUSTOMERS_COLLECTION = "customers";
export const DEALS_COLLECTION = "deals";
export const ACTIVITIES_COLLECTION = "activities";
export const CUSTOMER_VECTOR_INDEX_NAME = "customer_profile_embedding_index";
export const ACTIVITY_VECTOR_INDEX_NAME = "activity_embedding_index";

let cachedClient: MongoClient | null = null;

function mergeFilters(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  if (Object.keys(a).length === 0) return b;
  if (Object.keys(b).length === 0) return a;
  const clausesA = Array.isArray(a.$and) ? a.$and as Record<string, unknown>[] : [a];
  const clausesB = Array.isArray(b.$and) ? b.$and as Record<string, unknown>[] : [b];
  return { $and: [...clausesA, ...clausesB] };
}

function getDb(): Db {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set in environment.");
  if (!cachedClient) cachedClient = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
  return cachedClient.db(process.env.MONGODB_DB_NAME || "insurance_db");
}

export async function getCustomer360Profile(
  customerId: string,
  securityFilter: Record<string, unknown>
): Promise<Customer360Profile | null> {
  const db = getDb();
  const customer = await db.collection<Customer>(CUSTOMERS_COLLECTION).findOne(
    mergeFilters(securityFilter, { customer_id: customerId }) as Document,
    { projection: { profile_embedding: 0 } }
  );
  if (!customer) return null;

  // client_name keeps profiles useful against policy data seeded before customer_id
  // was introduced; the authorized customer lookup above remains the boundary.
  const customerFilter = mergeFilters(securityFilter, {
    $or: [{ customer_id: customerId }, { client_name: customer.full_name }],
  }) as Document;
  const [policies, deals, activities] = await Promise.all([
    db.collection<InsurancePolicy>("insurance_policies").find(customerFilter).toArray(),
    db.collection<Deal>(DEALS_COLLECTION).find(customerFilter).sort({ expected_close_date: 1 }).toArray(),
    db.collection<Activity>(ACTIVITIES_COLLECTION).find(customerFilter).sort({ occurred_at: -1 }).toArray(),
  ]);
  return { customer, policies, deals, activities };
}

export async function listCustomers(
  securityFilter: Record<string, unknown>,
  search: string | null,
  lifecycleStage: string | null,
  limit = 50
): Promise<Customer[]> {
  const clauses: Record<string, unknown>[] = [];
  if (lifecycleStage) clauses.push({ lifecycle_stage: lifecycleStage });
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    clauses.push({ $or: [{ full_name: { $regex: escaped, $options: "i" } }, { email: { $regex: escaped, $options: "i" } }] });
  }
  const filter = mergeFilters(securityFilter, clauses.length ? { $and: clauses } : {});
  return getDb().collection<Customer>(CUSTOMERS_COLLECTION)
    .find(filter as Document, { projection: { profile_embedding: 0 } })
    .sort({ full_name: 1 })
    .limit(Math.min(Math.max(limit, 1), 100))
    .toArray();
}

export async function searchCustomersByVector(
  query: string,
  securityFilter: Record<string, unknown>,
  limit = 10
): Promise<Array<Customer & { score: number }>> {
  const queryVector = await embedText(query, "query");
  const safeLimit = Math.min(Math.max(limit, 1), 20);
  const docs = await getDb().collection(CUSTOMERS_COLLECTION).aggregate([
    {
      $vectorSearch: {
        index: CUSTOMER_VECTOR_INDEX_NAME,
        path: "profile_embedding",
        queryVector,
        numCandidates: Math.max(safeLimit * 20, 100),
        limit: safeLimit,
        filter: securityFilter,
      },
    },
    { $addFields: { score: { $meta: "vectorSearchScore" } } },
    { $project: { _id: 0, profile_embedding: 0 } },
  ]).toArray();
  return docs as unknown as Array<Customer & { score: number }>;
}

export async function searchActivitiesByVector(
  query: string,
  securityFilter: Record<string, unknown>,
  limit = 10
): Promise<ActivitySearchResult[]> {
  const queryVector = await embedText(query, "query");
  const safeLimit = Math.min(Math.max(limit, 1), 20);
  const docs = await getDb().collection(ACTIVITIES_COLLECTION).aggregate([
    {
      $vectorSearch: {
        index: ACTIVITY_VECTOR_INDEX_NAME,
        path: "embedding",
        queryVector,
        numCandidates: Math.max(safeLimit * 20, 100),
        limit: safeLimit,
        filter: securityFilter,
      },
    },
    { $addFields: { score: { $meta: "vectorSearchScore" } } },
    { $project: { _id: 0, embedding: 0 } },
  ]).toArray();
  return docs as unknown as ActivitySearchResult[];
}

export async function setupCustomerVectorIndex(): Promise<{ created: boolean; message: string }> {
  const collection = getDb().collection(CUSTOMERS_COLLECTION);
  const existing = await collection.listSearchIndexes().toArray().catch(() => []);
  if (existing.some((index) => index.name === CUSTOMER_VECTOR_INDEX_NAME)) {
    return { created: false, message: `Vector Search index "${CUSTOMER_VECTOR_INDEX_NAME}" already exists.` };
  }
  await collection.createSearchIndex({
    name: CUSTOMER_VECTOR_INDEX_NAME,
    type: "vectorSearch",
    definition: {
      fields: [
        { type: "vector", path: "profile_embedding", numDimensions: 1024, similarity: "cosine" },
        { type: "filter", path: "tenant_id" },
        { type: "filter", path: "agent_id" },
      ],
    },
  });
  return { created: true, message: `Vector Search index "${CUSTOMER_VECTOR_INDEX_NAME}" created successfully.` };
}

export async function setupActivityVectorIndex(): Promise<{ created: boolean; message: string }> {
  const collection = getDb().collection(ACTIVITIES_COLLECTION);
  const existing = await collection.listSearchIndexes().toArray().catch(() => []);
  if (existing.some((index) => index.name === ACTIVITY_VECTOR_INDEX_NAME)) {
    return { created: false, message: `Vector Search index "${ACTIVITY_VECTOR_INDEX_NAME}" already exists.` };
  }
  await collection.createSearchIndex({
    name: ACTIVITY_VECTOR_INDEX_NAME,
    type: "vectorSearch",
    definition: {
      fields: [
        { type: "vector", path: "embedding", numDimensions: 1024, similarity: "cosine" },
        { type: "filter", path: "tenant_id" },
        { type: "filter", path: "agent_id" },
      ],
    },
  });
  return { created: true, message: `Vector Search index "${ACTIVITY_VECTOR_INDEX_NAME}" created successfully.` };
}

export async function seedCrmData(
  db: Db,
  customers: Customer[],
  deals: Deal[],
  activities: Activity[]
): Promise<{ customers: number; deals: number; activities: number }> {
  const customerCollection = db.collection<Document>(CUSTOMERS_COLLECTION);
  const dealCollection = db.collection<Document>(DEALS_COLLECTION);
  const activityCollection = db.collection<Document>(ACTIVITIES_COLLECTION);

  // Embeddings are intentionally not created during reset: Voyager calls are
  // expensive and optional. Run /api/setup-customer-vector-index afterward.
  await Promise.all([
    customerCollection.insertMany(customers as unknown as Document[]),
    dealCollection.insertMany(deals as unknown as Document[]),
    activityCollection.insertMany(activities as unknown as Document[]),
  ]);

  await Promise.all([
    customerCollection.createIndex({ tenant_id: 1, customer_id: 1 }, { unique: true }),
    customerCollection.createIndex({ tenant_id: 1, agent_id: 1 }),
    customerCollection.createIndex({ tenant_id: 1, email: 1 }),
    dealCollection.createIndex({ tenant_id: 1, agent_id: 1, customer_id: 1 }),
    dealCollection.createIndex({ stage: 1, expected_close_date: 1 }),
    activityCollection.createIndex({ tenant_id: 1, agent_id: 1, customer_id: 1, occurred_at: -1 }),
  ]);
  return { customers: customers.length, deals: deals.length, activities: activities.length };
}

export function createProfileEmbeddingText(customer: Customer, deals: Deal[], activities: Activity[]): string {
  return [
    `Customer: ${customer.full_name}. Segment: ${customer.segment}. Lifecycle: ${customer.lifecycle_stage}.`,
    `Profile: ${customer.profile_summary}`,
    `Deals: ${deals.map((deal) => `${deal.title} (${deal.stage}), next step: ${deal.next_step}`).join("; ") || "none"}.`,
    `Recent activity: ${activities.slice(0, 3).map((activity) => activity.summary).join("; ") || "none"}.`,
  ].join(" ");
}

export async function generateCustomerProfileEmbeddings(): Promise<number> {
  const db = getDb();
  const customers = await db.collection<Customer>(CUSTOMERS_COLLECTION).find({}).toArray();
  let updated = 0;
  for (const customer of customers) {
    const [deals, activities] = await Promise.all([
      db.collection<Deal>(DEALS_COLLECTION).find({ customer_id: customer.customer_id }).toArray(),
      db.collection<Activity>(ACTIVITIES_COLLECTION).find({ customer_id: customer.customer_id }).sort({ occurred_at: -1 }).limit(3).toArray(),
    ]);
    const embedding = await embedText(createProfileEmbeddingText(customer, deals, activities), "document");
    await db.collection(CUSTOMERS_COLLECTION).updateOne(
      { customer_id: customer.customer_id },
      { $set: { profile_embedding: Binary.fromFloat32Array(new Float32Array(embedding)), embedding_model: VOYAGE_EMBEDDING_MODEL } }
    );
    updated++;
  }
  return updated;
}

export async function generateActivityEmbeddings(): Promise<number> {
  const collection = getDb().collection<Activity>(ACTIVITIES_COLLECTION);
  const activities = await collection.find({}).toArray();
  for (const activity of activities) {
    const text = `${activity.customer_name}. ${activity.type}. ${activity.summary} Outcome: ${activity.outcome}`;
    const embedding = await embedText(text, "document");
    await collection.updateOne(
      { activity_id: activity.activity_id },
      { $set: { embedding: Binary.fromFloat32Array(new Float32Array(embedding)), embedding_model: VOYAGE_EMBEDDING_MODEL } }
    );
  }
  return activities.length;
}
