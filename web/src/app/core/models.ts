// ============================================================
//  Domain models — mirror the NestJS/Prisma API responses.
//  Romanian labels and design "status keys" live here so every screen renders
//  the workflow vocabulary consistently.
// ============================================================

export type Role =
  | 'ANGAJAT'
  | 'SEF_IERARHIC'
  | 'IT'
  | 'SSM'
  | 'ACHIZITII'
  | 'DIR_ECONOMIC'
  | 'DIR_GENERAL';

export type ReferatStatus =
  | 'IN_ASTEPTARE'
  | 'APROBAT'
  | 'RESPINS'
  | 'TRIMIS_INAPOI'
  | 'FINALIZAT';

export type TaskStatus =
  | 'PENDING'
  | 'WAITING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SENT_BACK';

/** Visual status keys used by the design's StatusBadge / Stepper. */
export type StatusKey =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'sentback'
  | 'finalized';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/** Response of POST /auth/login. */
export interface LoginResponse {
  token: string;
  user: User;
}

export interface ApprovalTask {
  id: string;
  referatId: string;
  stepOrder: number;
  role: Role;
  status: TaskStatus;
  effectiveApproverId: string | null;
  actedById: string | null;
  actedAt: string | null;
  comment: string | null;
  effectiveApprover?: User | null;
  actedBy?: User | null;
}

export interface Transition {
  id: string;
  referatId: string;
  fromState: string | null;
  toState: string;
  actorId: string;
  comment: string | null;
  createdAt: string;
  actor?: User;
}

/** File attached to a referat; the bytes live in R2, this is the metadata. */
export interface Attachment {
  id: string;
  referatId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedById: string | null;
  createdAt: string;
  uploadedBy?: User | null;
}

export interface Referat {
  id: string;
  articol: string;
  cantitate: number;
  justificare: string;
  centruCost: string;
  valoareLei: number;
  necesitaIt: boolean;
  necesitaSsm: boolean;
  requesterId: string;
  workflowId: string | null;
  status: ReferatStatus;
  createdAt: string;
  requester?: User;
  tasks: ApprovalTask[];
  transitions: Transition[];
  attachments: Attachment[];
}

/** The requester is the authenticated user — no id travels in the payload. */
export interface CreateReferatPayload {
  articol: string;
  cantitate: number;
  justificare: string;
  centruCost: string;
  valoareLei: number;
  necesitaIt: boolean;
  necesitaSsm: boolean;
}

// ============================================================
//  Configurable workflow (mirror of the API's Workflow / WorkflowStep +
//  the condition engine in api/src/config/condition.ts).
// ============================================================

/** Attributes a routing condition can branch on. */
export interface RoutingContext {
  valoareLei: number;
  necesitaIt: boolean;
  necesitaSsm: boolean;
}

/** A step's routing predicate; null = the step always applies. */
export type Condition =
  | { field: 'valoareLei'; op: 'gte' | 'gt' | 'lt'; value: number }
  | { field: 'necesitaIt'; eq: boolean }
  | { field: 'necesitaSsm'; eq: boolean }
  | { all: Condition[] }
  | { any: Condition[] }
  | null;

export interface WorkflowStep {
  id: string;
  workflowId: string;
  order: number;
  role: Role;
  label: string;
  appliesWhen: Condition;
}

export interface Workflow {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  steps: WorkflowStep[];
}

/** Client-side mirror of api/src/config/condition.ts `applies` — powers the
 * live routing preview on "Referat nou" without another API round-trip. */
export function appliesClient(condition: Condition, ctx: RoutingContext): boolean {
  if (condition == null) return true;
  if ('all' in condition) return condition.all.every((c) => appliesClient(c, ctx));
  if ('any' in condition) return condition.any.some((c) => appliesClient(c, ctx));
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

// ---- Ordered role list (the full approval chain order) ----
export const ROLES: Role[] = [
  'ANGAJAT',
  'SEF_IERARHIC',
  'IT',
  'SSM',
  'ACHIZITII',
  'DIR_ECONOMIC',
  'DIR_GENERAL',
];

// ---- Romanian role labels (match the design copy) ----
export const ROLE_LABEL: Record<Role, string> = {
  ANGAJAT: 'Angajat',
  SEF_IERARHIC: 'Șef ierarhic',
  IT: 'Serviciul IT',
  SSM: 'Responsabil SSM',
  ACHIZITII: 'Birou Achiziții',
  DIR_ECONOMIC: 'Director Economic',
  DIR_GENERAL: 'Director General',
};

/** Compact role labels for the stepper. */
export const ROLE_SHORT: Record<Role, string> = {
  ANGAJAT: 'Angajat',
  SEF_IERARHIC: 'Șef ierarhic',
  IT: 'IT',
  SSM: 'SSM',
  ACHIZITII: 'Achiziții',
  DIR_ECONOMIC: 'Dir. economic',
  DIR_GENERAL: 'Dir. general',
};

// ---- Referat status → label + visual key ----
export const STATUS_LABEL: Record<ReferatStatus, string> = {
  IN_ASTEPTARE: 'În așteptare',
  APROBAT: 'Aprobat',
  RESPINS: 'Respins',
  TRIMIS_INAPOI: 'Trimis înapoi',
  FINALIZAT: 'Finalizat',
};

export const STATUS_KEY: Record<ReferatStatus, StatusKey> = {
  IN_ASTEPTARE: 'pending',
  APROBAT: 'approved',
  RESPINS: 'rejected',
  TRIMIS_INAPOI: 'sentback',
  FINALIZAT: 'finalized',
};

/** Label per visual status key (used by the status legend on "Toate referatele"). */
export const STATUS_KEY_LABEL: Record<StatusKey, string> = {
  pending: 'În așteptare',
  approved: 'Aprobat',
  rejected: 'Respins',
  sentback: 'Trimis înapoi',
  finalized: 'Finalizat',
};

/** Whether a value routes the full (≥ threshold) or short chain — display only. */
export const APPROVAL_THRESHOLD_LEI = 5000;
