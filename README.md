# Aviso TM

Internal **"referat de necesitate"** (requisition) approval-workflow **demo** for a water
utility in **Timișoara**. Real backend with **real authentication** (email + password →
JWT, 8h): the acting identity comes exclusively from the token. UI language: Romanian.

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
#    Then set a JWT secret (the API refuses to boot without one):
#    echo "JWT_SECRET=$(openssl rand -hex 32)" >> api/.env

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
| `pnpm --filter api test` | Jest unit tests (the routing-condition engine) |

### Configuration (`api/.env`)

| Var | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://aviso:aviso@localhost:5434/aviso_tm?schema=public` | Postgres connection |
| `PORT` | `3001` | API HTTP port (the web app's `environment.ts` targets this) |
| `CORS_ORIGIN` | `http://localhost:4200` | allowed origin (Angular dev server) |
| `APPROVAL_THRESHOLD_LEI` | `5000` | default value threshold the **seed** uses for the director-branch steps |
| `JWT_SECRET` | — | **required** — signs the auth JWTs (`openssl rand -hex 32`); the API refuses to start without it |
| `R2_ENDPOINT` (or `R2_ACCOUNT_ID`) | — | the bucket's S3 API endpoint, no bucket path (required for EU-jurisdiction buckets) |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | — | R2 API token (Object Read & Write) |
| `R2_BUCKET` | — | R2 bucket name for attachments |

## Autentificare (conturi demo)

> **Demonstrație publică.** Aceasta este o aplicație demo cu date fictive. Conturile și parola
> de mai jos sunt publice (documentate intenționat) — oricine se poate autentifica pentru a
> încerca orice rol. Nu introduceți informații reale. Login-ul e protejat de rate-limiting
> (10 încercări/min per IP) și de headere de securitate (helmet), dar rămâne deschis prin design.

Login real: `POST /auth/login` cu email + parolă → JWT (expiră în 8h). Nu există înregistrare —
utilizatorii vin din seed. **Parola demo, comună tuturor conturilor: `ApaTM2026!`**
(se poate schimba la seed cu `DEMO_PASSWORD=... pnpm api:seed`).

| Email | Rol |
| --- | --- |
| `andrei.popescu@apatim.ro` | Angajat (solicitant) |
| `maria.ionescu@apatim.ro` | Șef ierarhic |
| `vlad.marin@apatim.ro` | Serviciul IT |
| `ioana.neagu@apatim.ro` | Responsabil SSM |
| `elena.dumitru@apatim.ro` | Birou Achiziții |
| `radu.georgescu@apatim.ro` | Director Economic |
| `cristina.munteanu@apatim.ro` | Director General (administrează fluxul) |

Attachments are stored in **Cloudflare R2** (S3-compatible). Without the `R2_*` vars the rest of
the demo still works — only attachment upload/download returns a clear 503. Note: re-seeding wipes
the attachment **rows** but does not delete the orphaned objects from the bucket.

## Endpoints (REST, JSON)

All endpoints require `Authorization: Bearer <jwt>` **except** `POST /auth/login` and
`GET /users` (the demo roster shown on the login screen). The acting identity always comes
from the token — no user ids travel in payloads.

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | — | **public** — liveness/readiness probe (`SELECT 1`); `503` if the DB is unreachable |
| `POST` | `/auth/login` | `{ email, parola }` | **public** — returns `{ token, user }` (JWT, 8h); rate-limited (10/min per IP) |
| `GET` | `/auth/me` | — | the authenticated user's profile |
| `GET` | `/users` | — | **public** — demo roster (login screen); no password hashes |
| `GET` | `/referate` | — | inbox: referate with a `WAITING` task for **your** role |
| `GET` | `/referate/all` | — | overview list with statuses |
| `GET` | `/referate/mine` | — | the referate **you** submitted (drives "Referatele mele") |
| `GET` | `/referate/:id` | — | full detail + tasks + transitions (istoric) |
| `POST` | `/referate` | `{ articol, cantitate, justificare, centruCost, valoareLei, necesitaIt?, necesitaSsm? }` | create + materialize chain; requester = you |
| `POST` | `/referate/:id/resubmit` | same body as create | requester-only; correct a **sent-back** referat and resubmit (chain re-materialized from step 1) |
| `POST` | `/referate/:id/approve` | `{ comment? }` | approve current step (your role must match it) |
| `POST` | `/referate/:id/reject` | `{ comment }` | reject (comment required) → `RESPINS` |
| `POST` | `/referate/:id/send-back` | `{ comment, sendBackTo? }` | send back (comment required) to any earlier step (`sendBackTo` = its stepOrder; omitted = previous). Steps between the target and the current one are reset and re-walked |
| `GET` | `/referate/:id/pdf` | — | print-ready A4 PDF of the referat (any state; Puppeteer) |
| `POST` | `/referate/:id/atasamente` | multipart: `files` (max 5 × 10 MB) | attach files (stored in R2); allowed while `IN_ASTEPTARE` / `TRIMIS_INAPOI` |
| `GET` | `/referate/:id/atasamente/:attId/download` | — | `{ url }` — presigned R2 link (15 min) |
| `GET` | `/workflows` | — | list workflows with step counts |
| `GET` | `/workflows/active` | — | the active workflow + ordered steps |
| `GET` | `/workflows/:id` | — | one workflow + ordered steps |
| `PUT` | `/workflows/:id/steps` | `{ steps: [{ order, role, label, appliesWhen }] }` | replace the step list — **DIR_GENERAL only** |

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
# 1. Log in as the requester (demo password — see "Autentificare" above)
TOK=$(curl -s -X POST localhost:3001/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"andrei.popescu@apatim.ro","parola":"ApaTM2026!"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

curl -H "Authorization: Bearer $TOK" localhost:3001/referate/all
curl -H "Authorization: Bearer $TOK" localhost:3001/workflows/active   # the configurable chain
# 3.000 lei + necesitaIt → SEF_IERARHIC → IT → ACHIZITII (requester = the token user)
curl -X POST localhost:3001/referate -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d '{"articol":"Test","cantitate":1,"justificare":"x","centruCost":"Birou IT","valoareLei":3000,"necesitaIt":true}'
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
(role inbox with quick Aprobă / Trimite înapoi / Respinge), **Referatele mele** (the referate you
submitted + where each stands, with a *Corectează* action on ones sent back to you), **Referat
nou** (validated form with IT/SSM flag checkboxes + a live routing preview computed from the active
workflow — also reused to correct-and-resubmit a sent-back referat), **Detaliu referat** (data +
approval stepper + read-only istoric + action panel), **Toate referatele** (overview with status
chips), and **Administrare flux** (edit the active workflow's steps — role, label, and
applicability condition per step; shown only for the Director General). The identity
comes exclusively from the JWT login — switching roles means logging out (Deconectare) and back in
with another demo account.

Demo login: click a demo account row to fill its **email**, then type the demo password
(see "Autentificare" above — it is documented only in this README, never in code).

---

## Deploy notes

### `/api` + PostgreSQL → Railway or Render (free/hobby)

1. Provision a **PostgreSQL** instance; copy its connection string into `DATABASE_URL`.
2. Create a web service from the `api/` directory:
   - **Build:** `pnpm install && pnpm --filter api exec prisma generate && pnpm --filter api build`
   - **Release / pre-deploy:** `pnpm --filter api exec prisma migrate deploy` (then optionally `pnpm api:seed` once)
   - **Start:** `pnpm --filter api start:prod` (runs `node dist/main.js`)
3. Set env vars: `DATABASE_URL`, `PORT` (the platform usually injects it),
   `CORS_ORIGIN` = the deployed web origin, a **strong `JWT_SECRET`** (`openssl rand -hex 32`),
   and the four `R2_*` vars for attachment storage.
   - **Health check path:** point the platform's health check at **`/health`** (public,
     returns `503` if it can't reach Postgres).
   - Run `pnpm --filter api test` in CI before deploy (see `.github/workflows/ci.yml`).
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
