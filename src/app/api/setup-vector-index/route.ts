// ─── GET /api/setup-vector-index ─────────────────────────────────────────────
// Idempotent route to create the Atlas Vector Search index for chat_sessions.
// Safe to call multiple times — checks for existing index before creating.
//
// Usage:
//   curl http://localhost:3888/api/setup-vector-index
//   make vector-index
//
// The index enables:
//   - $vectorSearch on the `embedding` field (1024-dim cosine similarity)
//   - Cerbos-enforced filter on `tenant_id` and `agent_id` inside the ANN scan

import { NextResponse } from "next/server";
import { setupVectorIndex } from "@/lib/chatSessions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await setupVectorIndex();
    return NextResponse.json(
      {
        success: true,
        created: result.created,
        message: result.message,
        index_name: "chat_session_embedding_index",
        collection: "chat_sessions",
        definition: {
          fields: [
            { type: "vector", path: "embedding", numDimensions: 1024, similarity: "cosine" },
            { type: "filter", path: "tenant_id" },
            { type: "filter", path: "agent_id" },
          ],
        },
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[setup-vector-index] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
