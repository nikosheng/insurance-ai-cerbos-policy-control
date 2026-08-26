import { NextRequest } from "next/server";
import type { AgentSession } from "@/types";

export const SESSION_COOKIE_NAME = "insurance_agent_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

// ─── Server-Side Session Reader ───────────────────────────────────────────────
// Reads and validates the session from the httpOnly cookie on a server-side request.
// Used by both the session route handler and the chat API route.

export function getSessionFromRequest(req: NextRequest): AgentSession | null {
  const cookieValue = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookieValue) return null;

  try {
    const session = JSON.parse(cookieValue) as AgentSession;
    // Validate required fields
    if (!session.id || !session.tenantId || !session.roles?.length) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}
