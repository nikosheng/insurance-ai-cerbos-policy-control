import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getCustomer360SecurityFilter } from "@/lib/crm-auth";
import { listCustomers } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const scope = await getCustomer360SecurityFilter(session);
    const { searchParams } = request.nextUrl;
    const customers = await listCustomers(
      scope,
      searchParams.get("search"),
      searchParams.get("lifecycle_stage"),
      Number(searchParams.get("limit") || 50)
    );
    return NextResponse.json({ customers, total: customers.length, applied_filter: scope });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Customer directory unavailable: ${message}` }, { status: 503 });
  }
}
