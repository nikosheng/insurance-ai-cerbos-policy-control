import {
  PlanKind,
  PlanExpression,
  PlanExpressionValue,
  PlanExpressionVariable,
  type PlanExpressionOperand,
  type PlanResourcesResponse,
} from "@cerbos/core";
import type { CerbosAstNode } from "@/types";

// ─── Field Path Mapper ────────────────────────────────────────────────────────
// Strips the Cerbos path prefix and maps to the actual MongoDB field name.
// "request.resource.attr.tenant_id" → "tenant_id"
// "request.resource.attr.agent_id"  → "agent_id"

function cerbosVarToMongoField(variableName: string): string {
  const prefix = "request.resource.attr.";
  if (variableName.startsWith(prefix)) {
    return variableName.slice(prefix.length);
  }
  // Fallback: use the last segment of the dot-separated path
  const parts = variableName.split(".");
  return parts[parts.length - 1];
}

// ─── AST Node → MongoDB Filter ────────────────────────────────────────────────
// Recursively walks the Cerbos PlanExpressionOperand AST and converts it into
// a native MongoDB filter object. Handles logical, comparison, and membership ops.

function astNodeToMongoFilter(node: PlanExpressionOperand): Record<string, unknown> {
  // ── Leaf: Variable reference ────────────────────────────────────────────────
  if (node instanceof PlanExpressionVariable) {
    // Variables are resolved by their parent expression (comparison node).
    // This case is only hit if a bare variable is the root, which is unusual.
    return { [cerbosVarToMongoField(node.name)]: { $exists: true } };
  }

  // ── Leaf: Literal value ─────────────────────────────────────────────────────
  if (node instanceof PlanExpressionValue) {
    // Values are consumed by their parent expression. Bare value root is unusual.
    return {};
  }

  // ── Branch: Expression node ─────────────────────────────────────────────────
  if (node instanceof PlanExpression) {
    const { operator, operands } = node;

    switch (operator) {
      // ── Logical Operators ──────────────────────────────────────────────────
      case "and": {
        const clauses = operands.map(astNodeToMongoFilter);
        if (clauses.length === 1) return clauses[0];
        return { $and: clauses };
      }

      case "or": {
        const clauses = operands.map(astNodeToMongoFilter);
        if (clauses.length === 1) return clauses[0];
        return { $or: clauses };
      }

      case "not": {
        if (operands.length === 1) {
          const inner = astNodeToMongoFilter(operands[0]);
          return { $nor: [inner] };
        }
        return {};
      }

      // ── Comparison Operators ───────────────────────────────────────────────
      // For binary comparisons, operands[0] is the variable, operands[1] the value.
      case "eq":
      case "ne":
      case "lt":
      case "lte":
      case "le":
      case "gt":
      case "gte":
      case "ge": {
        if (operands.length !== 2) break;

        let fieldNode: PlanExpressionVariable | null = null;
        let valueNode: PlanExpressionValue | null = null;
        let reversed = false;

        // Handle both (var, val) and (val, var) operand orderings
        if (operands[0] instanceof PlanExpressionVariable && operands[1] instanceof PlanExpressionValue) {
          fieldNode = operands[0] as PlanExpressionVariable;
          valueNode = operands[1] as PlanExpressionValue;
        } else if (operands[1] instanceof PlanExpressionVariable && operands[0] instanceof PlanExpressionValue) {
          fieldNode = operands[1] as PlanExpressionVariable;
          valueNode = operands[0] as PlanExpressionValue;
          reversed = true;
        } else {
          break;
        }

        const field = cerbosVarToMongoField(fieldNode.name);
        const value = valueNode.value;

        const mongoOpMap: Record<string, string> = {
          eq: "$eq",
          ne: "$ne",
          lt: reversed ? "$gt" : "$lt",
          lte: reversed ? "$gte" : "$lte",
          le: reversed ? "$gte" : "$lte",
          gt: reversed ? "$lt" : "$gt",
          gte: reversed ? "$lte" : "$gte",
          ge: reversed ? "$lte" : "$gte",
        };

        const mongoOp = mongoOpMap[operator];

        // Simplify: use direct equality for $eq
        if (mongoOp === "$eq") {
          return { [field]: value };
        }

        return { [field]: { [mongoOp]: value } };
      }

      // ── Membership Operators ───────────────────────────────────────────────
      case "in": {
        if (operands.length !== 2) break;

        if (operands[0] instanceof PlanExpressionVariable && operands[1] instanceof PlanExpressionValue) {
          const field = cerbosVarToMongoField((operands[0] as PlanExpressionVariable).name);
          const values = (operands[1] as PlanExpressionValue).value;
          return { [field]: { $in: Array.isArray(values) ? values : [values] } };
        }
        break;
      }

      default:
        console.warn(`[AST→Mongo] Unhandled operator: "${operator}" — skipping node`);
        break;
    }
  }

  // Fallback: deny-all filter if we can't parse the node safely.
  // This is the secure default — unknown conditions fail closed.
  console.warn("[AST→Mongo] Falling back to deny-all filter for unrecognized AST node.");
  return { _id: { $in: [] } };
}

// ─── Serialiser: AST → Raw JSON (for telemetry panel) ────────────────────────

export function astNodeToRawJson(node: PlanExpressionOperand): CerbosAstNode {
  if (node instanceof PlanExpressionVariable) {
    return { variable: node.name };
  }
  if (node instanceof PlanExpressionValue) {
    return { value: node.value };
  }
  if (node instanceof PlanExpression) {
    return {
      operator: node.operator,
      operands: node.operands.map(astNodeToRawJson),
    };
  }
  return {};
}

// ─── Main Export: PlanResponse → MongoDB Filter ───────────────────────────────
// This is the single entry point called from the tool executor.
// It handles all three PlanKind variants and returns a safe MongoDB filter.

export interface MongoFilterResult {
  filter: Record<string, unknown>;
  planKind: string;
  rawAst: CerbosAstNode | null;
}

export function planResponseToMongoFilter(
  planResponse: PlanResourcesResponse
): MongoFilterResult {
  switch (planResponse.kind) {
    case PlanKind.ALWAYS_ALLOWED: {
      // Principal can see all resources — no filter applied.
      // In a real system you may still want to scope to the tenant for defence-in-depth.
      console.log("[AST→Mongo] KIND_ALWAYS_ALLOWED — no filter applied.");
      return {
        filter: {},
        planKind: PlanKind.ALWAYS_ALLOWED,
        rawAst: null,
      };
    }

    case PlanKind.ALWAYS_DENIED: {
      // Principal cannot access any resources — return deny-all filter.
      console.log("[AST→Mongo] KIND_ALWAYS_DENIED — applying deny-all filter.");
      return {
        filter: { _id: { $in: [] } },
        planKind: PlanKind.ALWAYS_DENIED,
        rawAst: null,
      };
    }

    case PlanKind.CONDITIONAL: {
      // Parse and compile the AST into a MongoDB filter.
      const condition = planResponse.condition;
      console.log("[AST→Mongo] KIND_CONDITIONAL — walking AST.");

      const rawAst = astNodeToRawJson(condition);
      const filter = astNodeToMongoFilter(condition);

      console.log("[AST→Mongo] Compiled filter:", JSON.stringify(filter, null, 2));

      return {
        filter,
        planKind: PlanKind.CONDITIONAL,
        rawAst,
      };
    }

    default: {
      // Unknown kind — fail closed.
      console.error("[AST→Mongo] Unknown plan kind — applying deny-all filter.");
      return {
        filter: { _id: { $in: [] } },
        planKind: "UNKNOWN",
        rawAst: null,
      };
    }
  }
}
