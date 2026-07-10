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
  if ('all' in condition) return condition.all.every((c) => applies(c, ctx));
  if ('any' in condition) return condition.any.some((c) => applies(c, ctx));

  switch (condition.field) {
    case 'necesitaIt':
      return ctx.necesitaIt === condition.eq;
    case 'necesitaSsm':
      return ctx.necesitaSsm === condition.eq;
    case 'valoareLei': {
      const v = ctx.valoareLei;
      if (condition.op === 'gte') return v >= condition.value;
      if (condition.op === 'gt') return v > condition.value;
      return v < condition.value;
    }
  }
}
