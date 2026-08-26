// ─── /api/customer-session ────────────────────────────────────────────────────
// Manages the customer httpOnly session cookie.
// Completely separate from the agent session cookie (SESSION_COOKIE_NAME).
//
// GET    → return current customer session (or null)
// POST   → { clientId } → look up registry → set httpOnly cookie → 200
// DELETE → clear cookie → 200

import { NextRequest, NextResponse } from "next/server";
import { getCustomerById, buildCustomerSession } from "@/lib/customers";
import { CUSTOMER_COOKIE_NAME } from "@/lib/session";

export const dynamic = "force-dynamic";

const CUSTOMER_COOKIE_MAX_AGE = 60 * 60 * 4; // 4 hours

export async function GET(req: NextRequest) {
  const raw = req.cookies.get(CUSTOMER_COOKIE_NAME)?.value;
  if (!raw) return NextResponse.json({ session: null });
  try {
    const session = JSON.parse(raw);
    return NextResponse.json({ session });
  } catch {
    return NextResponse.json({ session: null });
  }
}

export async function POST(req: NextRequest) {
  let body: { clientId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entry = getCustomerById(body.clientId);
  if (!entry) {
    return NextResponse.json({ error: `Unknown customer: ${body.clientId}` }, { status: 404 });
  }

  const session = buildCustomerSession(entry);

  const res = NextResponse.json({ session }, { status: 200 });
  res.cookies.set(CUSTOMER_COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: CUSTOMER_COOKIE_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return res;
}
