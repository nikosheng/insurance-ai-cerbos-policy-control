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

// ─── Setup Vector Search Index (idempotent) ───────────────────────────────────
// Creates the Atlas Vector Search index if it does not already exist.
// Called from GET /api/setup-vector-index.
//
// Index definition:
//   - "vector" field on `embedding` (1024 dims, cosine similarity)
//   - "filter" fields on `tenant_id` and `agent_id` — enable Cerbos boundary
//     enforcement inside the ANN scan via the $vectorSearch `filter` option.

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
      ],
    },
  });

  return {
    created: true,
    message: `Vector Search index "${VECTOR_INDEX_NAME}" created successfully. It may take 1-2 minutes to become active.`,
  };
}
