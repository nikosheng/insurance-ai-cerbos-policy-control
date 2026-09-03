// ─── Chat Sessions DB Layer ───────────────────────────────────────────────────
// Manages the `chat_sessions` collection in MongoDB Atlas.
//
// Key design decisions:
//   - Embeddings are stored as BSON Binary.fromFloat32Array (not JSON arrays)
//     for storage efficiency and Atlas Vector Search compatibility.
//   - The `embedding` field is NEVER returned in API responses — it is always
//     projected out ($project: { embedding: 0 }).
//   - $vectorSearch filter fields (tenant_id, agent_id) are declared in the
//     Atlas Vector Search index definition, which means Cerbos security
//     boundaries are enforced inside the ANN scan, not post-filtering.

import { MongoClient, Binary, Db } from "mongodb";
import type { SessionSearchResult } from "@/types/chat-session";
import { VOYAGE_EMBEDDING_MODEL } from "./voyage";

// ─── Collection name ──────────────────────────────────────────────────────────
export const CHAT_SESSIONS_COLLECTION = "chat_sessions";

// ─── Atlas Vector Search index name ──────────────────────────────────────────
// Must match exactly what is created in /api/setup-vector-index.
export const VECTOR_INDEX_NAME = "chat_session_embedding_index";

// ─── MongoDB client singleton (shared with db.ts pattern) ─────────────────────
let _client: MongoClient | null = null;

function getMongoClient(): MongoClient {
  if (_client) return _client;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set in environment.");
  _client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  return _client;
}

function getDb(): Db {
  const dbName = process.env.MONGODB_DB_NAME;
  if (!dbName) throw new Error("MONGODB_DB_NAME is not set in environment.");
  return getMongoClient().db(dbName);
}

// ─── Document shape stored in MongoDB ────────────────────────────────────────
// This is the raw MongoDB document — the `embedding` field uses BSON Binary.
// We deliberately keep this internal; API responses use SessionSearchResult.
interface ChatSessionDoc {
  session_id: string;
  tenant_id: string;
  agent_id: string;
  agent_name: string;
  customer_name: string;
  customer_policy_number: string | null;
  started_at: string;
  ended_at: string;
  raw_transcript: string;
  summary: string;
  follow_up_actions: string[];
  embedding: Binary;       // BSON Binary (Float32 subtype 0) — voyage-4 1024 dims
  embedding_model: string;
  source: "agent" | "customer"; // which portal created this session
}

// ─── Save Chat Session ────────────────────────────────────────────────────────
// Converts the number[] embedding to BSON Binary.fromFloat32Array before insert.
// This is the correct representation for Atlas Vector Search with the
// `"type": "vector"` field in the index definition.

export interface SaveChatSessionParams {
  session_id: string;
  tenant_id: string;
  agent_id: string;
  agent_name: string;
  customer_name: string;
  customer_policy_number: string | null;
  started_at: string;
  ended_at: string;
  raw_transcript: string;
  summary: string;
  follow_up_actions: string[];
  embedding: number[];     // number[1024] from Voyage API — converted here
  source: "agent" | "customer"; // which portal created this session
}

export async function saveChatSession(params: SaveChatSessionParams): Promise<void> {
  const db = getDb();
  const collection = db.collection<ChatSessionDoc>(CHAT_SESSIONS_COLLECTION);

  // Convert float array → BSON Binary (Float32 subtype 0)
  // Binary.fromFloat32Array packs the 1024 floats as raw IEEE 754 binary data,
  // which is what Atlas Vector Search expects for BinData(0, ...) vectors.
  const embeddingBinary = Binary.fromFloat32Array(new Float32Array(params.embedding));

  const doc: ChatSessionDoc = {
    session_id: params.session_id,
    tenant_id: params.tenant_id,
    agent_id: params.agent_id,
    agent_name: params.agent_name,
    customer_name: params.customer_name,
    customer_policy_number: params.customer_policy_number,
    started_at: params.started_at,
    ended_at: params.ended_at,
    raw_transcript: params.raw_transcript,
    summary: params.summary,
    follow_up_actions: params.follow_up_actions,
    embedding: embeddingBinary,
    embedding_model: VOYAGE_EMBEDDING_MODEL,
    source: params.source,
  };

  await collection.insertOne(doc);
}

// ─── Vector Search Sessions ───────────────────────────────────────────────────
// Performs an Atlas $vectorSearch on the chat_sessions collection.
//
// Security: the `filter` option in $vectorSearch is enforced at the ANN index
// scan level (not post-filtering) because tenant_id and agent_id are declared
// as `"type": "filter"` fields in the index definition. This means documents
// outside the Cerbos-derived boundary are excluded before any results are scored.
//
// @param queryVector   number[1024] from Voyage embedText(query, "query")
// @param securityFilter  { tenant_id, agent_id? } compiled from Cerbos plan
// @param limit         max results to return (default 5)

