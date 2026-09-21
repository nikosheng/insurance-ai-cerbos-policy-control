import { NextResponse } from "next/server";
import { generateActivityEmbeddings, generateCustomerProfileEmbeddings, setupActivityVectorIndex, setupCustomerVectorIndex } from "@/lib/crm";

export async function GET() {
  try {
    const [customerEmbeddings, activityEmbeddings] = await Promise.all([
      generateCustomerProfileEmbeddings(),
      generateActivityEmbeddings(),
    ]);
    const [customerIndex, activityIndex] = await Promise.all([
      setupCustomerVectorIndex(),
      setupActivityVectorIndex(),
    ]);
    return NextResponse.json({ ok: true, customerEmbeddings, activityEmbeddings, customerIndex, activityIndex });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
