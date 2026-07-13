/**
 * Pure, data-driven routing conditions for the configurable approval workflow.
 *
 * Each WorkflowStep carries an `appliesWhen` condition (stored as JSON). At
 * referat-creation time the engine evaluates every step's condition against the
 * referat's RoutingContext; only the steps that apply become ApprovalTask rows.
 * A `null` condition means the step always applies.
 *
 * Mirrors the shape used by the sibling Aviso project, trimmed to this demo's
 * routing attributes (value threshold + the IT/SSM flags).
 */

/** The referat attributes a condition can branch on. */
export interface RoutingContext {
  valoareLei: number;
  necesitaIt: boolean;
  necesitaSsm: boolean;
}

/**
 * A predicate over a {@link RoutingContext}. `null` = always applies.
 * `all` / `any` are AND / OR combinators (e.g. value >= 5000 OR needs IT).
 */
export type Condition =
  | { field: 'valoareLei'; op: 'gte' | 'gt' | 'lt'; value: number }
  | { field: 'necesitaIt'; eq: boolean }
  | { field: 'necesitaSsm'; eq: boolean }
  | { all: Condition[] }
  | { any: Condition[] }
  | null;

/** Evaluate a step's condition against the referat context. */
export function applies(condition: Condition, ctx: RoutingContext): boolean {
  if (condition == null) return true;
  // Defensive backstop: a malformed condition (should be rejected at the API
  // boundary — see isCondition) must never crash referat creation. Treat
  // anything we can't understand as "always applies".
  if (typeof condition !== 'object' || Array.isArray(condition)) return true;
  if ('all' in condition) {
    return Array.isArray(condition.all)
      ? condition.all.every((c) => applies(c, ctx))
      : true;
  }
  if ('any' in condition) {
    return Array.isArray(condition.any)
      ? condition.any.some((c) => applies(c, ctx))
      : true;
  }

  switch (condition.field) {
    case 'necesitaIt':
      return ctx.necesitaIt === condition.eq;
    case 'necesitaSsm':
      return ctx.necesitaSsm === condition.eq;
    case 'valoareLei': {
      const v = ctx.valoareLei;
      if (condition.op === 'gte') return v >= condition.value;
      if (condition.op === 'gt') return v > condition.value;
      if (condition.op === 'lt') return v < condition.value;
      return true;
    }
    default:
      return true;
  }
}

/**
 * Structural validator for a persisted condition. Used at the API boundary
 * (PUT /workflows/:id/steps) so a malformed `appliesWhen` is a 400 up front
 * rather than a 500 on every later POST /referate.
 */
export function isCondition(value: unknown): value is Condition {
  if (value == null) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;

  if ('all' in obj || 'any' in obj) {
    const branch = 'all' in obj ? obj.all : obj.any;
    return Array.isArray(branch) && branch.every((c) => isCondition(c));
  }

  switch (obj.field) {
    case 'necesitaIt':
    case 'necesitaSsm':
      return typeof obj.eq === 'boolean';
    case 'valoareLei':
      return (
        (obj.op === 'gte' || obj.op === 'gt' || obj.op === 'lt') &&
        typeof obj.value === 'number' &&
        Number.isFinite(obj.value)
      );
    default:
      return false;
  }
}