export async function vectorSearchSessions(
  queryVector: number[],
  securityFilter: Record<string, string>,
  limit = 5
): Promise<SessionSearchResult[]> {
  const db = getDb();
  const collection = db.collection(CHAT_SESSIONS_COLLECTION);

  const pipeline = [
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: "embedding",
        queryVector,                 // number[] — Atlas accepts JSON array for query
        numCandidates: Math.max(limit * 20, 100),
        limit,
        filter: securityFilter,      // Cerbos boundary — pushed into ANN scan
      },
    },
    {
      $addFields: {
        score: { $meta: "vectorSearchScore" },
      },
    },
    {
      // Strip embedding binary — never send 1024 floats to the browser
      $project: {
        embedding: 0,
        raw_transcript: 0,           // Omit raw transcript from search results
        _id: 0,
      },
    },
  ];

  const docs = await collection.aggregate(pipeline).toArray();

  return docs.map((doc) => ({
    session_id: doc.session_id as string,
    tenant_id: doc.tenant_id as string,
    agent_id: doc.agent_id as string,
    agent_name: doc.agent_name as string,
    customer_name: doc.customer_name as string,
    customer_policy_number: doc.customer_policy_number as string | null,
    started_at: doc.started_at as string,
    ended_at: doc.ended_at as string,
    summary: doc.summary as string,
    follow_up_actions: doc.follow_up_actions as string[],
    embedding_model: doc.embedding_model as string,
    score: doc.score as number,
  }));
}

// ─── Relevant Customer Sessions (for agent memory) ────────────────────────────
// Uses Atlas $vectorSearch to retrieve the customer's past sessions that are
// most semantically relevant to their current question, rather than just the
// most recent ones by date.
//
// This ensures specific details — amounts, dates, named topics — surface even
// when they appeared in an older session that is not the most recent one.
//
// Requires customer_name to be declared as a "filter" field in the
// chat_session_embedding_index definition (see setupVectorIndex below).
//
// Filter logic:
//   - customer_name + agent_id + tenant_id: scopes to this customer only
//   - source filter: accepts "customer" or absent (legacy) docs; excludes "agent"
//     Note: $vectorSearch filter only supports simple equality / $in / $and/$or,
//     so we query without the source filter inside $vectorSearch and post-filter.
//
// Falls back gracefully to [] if MONGODB_URI is not set (in-memory dev mode)
// or if the vector index is not yet active (returns [] rather than throwing).

export interface PastSessionSummary {
  summary: string;
  follow_up_actions: string[];
  started_at: string;
  ended_at: string;
}

export async function getRelevantSessionsForCustomer(
  queryVector: number[],
  agentId: string,
  tenantId: string,
  customerName: string,
  limit = 3
): Promise<PastSessionSummary[]> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    // In-memory dev mode — no chat_sessions available
    return [];
  }

  const db = getDb();
  const collection = db.collection(CHAT_SESSIONS_COLLECTION);

  // $vectorSearch filter uses customer_name, agent_id, tenant_id declared as
  // "filter" fields in the index. This scopes the ANN scan to this customer's
  // sessions only, so cosine similarity ranks only their own past conversations.
  // We fetch limit * 3 candidates and post-filter by source to exclude agent-
  // portal sessions, then return the top `limit` results.
  const pipeline = [
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: "embedding",
        queryVector,
        numCandidates: Math.max(limit * 20, 100),
        limit: limit * 3, // over-fetch to absorb source post-filter
        filter: {
          agent_id: agentId,
          tenant_id: tenantId,
          customer_name: customerName,
        },
      },
    },
    // Post-filter: keep customer-portal sessions and legacy docs without source
    {
      $match: {
        $or: [{ source: "customer" }, { source: { $exists: false } }],
      },
    },
    { $limit: limit },
    {
      $project: {
        summary: 1,
        follow_up_actions: 1,
        started_at: 1,
        ended_at: 1,
        _id: 0,
        embedding: 0,
        raw_transcript: 0,
      },
    },
  ];

  try {
    const docs = await collection.aggregate(pipeline).toArray();
    return docs.map((doc) => ({
      summary: doc.summary as string,
      follow_up_actions: doc.follow_up_actions as string[],
      started_at: doc.started_at as string,
      ended_at: doc.ended_at as string,
    }));
  } catch (err) {
    // Vector index may not be active yet — fall back silently
    console.warn("[CustomerMemory] Vector search unavailable, falling back to recency:", err);
    return getRecentSessionsForCustomerFallback(agentId, tenantId, customerName, limit);
  }
}

