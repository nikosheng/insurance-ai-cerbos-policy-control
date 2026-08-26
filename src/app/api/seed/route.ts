import { NextResponse } from "next/server";
import { seedDatabase, resetAndReseedDatabase } from "@/lib/db";

// ─── GET /api/seed ─────────────────────────────────────────────────────────────
// Idempotent seed — inserts the 4 mock policies if the collection is empty.
// Safe to call multiple times; skips insertion when documents already exist.
//
// Response examples:
//   { ok: true, seeded: true,  count: 4, message: "Seeded 4 documents into insurance_policies." }
//   { ok: true, seeded: false, count: 4, message: "Already seeded — 4 documents present. No changes made." }

export async function GET() {
  try {
    const { seeded, count } = await seedDatabase();

    const message = seeded
      ? `Seeded ${count} documents into insurance_policies.`
      : `Already seeded — ${count} document(s) present. No changes made.`;

    console.log(`[Seed API] GET → ${message}`);

    return NextResponse.json({ ok: true, seeded, count, message }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Seed API] GET failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ─── DELETE /api/seed ──────────────────────────────────────────────────────────
// Drops the insurance_policies collection and re-seeds it from scratch.
// Use this to reset test data back to the original 4 documents at any time.
//
// Response example:
//   { ok: true, count: 4, message: "Collection dropped and re-seeded with 4 documents." }

export async function DELETE() {
  try {
    const { count } = await resetAndReseedDatabase();

    const message = `Collection dropped and re-seeded with ${count} documents.`;
    console.log(`[Seed API] DELETE → ${message}`);

    return NextResponse.json({ ok: true, count, message }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Seed API] DELETE failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
