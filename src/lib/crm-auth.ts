import { getCerbosClient, buildCerbosPrincipal, CUSTOMER_RESOURCE_KIND } from "./cerbos";
import { planResponseToMongoFilter } from "./ast-to-mongo";
import type { AgentSession } from "@/types";

// Customer 360 access is entirely driven by the PDP. Today tenant_admin has no
// matching policy rule; adding one later widens scope without changing these APIs.
export async function getCustomer360SecurityFilter(
  session: AgentSession,
  resourceKind = CUSTOMER_RESOURCE_KIND
): Promise<Record<string, unknown>> {
  const response = await getCerbosClient().planResources({
    principal: buildCerbosPrincipal(session),
    resource: { kind: resourceKind },
    action: "read",
  });
  return planResponseToMongoFilter(response).filter;
}
