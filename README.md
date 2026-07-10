# Aviso TM

Internal **"referat de necesitate"** (requisition) approval-workflow **demo** for a water
utility in **Timișoara**. Clickable proposal demo with a **real backend** but **no real
authentication** (the acting user/role is faked, sent from the client). UI language: Romanian.

This is a pnpm monorepo:

| Folder | Stack | Status |
| --- | --- | --- |
| [`api/`](./api) | NestJS + Prisma + PostgreSQL (REST/JSON) | ✅ complete & testable |
| [`web/`](./web) | Angular 20 (standalone + signals) + Angular Material | ✅ complete, themed to the Aviso design system |

The workflow rules, domain model, and endpoints are documented in [`CLAUDE.md`](./CLAUDE.md).
The web UI recreates the **Aviso** Claude Design handoff (water-blue brand, IBM Plex type, calm
slate neutrals); all design tokens live in `web/src/styles/tokens/` and are mapped onto a single
Angular Material theme in `web/src/styles.scss`.

---

## Prerequisites

- **Node 20+** and **pnpm 10+** (`corepack enable` or `npm i -g pnpm`)
- **Docker** (for the local PostgreSQL via Docker Compose)

## Run the API locally

From the repo root:

```bash
# 1. Install dependencies (whole workspace)
pnpm install

# 2. Start PostgreSQL (Docker Compose; host port 5434 to avoid clashing with other local DBs)
pnpm db:up

# 3. Configure the API env
cp api/.env.example api/.env        # defaults already match docker-compose.yml

# 4. Apply the schema (creates tables + Prisma client)
pnpm api:migrate                    # = prisma migrate dev

# 5. Seed the active workflow, the IT/SSM approver users & ~19 realistic referate
pnpm api:seed

# 6. Start the API (watch mode) on http://localhost:3001
pnpm api:start
```

Convenience scripts (defined in the root `package.json`):

| Script | Action |
| --- | --- |
| `pnpm db:up` / `pnpm db:down` | start / stop the Postgres container |
| `pnpm api:migrate` | `prisma migrate dev` in `api/` |
| `pnpm api:seed` | reset + seed the demo data |
| `pnpm api:start` | `nest start --watch` |
| `pnpm api:build` | production build to `api/dist` |

### Configuration (`api/.env`)

