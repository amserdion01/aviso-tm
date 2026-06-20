import { Role } from '@prisma/client';

/**
 * The single configurable routing threshold (in whole lei).
 * At or above this value, the full 4-step chain applies; below it, the
 * simplified 2-step chain. Overridable via the APPROVAL_THRESHOLD_LEI env var.
 */
export const APPROVAL_THRESHOLD_LEI: number = (() => {
  const raw = process.env.APPROVAL_THRESHOLD_LEI;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : 5000;
})();

/** Approval chain below the threshold (simplified path). */
const SHORT_CHAIN: Role[] = [Role.SEF_IERARHIC, Role.ACHIZITII];

/** Approval chain at or above the threshold (full path). */
const FULL_CHAIN: Role[] = [
  Role.SEF_IERARHIC,
  Role.ACHIZITII,
  Role.DIR_ECONOMIC,
  Role.DIR_GENERAL,
];

/**
 * Returns the ordered list of approver roles for a given value.
 * This is the core routing rule of the workflow.
 */
export function approvalChainFor(valoareLei: number): Role[] {
  return valoareLei >= APPROVAL_THRESHOLD_LEI ? FULL_CHAIN : SHORT_CHAIN;
}
