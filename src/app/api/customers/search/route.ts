import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getCustomer360SecurityFilter } from "@/lib/crm-auth";
import { searchCustomersByVector } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { query?: unknown; limit?: unknown } | null;
  if (!body || typeof body.query !== "string" || !body.query.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  try {
    const scope = await getCustomer360SecurityFilter(session);
    const results = await searchCustomersByVector(body.query.trim(), scope, typeof body.limit === "number" ? body.limit : 10);
    return NextResponse.json({ results, total: results.length, applied_filter: scope });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Semantic customer search unavailable: ${message}` }, { status: 503 });
  }
}
