import { NextRequest } from "next/server";
import type { AgentSession, CustomerSession } from "@/types";

export const SESSION_COOKIE_NAME = "insurance_agent_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

export const CUSTOMER_COOKIE_NAME = "insurance_customer_session";

// ─── Agent Session Reader ─────────────────────────────────────────────────────
export function getSessionFromRequest(req: NextRequest): AgentSession | null {
  const cookieValue = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookieValue) return null;
  try {
    const session = JSON.parse(cookieValue) as AgentSession;
    if (!session.id || !session.tenantId || !session.roles?.length) return null;
    return session;
  } catch {
    return null;
  }
}

// ─── Customer Session Reader ──────────────────────────────────────────────────
export function getCustomerSessionFromRequest(req: NextRequest): CustomerSession | null {
  const cookieValue = req.cookies.get(CUSTOMER_COOKIE_NAME)?.value;
  if (!cookieValue) return null;
  try {
    const session = JSON.parse(cookieValue) as CustomerSession;
    if (!session.clientId || !session.tenantId || !session.roles?.length) return null;
    return session;
  } catch {
    return null;
  }
}
