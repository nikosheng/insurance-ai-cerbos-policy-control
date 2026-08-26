import { HTTP } from "@cerbos/http";
import type { AgentSession } from "@/types";

// ─── Cerbos HTTP Client Singleton ─────────────────────────────────────────────
// Points to the Cerbos PDP started via docker-compose.
// Falls back gracefully if CERBOS_URL is not set.

let _cerbosClient: HTTP | null = null;

export function getCerbosClient(): HTTP {
  if (_cerbosClient) return _cerbosClient;

  const cerbosUrl = process.env.CERBOS_URL || "http://localhost:3592";
  _cerbosClient = new HTTP(cerbosUrl);
  return _cerbosClient;
}

// ─── Principal Builder ────────────────────────────────────────────────────────
// Converts an AgentSession (from the session cookie) into a Cerbos Principal.
// This is the only place where identity flows into the authorization layer.

export function buildCerbosPrincipal(session: AgentSession) {
  return {
    id: session.id,
    roles: session.roles,
    attr: {
      tenant_id: session.tenantId,
      name: session.name,
    },
  };
}

// ─── Resource Kind ────────────────────────────────────────────────────────────
export const INSURANCE_POLICY_RESOURCE_KIND = "insurance_policy";
