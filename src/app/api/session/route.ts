import { NextRequest, NextResponse } from "next/server";
import { AGENT_REGISTRY, buildSessionFromAgentId, type AgentId } from "@/lib/agents";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE, getSessionFromRequest } from "@/lib/session";

// ─── GET /api/session ──────────────────────────────────────────────────────────
// Returns the current session for client-side state restore on page load.

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  return NextResponse.json({ session: session ?? null }, { status: 200 });
}

// ─── POST /api/session ─────────────────────────────────────────────────────────
// Creates a new session. Accepts { agentId } in the request body.
// Sets an httpOnly, SameSite=Strict cookie — the LLM never sees this value.

export async function POST(req: NextRequest) {
  let body: { agentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { agentId } = body;

  if (!agentId || !(agentId in AGENT_REGISTRY)) {
    return NextResponse.json(
      {
        error: `Invalid agentId. Valid options: ${Object.keys(AGENT_REGISTRY).join(", ")}`,
      },
      { status: 400 }
    );
  }

  const session = buildSessionFromAgentId(agentId as AgentId);

  const response = NextResponse.json(
    {
      ok: true,
      session: {
        id: session.id,
        name: session.name,
        tenantId: session.tenantId,
        roles: session.roles,
      },
    },
    { status: 200 }
  );

  // httpOnly prevents JavaScript from reading this cookie.
  // SameSite=Strict prevents CSRF — cookie is only sent on same-site requests.
  response.cookies.set(SESSION_COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return response;
}

// ─── DELETE /api/session ───────────────────────────────────────────────────────
// Clears the session cookie (logout).

export async function DELETE() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  return response;
}
