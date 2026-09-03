// ─── GET /api/setup-vector-index ─────────────────────────────────────────────
// Idempotent route to create the Atlas Vector Search index for chat_sessions.
// Safe to call multiple times — checks for existing index before creating.
//
// DELETE /api/setup-vector-index — drops the index so it can be recreated with
// an updated definition (Atlas does not support in-place index field edits).
//
// Usage:
//   curl http://localhost:3888/api/setup-vector-index          # create
//   curl -X DELETE http://localhost:3888/api/setup-vector-index # drop
//   make vector-index
//
// The index enables:
//   - $vectorSearch on the `embedding` field (1024-dim cosine similarity)
//   - Filter fields: tenant_id, agent_id, customer_name inside the ANN scan

import { NextResponse } from "next/server";
import { setupVectorIndex, dropVectorIndex } from "@/lib/chatSessions";

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
            { type: "filter", path: "customer_name" },
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

export async function DELETE() {
  try {
    const result = await dropVectorIndex();
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[setup-vector-index] Drop error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
