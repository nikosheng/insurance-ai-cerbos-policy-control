// ─── POST /api/chat-session ───────────────────────────────────────────────────
// Ends a customer service chat session:
//   1. Reads the agent's identity from the httpOnly session cookie
//   2. Receives the full chat transcript + customer metadata
//   3. Calls Azure OpenAI to summarise the transcript and extract follow-up actions
//   4. Calls Voyage AI to embed the summary (model: voyage-4, 1024 dims)
//   5. Stores the document in MongoDB with embedding as BSON Binary.fromFloat32Array
//   6. Returns { session_id, summary, follow_up_actions, saved_at }

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSessionFromRequest, getCustomerSessionFromRequest } from "@/lib/session";
import { embedText } from "@/lib/voyage";
import { saveChatSession } from "@/lib/chatSessions";
import type { EndSessionRequest, EndSessionResponse, SessionSummaryOutput } from "@/types";

export const dynamic = "force-dynamic";

// ─── Azure OpenAI client ──────────────────────────────────────────────────────
// We call the Azure REST API directly for the summarise step to avoid the
// @ai-sdk/provider version conflict that arises when mixing `ai@3.x` generateText
// with the newer @ai-sdk/azure provider types in the same module.
async function summariseWithAzure(systemPrompt: string, userPrompt: string): Promise<string> {
  const resourceName = process.env.AZURE_OPENAI_RESOURCE_NAME ?? "";
  const apiKey = process.env.AZURE_OPENAI_API_KEY ?? "";
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "";
  const apiVersion = "2025-03-01-preview";

  const url = `https://${resourceName}.openai.azure.com/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   },
      ],
      max_completion_tokens: 500,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(unreadable)");
    throw new Error(`Azure OpenAI error ${response.status}: ${body}`);
  }

  interface AzureChoice { message: { content: string } }
  interface AzureResponse { choices: AzureChoice[] }
  const data = (await response.json()) as AzureResponse;
  return data.choices[0]?.message?.content ?? "";
}



// ─── Summarise prompt ─────────────────────────────────────────────────────────
// Instructs the LLM to return a strict JSON object.
// We use a simple text extraction approach (no tool calling) for reliability.

const SUMMARISE_SYSTEM_PROMPT = `You are a concise insurance customer service assistant.
Given a chat transcript between an insurance agent and a customer, extract:
1. A clear 2-3 sentence summary of the conversation (what the customer needed, what was discussed, outcome).
2. A list of concrete follow-up actions the agent must take (e.g. "Send renewal quote by Friday", "Escalate claim #X to supervisor").

Respond with ONLY a valid JSON object in this exact shape, no markdown, no extra text:
{"summary":"<summary text>","follow_up_actions":["<action 1>","<action 2>"]}

If there are no follow-up actions, return an empty array.`;

export async function POST(req: NextRequest) {
  // ── 1. Authentication ────────────────────────────────────────────────────
  // Accept either an agent session or a customer session.
  // When a customer ends their session, we save it under the assigned agent's
  // tenant_id + agent_id so the agent can find it via Session Search later.
  const agentSession = getSessionFromRequest(req);
  const customerSession = getCustomerSessionFromRequest(req);

  if (!agentSession && !customerSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Normalise to a common identity shape for the save step below
  const identity = agentSession
    ? {
        tenantId: agentSession.tenantId,
        agentId: agentSession.id,
        agentName: agentSession.name,
      }
    : {
        tenantId: customerSession!.tenantId,
        agentId: customerSession!.agentId,
        agentName: customerSession!.agentName,
      };

  // ── 2. Parse request body ────────────────────────────────────────────────
  let body: EndSessionRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { transcript, customerName, customerPolicyNumber, startedAt } = body;

  if (!transcript || !customerName) {
    return NextResponse.json(
      { error: "transcript and customerName are required" },
      { status: 400 }
    );
  }

  // ── 3. Summarise transcript with Azure OpenAI ────────────────────────────
  let summaryOutput: SessionSummaryOutput;
  try {
    const userPrompt = `Customer name: ${customerName}\n${customerPolicyNumber ? `Policy number: ${customerPolicyNumber}\n` : ""}Chat transcript:\n\n${transcript}`;
    const text = await summariseWithAzure(SUMMARISE_SYSTEM_PROMPT, userPrompt);

    // Parse the JSON response
    const cleaned = text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
    summaryOutput = JSON.parse(cleaned) as SessionSummaryOutput;

    if (!summaryOutput.summary || !Array.isArray(summaryOutput.follow_up_actions)) {
      throw new Error("Unexpected summarise response shape");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat-session] Summarise failed:", msg);
    return NextResponse.json(
      { error: `Failed to summarise transcript: ${msg}` },
      { status: 500 }
    );
  }

  // ── 4. Embed summary with Voyage AI ─────────────────────────────────────
  // Use input_type="document" — Voyage prepends the document optimisation prompt
  // which improves retrieval quality when later queried with input_type="query".
  let embedding: number[];
  try {
    // Embed summary + follow-up actions together so searches like
    // "renewal quote" or "escalate claim" match even when those phrases
    // only appear in the actions list rather than the summary paragraph.
    const embedInput = summaryOutput.follow_up_actions.length > 0
      ? `${summaryOutput.summary}\n\nFollow-up actions:\n${summaryOutput.follow_up_actions.map((a) => `- ${a}`).join("\n")}`
      : summaryOutput.summary;
    embedding = await embedText(embedInput, "document");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat-session] Voyage embedding failed:", msg);
    return NextResponse.json(
      { error: `Failed to embed summary: ${msg}` },
      { status: 500 }
    );
  }

  // ── 5. Save to MongoDB (Binary.fromFloat32Array inside saveChatSession) ──
  const sessionId = randomUUID();
  const endedAt = new Date().toISOString();

  try {
    await saveChatSession({
      session_id: sessionId,
      tenant_id: identity.tenantId,
      agent_id: identity.agentId,
      agent_name: identity.agentName,
      customer_name: customerName,
      customer_policy_number: customerPolicyNumber ?? null,
      started_at: startedAt,
      ended_at: endedAt,
      raw_transcript: transcript,
      summary: summaryOutput.summary,
      follow_up_actions: summaryOutput.follow_up_actions,
      embedding,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat-session] Save failed:", msg);
    return NextResponse.json(
      { error: `Failed to save chat session: ${msg}` },
      { status: 500 }
    );
  }

  // ── 6. Return result ─────────────────────────────────────────────────────
  const response: EndSessionResponse = {
    session_id: sessionId,
    summary: summaryOutput.summary,
    follow_up_actions: summaryOutput.follow_up_actions,
    saved_at: endedAt,
  };

  return NextResponse.json(response, { status: 201 });
}
