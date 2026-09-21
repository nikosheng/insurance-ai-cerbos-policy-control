import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getCustomer360SecurityFilter } from "@/lib/crm-auth";
import { searchActivitiesByVector } from "@/lib/crm";
import { ACTIVITY_RESOURCE_KIND } from "@/lib/cerbos";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { query?: unknown; limit?: unknown } | null;
  if (!body || typeof body.query !== "string" || !body.query.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  try {
    const results = await searchActivitiesByVector(
      body.query.trim(),
      await getCustomer360SecurityFilter(session, ACTIVITY_RESOURCE_KIND),
      typeof body.limit === "number" ? body.limit : 8
    );
    return NextResponse.json({ results, total: results.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Semantic activity search unavailable: ${message}` }, { status: 503 });
  }
}
