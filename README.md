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

# 5. Seed ~6 realistic referate spanning both routing paths
pnpm api:seed

# 6. Start the API (watch mode) on http://localhost:3000
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
| `PORT` | `3000` | API HTTP port |
| `CORS_ORIGIN` | `http://localhost:4200` | allowed origin (Angular dev server) |
| `APPROVAL_THRESHOLD_LEI` | `5000` | the single routing threshold (full chain at/above this) |

## Endpoints (REST, JSON)

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| `GET` | `/users` | — | all users (backs the role switcher) |
| `GET` | `/referate?role=...` | — | inbox: referate with a `WAITING` task for that role |
| `GET` | `/referate/all` | — | overview list with statuses |
| `GET` | `/referate/:id` | — | full detail + tasks + transitions (istoric) |
| `POST` | `/referate` | `{ articol, cantitate, justificare, centruCost, valoareLei, requesterId }` | create + materialize chain |
| `POST` | `/referate/:id/approve` | `{ actingUserId, comment? }` | approve current step |
| `POST` | `/referate/:id/reject` | `{ actingUserId, comment }` | reject (comment required) → `RESPINS` |
| `POST` | `/referate/:id/send-back` | `{ actingUserId, comment }` | send back (comment required) → re-activates previous step |

**Routing rule:** on submit the chain is materialized as `ApprovalTask` rows —
`SEF_IERARHIC → ACHIZITII`, plus `DIR_ECONOMIC → DIR_GENERAL` when `valoareLei >= 5000`. The
active step is the single `WAITING` task. Every action writes an append-only `Transition` row
in the **same** DB transaction that advances the workflow.

### Quick smoke test

```bash
curl localhost:3000/referate/all
ANG=$(curl -s localhost:3000/users | python3 -c 'import sys,json;print({u["role"]:u["id"] for u in json.load(sys.stdin)}["ANGAJAT"])')
curl -X POST localhost:3000/referate -H 'Content-Type: application/json' \
  -d "{\"articol\":\"Test\",\"cantitate\":1,\"justificare\":\"x\",\"centruCost\":\"IT\",\"valoareLei\":18500,\"requesterId\":\"$ANG\"}"
```

## Run the web app

With the API running (above), in a second terminal:

```bash
pnpm web:start          # ng serve → http://localhost:4200
```

The app consumes the API via a single `ApiService`; the base URL comes from
`web/src/environments/environment.ts` (defaults to `http://localhost:3000`). The API already
enables CORS for `http://localhost:4200`.

Screens (all Romanian): **Autentificare** (role-based login with demo accounts), **Inboxul meu**
(role inbox with quick Aprobă / Trimite înapoi / Respinge), **Referat nou** (validated form with a
live routing-path hint), **Detaliu referat** (data + approval stepper + read-only istoric +
action panel), **Toate referatele** (overview with status chips). The role switcher in the top bar
sets the acting user for every request.

Demo login: pick any of the five demo accounts (one per role); any non-empty password is accepted.

---

## Deploy notes

### `/api` + PostgreSQL → Railway or Render (free/hobby)

1. Provision a **PostgreSQL** instance; copy its connection string into `DATABASE_URL`.
2. Create a web service from the `api/` directory:
   - **Build:** `pnpm install && pnpm --filter api exec prisma generate && pnpm --filter api build`
   - **Release / pre-deploy:** `pnpm --filter api exec prisma migrate deploy` (then optionally `pnpm api:seed` once)
   - **Start:** `pnpm --filter api start:prod` (runs `node dist/main.js`)
3. Set env vars: `DATABASE_URL`, `PORT` (the platform usually injects it), and
   `CORS_ORIGIN` = the deployed web origin.

### `/web` → Vercel or Netlify (free)

- **Build:** `pnpm install && pnpm --filter web build`
- **Output directory:** `web/dist/aviso-web/browser` (Angular's default build output)
- **SPA rewrite:** route all paths to `index.html` (Vercel: a catch-all rewrite to `/index.html`;
  Netlify: `/*  /index.html  200`).
- Set the production API base URL in `web/src/environments/environment.production.ts`
  (`apiBaseUrl`) to the deployed API origin, and add the deployed web origin to the API's
  `CORS_ORIGIN`.
