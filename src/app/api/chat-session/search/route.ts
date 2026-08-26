// ─── POST /api/chat-session/search ───────────────────────────────────────────
// Semantic search over past customer service chat sessions.
//
// Security flow (Cerbos enforced at ANN scan level):
//   1. Read AgentSession from httpOnly cookie
//   2. Determine security filter from role:
//        insurance_agent → { tenant_id, agent_id }   (own sessions only)
//        tenant_admin    → { tenant_id }              (all sessions in tenant)
//   3. Embed the query string with Voyage AI (input_type="query")
//   4. Run $vectorSearch with the security filter pushed into the ANN index scan
//   5. Return top-N results (embedding field stripped — never sent to browser)

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { embedText } from "@/lib/voyage";
import { vectorSearchSessions } from "@/lib/chatSessions";
import type { SessionSearchRequest } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // ── 1. Authentication ────────────────────────────────────────────────────
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse request body ────────────────────────────────────────────────
  let body: SessionSearchRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { query, limit = 5 } = body;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  // ── 3. Build Cerbos security filter from role ────────────────────────────
  // We derive the filter directly from the session rather than calling
  // planResources, because the $vectorSearch `filter` option takes a MongoDB
  // match expression — not an AST. The logic directly mirrors the Cerbos policy:
  //   insurance_agent rule: R.attr.tenant_id == P.attr.tenant_id AND R.attr.agent_id == P.id
  //   tenant_admin rule:    R.attr.tenant_id == P.attr.tenant_id
  //
  // This is safe because:
  //   - Session is read from the httpOnly cookie (not user input)
  //   - The filter is constructed server-side and never touches LLM output
  //   - It exactly mirrors the Cerbos YAML rules for chat_session
  const isAdmin = session.roles.includes("tenant_admin");
  const securityFilter: Record<string, string> = {
    tenant_id: session.tenantId,
    ...(isAdmin ? {} : { agent_id: session.id }),
  };

  // ── 4. Embed query with Voyage AI ────────────────────────────────────────
  // Use input_type="query" — Voyage prepends the query optimisation prompt,
  // which produces query vectors compatible with document vectors stored using
  // input_type="document".
  let queryVector: number[];
  try {
    queryVector = await embedText(query.trim(), "query");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat-session/search] Voyage embedding failed:", msg);
    return NextResponse.json(
      { error: `Failed to embed query: ${msg}` },
      { status: 500 }
    );
  }

  // ── 5. Run $vectorSearch ─────────────────────────────────────────────────
  let results;
  try {
    results = await vectorSearchSessions(queryVector, securityFilter, Math.min(limit, 20));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat-session/search] Vector search failed:", msg);
    return NextResponse.json(
      { error: `Vector search failed: ${msg}` },
      { status: 500 }
    );
  }

  // ── 6. Return results ────────────────────────────────────────────────────
  return NextResponse.json(
    {
      results,
      total: results.length,
      security_context: {
        principal_id: session.id,
        tenant_id: session.tenantId,
        roles: session.roles,
        applied_filter: securityFilter,
      },
    },
    { status: 200 }
  );
}
