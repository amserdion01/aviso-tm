# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Aviso TM

Internal **"referat de necesitate"** (requisition) approval-workflow **demo** for a water
utility in **Timișoara**. Clickable proposal demo with a **REAL backend** but **NO real
authentication** — the acting user/role is faked and sent from the client on every request.
The entire UI is in **Romanian**.

pnpm workspace monorepo, **built and verified**:
- **`/api`** — NestJS 10 + Prisma 6 + PostgreSQL, REST/JSON.
- **`/web`** — Angular 20 (standalone components + signals) + Angular Material, themed to the
  Aviso design system.

The original full build brief is in [`PROMPT.md`](./PROMPT.md); run/deploy details are in
[`README.md`](./README.md).

## Commands

Run from the repo root (pnpm workspace):
```bash
pnpm install            # install api + web
pnpm db:up              # start Postgres via docker compose (host port 5434)
cp api/.env.example api/.env
pnpm api:migrate        # prisma migrate dev
pnpm api:seed           # reset + seed the active workflow, IT/SSM users & ~19 referate
pnpm api:start          # NestJS API → http://localhost:3001  (nest start --watch; PORT in api/.env)
pnpm web:start          # Angular dev server → http://localhost:4200
pnpm api:build          # production build → api/dist/main.js
pnpm web:build          # production build → web/dist/aviso-web/browser
```
Scope to one package with `pnpm --filter api …` / `pnpm --filter web …`. Run a raw Prisma/Nest
command via `pnpm --filter api exec <cmd>` (e.g. `pnpm --filter api exec prisma migrate reset`).

**Testing/linting:** there is no test suite or linter configured. `web` has a Prettier config
(100 cols, single quotes) in its `package.json`; `web test` (`ng test`, Karma) exists but there
are no specs. Verify changes by running the app or hitting the API directly (see the smoke test
in `README.md`).

## Architecture

### Backend (`/api`) — the workflow engine

The read/write split is the thing to understand first:
- **`referate/referate.service.ts`** — all **reads** (`inboxForRole`, `findAll`, `findOne`). It
  owns `REFERAT_INCLUDE`, the shared Prisma `include` shape (requester + tasks + transitions with
  their users) so every list/detail response has the same shape. Re-exported and reused by the
  workflow service so responses are consistent.
- **`referate/workflow.service.ts`** — all **mutations**. `create()` materializes the chain from
  the **active Workflow** (see below); `approve`/`reject`/`sendBack` all funnel through one private
  `act()` method. This is where the core state machine lives — read it before changing any
  workflow behavior.
- **The approval chain is data-driven (configurable), not hardcoded.** New referate route against
  the single **active `Workflow`** (`isActive: true`): `create()` loads its ordered `WorkflowStep`s
  and keeps only the steps whose `appliesWhen` condition matches the referat, re-numbering the
  surviving tasks to a contiguous 1..n `stepOrder`.
- **`config/condition.ts`** — the pure condition engine: the `Condition` type + `applies(condition,
  ctx)` evaluated against a `RoutingContext` (`valoareLei`, `necesitaIt`, `necesitaSsm`). Conditions
  are value-threshold / boolean-flag comparisons plus `all`/`any` combinators; `null` = always
  applies. The web app mirrors this as `appliesClient()` in `core/models.ts` for the live preview.
- **`config/workflow.config.ts`** — only the default threshold constant `APPROVAL_THRESHOLD_LEI`
  (default 5000, override via env), used by the **seed** when building the standard workflow's
  director-branch steps. The live routing rule now lives in the DB (Workflow steps), not in code.

**Invariants enforced in code (do not break these):**
- **Every mutating action writes a `Transition` row in the SAME `prisma.$transaction`** that
  advances the workflow. `act()` and `create()` both do this.
- **`Transition` is append-only** — code only ever INSERTs; never UPDATE/DELETE.
- **Money is integer lei** (`valoareLei: Int`) — never a float.
- **Faked auth**: the acting user id comes from the request body/query. `act()` still enforces
  that the acting user's role matches the active step's role (403 otherwise).

