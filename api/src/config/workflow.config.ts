/**
 * The single configurable routing threshold (in whole lei).
 * The live approval chain is now data-driven (see the Workflow / WorkflowStep
 * tables and api/src/config/condition.ts); this constant is the default value
 * the seed uses when building the standard workflow's director-branch steps
 * (`valoareLei >= APPROVAL_THRESHOLD_LEI`). Overridable via APPROVAL_THRESHOLD_LEI.
 */
export const APPROVAL_THRESHOLD_LEI: number = (() => {
  const raw = process.env.APPROVAL_THRESHOLD_LEI;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : 5000;
})();
