# Aviso TM

Internal **"referat de necesitate"** (requisition) approval-workflow **demo** for a water
utility in **Timișoara**. This is a clickable proposal demo with a **REAL backend** but
**NO real authentication** (the acting user/role is faked, sent from the client). The entire
UI is in **Romanian**.

> The full build brief is in [`PROMPT.md`](./PROMPT.md). Start there.

## Current status
**Built.** Monorepo with `/api` (NestJS + Prisma + Postgres, complete & verified) and `/web`
(Angular 20 standalone + signals + Material, themed to the Aviso design system, verified against
the live API). Postgres runs via Docker Compose on host port **5434**. See [`README.md`](./README.md)
for full run/deploy details.

## Commands
Run from the repo root (pnpm workspace):
```bash
pnpm install            # install api + web
pnpm db:up              # start Postgres (docker compose, host port 5434)
cp api/.env.example api/.env
pnpm api:migrate        # prisma migrate dev
pnpm api:seed           # seed ~6 referate (both paths, mid-chain, finalized)
pnpm api:start          # NestJS API → http://localhost:3000  (start:dev, watch)
pnpm web:start          # Angular dev server → http://localhost:4200
pnpm api:build          # production build of the API (dist/main.js)
pnpm web:build          # production build of the web app (web/dist/aviso-web/browser)
```
Scope a command to one package with `pnpm --filter api …` / `pnpm --filter web …`. Run a single
Nest/Prisma command via `pnpm --filter api exec <cmd>` (e.g. `prisma migrate reset`).

The web design tokens live in `web/src/styles/tokens/` and are mapped to one Angular Material
theme in `web/src/styles.scss` — re-theming to a real brand is a contained change there.

## Workflow for building this
- **Plan mode first.** Before writing any code, present for approval: the monorepo layout,
  the Prisma schema, and the endpoint list. Do not start coding until that's approved.
- **Build the backend (`/api`) now and in full** — Prisma migrate + seed working end-to-end,
  every endpoint testable. Don't wait for the design to start the backend.
- **Build the frontend (`/web`) only AFTER the Claude Design handoff is attached** (see
  "Design" below). When building it, **delegate to subagents working in parallel** on disjoint
  surfaces — e.g. one per screen, plus the app-shell + `ApiService` + the Material theme — then
  integrate and verify. (This mirrors how the sibling Aviso project was built quickly.)
- Keep all backend logic as **real, readable code** (no low-code). Scope strictly to the demo.

## Design (Claude Design handoff — attached later)
A **Claude Design** handoff bundle (a design system: brand tokens — colors, typography,
spacing, elevation — reusable components, and full-screen UI kits) **will be attached
separately once it's ready**. When it arrives:
- Read its README/chat transcripts and `styles.css` first, then recreate it faithfully in the
  Angular UI — map its tokens to a single **Angular Material theme** (palette, typography,
  density) and match its colors / type scale / spacing / component look pixel-for-pixel.
- Until it's attached, build with clean Material defaults but **keep all styling centralized**
  (one theme file + design tokens, no scattered inline styles) so re-theming to the brand is a
  small, contained change.

## Stack
- Monorepo with two folders:
  - **`/api`** — NestJS + Prisma + PostgreSQL, REST API (returns JSON).
  - **`/web`** — Angular (latest, **standalone components + signals**) + **Angular Material**.
- Package manager: pnpm (use npm only if pnpm is unavailable).

## Domain model (Prisma)
- **User**(id, name, role) — roles: `ANGAJAT`, `SEF_IERARHIC`, `ACHIZITII`, `DIR_ECONOMIC`, `DIR_GENERAL`.
- **Referat**(id, articol, cantitate, justificare, centruCost, valoareLei `Int`, requesterId, status, createdAt)
  — status: `IN_ASTEPTARE` | `APROBAT` | `RESPINS` | `TRIMIS_INAPOI` | `FINALIZAT`.