**The state machine** (in `act()`):
- Active step = the single `ApprovalTask` with status `WAITING`; the rest start `PENDING`.
- **Approve** → current task `APPROVED`, flip next open task to `WAITING`; if none left, referat
  → `FINALIZAT`.
- **Reject** → current task `REJECTED`, referat → `RESPINS` (flow ends). Comment required.
- **Send back** → current task `SENT_BACK`, re-activate the immediately previous step (reset to
  `WAITING`, clearing its prior action). Referat → `TRIMIS_INAPOI`. Comment required.

`main.ts` enables CORS for `CORS_ORIGIN` and a global `ValidationPipe`; DTOs in
`referate/dto/` are the validation contract.

### Domain model (Prisma — `api/prisma/schema.prisma`)
- **User**(id, name, role) — roles: `ANGAJAT`, `SEF_IERARHIC`, `IT`, `SSM`, `ACHIZITII`, `DIR_ECONOMIC`, `DIR_GENERAL`.
  (`IT` and `SSM` are the approvers for the conditional flag steps.)
- **Referat**(id, articol, cantitate, justificare, centruCost, valoareLei `Int`, **necesitaIt**, **necesitaSsm**, requesterId, **workflowId?**, status, createdAt)
  — status: `IN_ASTEPTARE` | `APROBAT` | `RESPINS` | `TRIMIS_INAPOI` | `FINALIZAT`. The two boolean
  flags are routing inputs; `workflowId` records which workflow materialized the chain.
- **ApprovalTask**(id, referatId, stepOrder, role, status, effectiveApproverId, actedById, actedAt, comment)
  — status: `PENDING` | `WAITING` | `APPROVED` | `REJECTED` | `SENT_BACK`. Unique `(referatId, stepOrder)`.
- **Transition**(id, referatId, fromState, toState, actorId, comment, createdAt) — **append-only audit trail**.
- **Workflow**(id, name, isActive, createdAt) — a configurable approval chain. Exactly one is active.
- **WorkflowStep**(id, workflowId, order, role, label, **appliesWhen** `Json?`) — one ordered step;
  `appliesWhen` is a `Condition` (null = always applies). Unique `(workflowId, order)`.
- **Attachment**(id, referatId, fileName, storageKey `@unique`, contentType, sizeBytes, uploadedById?, createdAt)
  — metadata for a file whose bytes live in **Cloudflare R2** under `storageKey`
  (`referate/<referatId>/<uuid>-<fileName>`). Uploads allowed only while the referat is
  `IN_ASTEPTARE` / `TRIMIS_INAPOI`; no delete (demo). Uploads do NOT write a `Transition`.

### Endpoints (REST, JSON)
- `GET  /users` — all users (backs the role switcher).
- `GET  /referate?role=...` — inbox: referate with a `WAITING` task for that role.
- `GET  /referate/all` — overview list with statuses (declared before `:id` to avoid route capture).
- `GET  /referate/:id` — full detail + tasks + transitions (istoric).
- `POST /referate` — create + materialize chain from the active workflow. Body adds optional
  `necesitaIt` / `necesitaSsm` booleans (routing flags).
- `POST /referate/:id/approve` — body `{ actingUserId, comment? }`.
- `POST /referate/:id/reject` — body `{ actingUserId, comment (required) }`.
- `POST /referate/:id/send-back` — body `{ actingUserId, comment (required) }`.
- `GET  /referate/:id/pdf` — the referat as a print-ready A4 PDF, any state, no auth gate
  (served `inline`). Template: `referate/referat-document.ts` (self-contained HTML, RO labels);
  conversion: `pdf/pdf.service.ts` (Puppeteer, launched per request).
- `POST /referate/:id/atasamente` — multipart (`files` max 5 × 10 MB + `actingUserId`); content-type
  whitelist (pdf/images/office/text). Handled by `referate/attachments.service.ts` +
  `storage/r2.service.ts` (S3 client for R2, lazy-init so missing `R2_*` env vars 503 only here).
