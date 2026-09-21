import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getCustomer360SecurityFilter } from "@/lib/crm-auth";
import { getCustomer360Profile } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { customerId: string } }) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const profile = await getCustomer360Profile(params.customerId, await getCustomer360SecurityFilter(session));
    // Deliberately avoid distinguishing a missing customer from a forbidden one.
    if (!profile) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Customer profile unavailable: ${message}` }, { status: 503 });
  }
}