- **ApprovalTask**(id, referatId, stepOrder, role, status, effectiveApproverId, actedById, actedAt, comment)
  — status: `PENDING` | `WAITING` | `APPROVED` | `REJECTED` | `SENT_BACK`.
- **Transition**(id, referatId, fromState, toState, actorId, comment, createdAt)
  — **APPEND-ONLY audit trail**.

## Routing rule (the core — threshold configurable, default 5000 lei)
On submit, materialize the approval chain as `ApprovalTask` rows:
1. `SEF_IERARHIC` → 2. `ACHIZITII`
   - if `valoareLei >= 5000`: add 3. `DIR_ECONOMIC` → 4. `DIR_GENERAL`
   - if `valoareLei < 5000`: chain ends after `ACHIZITII` (simplified path)
- The active step is the single task with status `WAITING`; the rest start `PENDING`.
- **Approve**: mark current `WAITING` task `APPROVED`, flip the next `PENDING` task to `WAITING`;
  if none left → referat `FINALIZAT`.
- **Reject**: ends the flow (referat `RESPINS`).
- **Send back**: re-activate the immediately previous step.

## Hard rules
- **Every action writes a `Transition` row in the SAME DB transaction** that advances the workflow.
- `Transition` is **append-only** — only INSERT, never UPDATE/DELETE.
- Money is stored as **integer lei** (`valoareLei: Int`) — never a float.
- **Auth is faked**: the acting user/role comes from the request body/query, NOT a session.
- Enable **CORS** for the Angular dev origin.
- The routing threshold (5000) must be a single configurable constant.

## Endpoints (REST, JSON)
- `GET  /referate?role=...` — inbox: referate with a `WAITING` task for that role.
- `GET  /referate/all` — overview list with statuses.
- `GET  /referate/:id` — full detail + tasks + transitions (istoric).
- `POST /referate` — create + materialize chain from `valoareLei`.
- `POST /referate/:id/approve` — body `{ actingUserId, comment? }`.
- `POST /referate/:id/reject` — body `{ actingUserId, comment (required) }`.
- `POST /referate/:id/send-back` — body `{ actingUserId, comment (required) }`.

## Frontend (`/web`)
- A single **`ApiService`** wraps all HTTP calls; API base URL from `environment`.
- Consistent app shell: top bar (app name + role switcher) + left nav; reused Material
  components and **one type scale** across screens. Clean, light, desktop-first.
- Screens: **Autentificare** (role switcher sets the acting user), **Referat nou** (validated
  Material form, hints which path the value triggers), **Inboxul meu** (Material table + quick
  Aprobă/Respinge/Trimite înapoi + empty state), **Detaliu referat** (data + Material **stepper**
  visibly different for <5000 vs ≥5000, per-step state, action panel with comment required for
  reject/send-back, read-only istoric timeline), **Toate referatele** (overview table with status
  chips).

## Romanian copy
- Status vocabulary (use these exact labels): *În așteptare, Aprobat, Respins, Trimis înapoi, Finalizat*.
- Buttons are imperative verbs: *Aprobă, Respinge, Trimite înapoi, Trimite referatul*.
- Correct diacritics (ș, ț, ă, î, â). No emoji.

## Seed
- ~6 realistic Romanian referate spanning **both paths** + one user per role; include a couple
  already mid-chain and one `FINALIZAT` so the demo looks alive.
- Examples: "Laptop Dell — Birou IT — 4.200 lei" (short path),
  "Pompă submersibilă — Stație captare — 18.500 lei" (full path).
- Expose a `seed` script (pnpm/npm). Provide `.env.example` with `DATABASE_URL`.

## Deliverables
- Root **README**: how to run `/api` (migrate + seed + start) and `/web` (serve) locally, plus
  deploy notes — `/web` → Vercel or Netlify (free), `/api` + Postgres → Railway or Render
  (free/hobby), with exact build/output settings.