// ─── Recency fallback (used when vector index is unavailable) ─────────────────
// Plain find() sorted by ended_at desc — same logic as the original implementation.
// Called automatically by getRelevantSessionsForCustomer() if $vectorSearch fails.

async function getRecentSessionsForCustomerFallback(
  agentId: string,
  tenantId: string,
  customerName: string,
  limit: number
): Promise<PastSessionSummary[]> {
  const db = getDb();
  const collection = db.collection<ChatSessionDoc>(CHAT_SESSIONS_COLLECTION);

  const docs = await collection
    .find(
      {
        agent_id: agentId,
        tenant_id: tenantId,
        customer_name: customerName,
        $or: [{ source: "customer" }, { source: { $exists: false } }],
      },
      { projection: { summary: 1, follow_up_actions: 1, started_at: 1, ended_at: 1, _id: 0 } }
    )
    .sort({ ended_at: -1 })
    .limit(limit)
    .toArray();

  return docs.map((doc) => ({
    summary: doc.summary,
    follow_up_actions: doc.follow_up_actions,
    started_at: doc.started_at,
    ended_at: doc.ended_at,
  }));
}

// ─── Drop Vector Search Index ─────────────────────────────────────────────────
// Drops the existing index so it can be recreated with an updated definition.
// Atlas does not support in-place edits to vector index filter fields.
// Called from DELETE /api/setup-vector-index.

export async function dropVectorIndex(): Promise<{ dropped: boolean; message: string }> {
  const db = getDb();
  const collection = db.collection(CHAT_SESSIONS_COLLECTION);

  try {
    const existingIndexes = await collection.listSearchIndexes().toArray();
    const exists = existingIndexes.some((idx) => idx.name === VECTOR_INDEX_NAME);
    if (!exists) {
      return { dropped: false, message: `Index "${VECTOR_INDEX_NAME}" does not exist.` };
    }
    await collection.dropSearchIndex(VECTOR_INDEX_NAME);
    return { dropped: true, message: `Index "${VECTOR_INDEX_NAME}" dropped. Call GET to recreate.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to drop index: ${msg}`);
  }
}

// ─── Setup Vector Search Index (idempotent) ───────────────────────────────────
// Creates the Atlas Vector Search index if it does not already exist.
// Called from GET /api/setup-vector-index.
//
// Index definition:
//   - "vector" field on `embedding` (1024 dims, cosine similarity)
//   - "filter" fields on `tenant_id`, `agent_id`, `customer_name` — enable
//     Cerbos boundary enforcement and per-customer scoping inside the ANN scan
//     via the $vectorSearch `filter` option.
//
// NOTE: if the index already exists without customer_name as a filter field,
// it must be dropped and recreated (Atlas does not support in-place field edits).
// Run DELETE then GET /api/setup-vector-index, or use the Atlas UI.

export async function setupVectorIndex(): Promise<{ created: boolean; message: string }> {
  const db = getDb();
  const collection = db.collection(CHAT_SESSIONS_COLLECTION);

  // Check if the index already exists
  try {
    const existingIndexes = await collection.listSearchIndexes().toArray();
    const alreadyExists = existingIndexes.some(
      (idx) => idx.name === VECTOR_INDEX_NAME
    );
    if (alreadyExists) {
      return {
        created: false,
        message: `Vector Search index "${VECTOR_INDEX_NAME}" already exists.`,
      };
    }
  } catch {
    // listSearchIndexes may fail if the collection doesn't exist yet — continue
  }

  // Create the collection if it doesn't exist (by inserting nothing)
  const collections = await db.listCollections({ name: CHAT_SESSIONS_COLLECTION }).toArray();
  if (collections.length === 0) {
    await db.createCollection(CHAT_SESSIONS_COLLECTION);
  }

  // Create the Atlas Vector Search index
  await collection.createSearchIndex({
    name: VECTOR_INDEX_NAME,
    type: "vectorSearch",
    definition: {
      fields: [
        {
          type: "vector",
          path: "embedding",
          numDimensions: 1024,
          similarity: "cosine",
        },
        {
          type: "filter",
          path: "tenant_id",
        },
        {
          type: "filter",
          path: "agent_id",
        },
        {
          type: "filter",
          path: "customer_name",
        },
      ],
    },
  });

  return {
    created: true,
    message: `Vector Search index "${VECTOR_INDEX_NAME}" created successfully. It may take 1-2 minutes to become active.`,
  };
}