| Var | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://aviso:aviso@localhost:5434/aviso_tm?schema=public` | Postgres connection |
| `PORT` | `3001` | API HTTP port (the web app's `environment.ts` targets this) |
| `CORS_ORIGIN` | `http://localhost:4200` | allowed origin (Angular dev server) |
| `APPROVAL_THRESHOLD_LEI` | `5000` | default value threshold the **seed** uses for the director-branch steps |
| `R2_ENDPOINT` (or `R2_ACCOUNT_ID`) | — | the bucket's S3 API endpoint, no bucket path (required for EU-jurisdiction buckets) |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | — | R2 API token (Object Read & Write) |
| `R2_BUCKET` | — | R2 bucket name for attachments |

Attachments are stored in **Cloudflare R2** (S3-compatible). Without the `R2_*` vars the rest of
the demo still works — only attachment upload/download returns a clear 503. Note: re-seeding wipes
the attachment **rows** but does not delete the orphaned objects from the bucket.

## Endpoints (REST, JSON)

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| `GET` | `/users` | — | all users (backs the role switcher) |
| `GET` | `/referate?role=...` | — | inbox: referate with a `WAITING` task for that role |
| `GET` | `/referate/all` | — | overview list with statuses |
| `GET` | `/referate/:id` | — | full detail + tasks + transitions (istoric) |
| `POST` | `/referate` | `{ articol, cantitate, justificare, centruCost, valoareLei, necesitaIt?, necesitaSsm?, requesterId }` | create + materialize chain from the active workflow |
| `POST` | `/referate/:id/approve` | `{ actingUserId, comment? }` | approve current step |
| `POST` | `/referate/:id/reject` | `{ actingUserId, comment }` | reject (comment required) → `RESPINS` |
| `POST` | `/referate/:id/send-back` | `{ actingUserId, comment }` | send back (comment required) → re-activates previous step |
| `GET` | `/referate/:id/pdf` | — | print-ready A4 PDF of the referat (any state, served inline; Puppeteer) |
| `POST` | `/referate/:id/atasamente` | multipart: `files` (max 5 × 10 MB), `actingUserId` | attach files (stored in R2); allowed while `IN_ASTEPTARE` / `TRIMIS_INAPOI` |
| `GET` | `/referate/:id/atasamente/:attId/download` | — | 302 → presigned R2 URL (15 min) |
| `GET` | `/workflows` | — | list workflows with step counts |
| `GET` | `/workflows/active` | — | the active workflow + ordered steps |
| `GET` | `/workflows/:id` | — | one workflow + ordered steps |
| `PUT` | `/workflows/:id/steps` | `{ steps: [{ order, role, label, appliesWhen }] }` | replace the whole ordered step list (add/remove/reorder/edit) |

**Routing rule (configurable):** the approval chain is **data-driven** — new referate route against
the single active `Workflow`. On submit, each `WorkflowStep` whose `appliesWhen` condition matches
the referat (value threshold + the `necesitaIt` / `necesitaSsm` flags, with `all`/`any` combinators;
`null` = always) becomes an `ApprovalTask`, in order. The standard seeded workflow reproduces
`SEF_IERARHIC → (IT?) → (SSM?) → ACHIZITII → DIR_ECONOMIC → DIR_GENERAL`, where IT/SSM apply only
when their flag is set and the two director steps apply only when `valoareLei >= 5000`. The active
step is the single `WAITING` task. Every action writes an append-only `Transition` row in the
**same** DB transaction that advances the workflow. Edit the chain from the **Administrare flux**
admin screen (Director General) or via `PUT /workflows/:id/steps`.

### Quick smoke test

```bash
curl localhost:3001/referate/all
curl localhost:3001/workflows/active                       # the configurable chain + its conditions
ANG=$(curl -s localhost:3001/users | python3 -c 'import sys,json;print({u["role"]:u["id"] for u in json.load(sys.stdin)}["ANGAJAT"])')
# 3.000 lei + necesitaIt → SEF_IERARHIC → IT → ACHIZITII
curl -X POST localhost:3001/referate -H 'Content-Type: application/json' \
  -d "{\"articol\":\"Test\",\"cantitate\":1,\"justificare\":\"x\",\"centruCost\":\"Birou IT\",\"valoareLei\":3000,\"necesitaIt\":true,\"requesterId\":\"$ANG\"}"
```

## Run the web app

With the API running (above), in a second terminal:

```bash
pnpm web:start          # ng serve → http://localhost:4200
```

The app consumes the API via a single `ApiService`; the base URL comes from
`web/src/environments/environment.ts` (defaults to `http://localhost:3001`). The API already
enables CORS for `http://localhost:4200`.

Screens (all Romanian): **Autentificare** (role-based login with demo accounts), **Inboxul meu**
(role inbox with quick Aprobă / Trimite înapoi / Respinge), **Referat nou** (validated form with
IT/SSM flag checkboxes + a live routing preview computed from the active workflow), **Detaliu
referat** (data + approval stepper + read-only istoric + action panel), **Toate referatele**
(overview with status chips), and **Administrare flux** (edit the active workflow's steps — role,
label, and applicability condition per step; shown only for the Director General). The role switcher
in the top bar sets the acting user for every request.

Demo login: pick any of the demo accounts (one per role — including the IT and SSM approvers); any
non-empty password is accepted. There is **no autologin** — the form starts empty; clicking a demo
account fills its credentials.

---

## Deploy notes

### `/api` + PostgreSQL → Railway or Render (free/hobby)

1. Provision a **PostgreSQL** instance; copy its connection string into `DATABASE_URL`.
2. Create a web service from the `api/` directory:
   - **Build:** `pnpm install && pnpm --filter api exec prisma generate && pnpm --filter api build`
   - **Release / pre-deploy:** `pnpm --filter api exec prisma migrate deploy` (then optionally `pnpm api:seed` once)
   - **Start:** `pnpm --filter api start:prod` (runs `node dist/main.js`)
3. Set env vars: `DATABASE_URL`, `PORT` (the platform usually injects it),
   `CORS_ORIGIN` = the deployed web origin, and the four `R2_*` vars for attachment storage.
4. PDF generation uses **Puppeteer** (bundled Chromium): make sure the build does NOT set
   `PUPPETEER_SKIP_DOWNLOAD`, and the image has Chromium's system deps (Railway/Render's
   default Node images generally work; otherwise add the puppeteer apt packages).

### `/web` → Vercel or Netlify (free)

- **Build:** `pnpm install && pnpm --filter web build`
- **Output directory:** `web/dist/aviso-web/browser` (Angular's default build output)
- **SPA rewrite:** route all paths to `index.html` (Vercel: a catch-all rewrite to `/index.html`;
  Netlify: `/*  /index.html  200`).
- Set the production API base URL in `web/src/environments/environment.production.ts`
  (`apiBaseUrl`) to the deployed API origin, and add the deployed web origin to the API's
  `CORS_ORIGIN`.
