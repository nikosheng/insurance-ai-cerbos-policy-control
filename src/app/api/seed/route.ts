import { NextResponse } from "next/server";
import { seedDatabase, resetAndReseedDatabase } from "@/lib/db";

// ─── GET /api/seed ─────────────────────────────────────────────────────────────
// Destructive demo reset. Every invocation removes all data from the four demo
// collections and inserts the latest deterministic Customer 360 dataset.

export async function GET() {
  try {
    const collections = await seedDatabase();
    const message = "Reset and re-seeded insurance policies, customers, deals, and activities.";

    console.log(`[Seed API] GET → ${message}`);

    return NextResponse.json({ ok: true, reset: true, collections, message }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Seed API] GET failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ─── DELETE /api/seed ──────────────────────────────────────────────────────────
// DELETE is an alias for GET so either method produces the current demo dataset.

export async function DELETE() {
  try {
    const collections = await resetAndReseedDatabase();
    const message = "Reset and re-seeded insurance policies, customers, deals, and activities.";
    console.log(`[Seed API] DELETE → ${message}`);

    return NextResponse.json({ ok: true, reset: true, collections, message }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Seed API] DELETE failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