- `GET  /referate/:id/atasamente/:attId/download` — 302 redirect to a presigned R2 GET URL (15 min).
- `GET  /workflows` — list workflows with step counts.
- `GET  /workflows/active` — the active workflow + ordered steps (drives new referate + the live preview).
- `GET  /workflows/:id` — one workflow + ordered steps.
- `PUT  /workflows/:id/steps` — replace the entire ordered step list in one transaction (add/remove/reorder/edit).

### Frontend (`/web`) — Angular standalone + signals
- **`core/api.service.ts`** — the single HTTP gateway for every API call. Base URL from
  `environments/environment.ts`. Add all new calls here, nowhere else.
- **`core/session.service.ts`** — the faked-auth session, signal-based. Holds the loaded users
  and `actingRole` (persisted to `localStorage`); `currentUser` is the seeded user for that role.
  Exposes `inboxCount` (drives the nav badge) — call `refreshInboxCount()` after any workflow
  action. `core/auth.guard.ts` gates the shell on an acting role being set.
- **`shell/`** = app shell (top bar with role switcher + left nav). Routes lazy-load each feature
  (`app.routes.ts`). Feature screens live in `features/`: `login` (Autentificare — **no autologin**;
  the form starts empty, demo-account rows fill credentials on click), `inbox` (Inboxul meu),
  `referat-nou` (Referat nou — includes the IT/SSM flag checkboxes + a live routing preview
  computed from the active workflow), `detaliu` (Detaliu referat — the approval stepper),
  `toate` (Toate referatele), `admin` (**Administrare flux** at `/admin/flux` — edit the active
  workflow's steps; the nav entry is shown only when the acting role is `DIR_GENERAL`). `shared/`
  holds reusable presentational components (status badge, stepper, audit timeline, avatar, empty
  state, icon). Icons are inline SVG via `shared/icon.component.ts` (add glyphs to its registry).

### Theming — single source of truth
Design tokens live in `web/src/styles/tokens/*.css` (colors, typography, spacing, elevation,
fonts) and are mapped onto **one** Angular Material theme in `web/src/styles.scss`. Re-theming to
a real brand is a contained change there — do NOT scatter inline styles or per-component colors.

## Romanian copy (use these exact labels)
- Statuses: *În așteptare, Aprobat, Respins, Trimis înapoi, Finalizat*.
- Buttons (imperative verbs): *Aprobă, Respinge, Trimite înapoi, Trimite referatul*.
- Correct diacritics (ș, ț, ă, î, â) throughout. No emoji.

## Seed (`api/prisma/seed.ts`)
`pnpm api:seed` **resets** the DB and seeds: one user per role (incl. `IT` and `SSM`), the active
**"Flux standard achiziții"** workflow (6 conditional steps: SEF → IT?/SSM? → ACHIZITII →
DIR_ECONOMIC?/DIR_GENERAL? by value), and ~19 realistic Romanian referate spanning both value
paths plus the IT/SSM flag branches (a couple mid-chain, one `FINALIZAT`, one `RESPINS`, one sent
back). Each referat's chain is built by replaying the same condition engine, so tasks + the
append-only transition trail stay consistent. Examples: "Laptop Dell — 4.200 lei" (short),
"Pompă submersibilă — 18.500 lei" (full), "Licențe antivirus — 3.200 lei + IT".

## Config (`api/.env`, see `.env.example`)
- `DATABASE_URL` — Postgres (defaults match `docker-compose.yml`, host port **5434**).
- `PORT` — API port. Code default is 3000, but the committed `.env` sets **3001** (and the web
  app's `environment.ts` points there), so the API runs on **http://localhost:3001** by default.
- `CORS_ORIGIN` — allowed origin (default `http://localhost:4200`).
- `APPROVAL_THRESHOLD_LEI` — default threshold used by the seed (default 5000).
- `R2_ENDPOINT` (or `R2_ACCOUNT_ID`), `R2_ACCESS_KEY_ID` (alias `R2_ACCESS_KEY`),
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — Cloudflare R2 (attachment storage). `R2_ENDPOINT` is the
  bucket's S3 API URL without the bucket path — required for jurisdiction buckets (e.g. `.eu.`).
  Optional for the rest of the demo; attachment endpoints 503 without them.
