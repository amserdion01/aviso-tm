# Build prompt — Aviso TM

Paste this to Claude in this folder to kick off the build (or just say
"follow PROMPT.md"). Conventions live in `CLAUDE.md`.

---

Build a DEMO full-stack app called "Aviso TM" — an internal "referat de necesitate"
(requisition) approval workflow for a water utility in Timișoara. This is a clickable
proposal demo with a REAL backend but NO real authentication. UI language: Romanian.

Create a monorepo with two folders:
  /api  — NestJS + Prisma + PostgreSQL (REST API)
  /web  — Angular (latest, standalone components, signals) + Angular Material

=== BACKEND (/api, NestJS + Prisma + Postgres) ===
Data model (Prisma schema):
- User(id, name, role)  // roles: ANGAJAT, SEF_IERARHIC, ACHIZITII, DIR_ECONOMIC, DIR_GENERAL
- Referat(id, articol, cantitate, justificare, centruCost, valoareLei int,
          requesterId, status, createdAt)
  // status: IN_ASTEPTARE | APROBAT | RESPINS | TRIMIS_INAPOI | FINALIZAT
- ApprovalTask(id, referatId, stepOrder, role, status, effectiveApproverId,
               actedById, actedAt, comment)
  // status: PENDING | WAITING | APPROVED | REJECTED | SENT_BACK
- Transition(id, referatId, fromState, toState, actorId, comment, createdAt)
  // APPEND-ONLY audit trail — only INSERT, never UPDATE/DELETE

Routing rule (the core — configurable threshold = 5000 lei):
- On submit, materialize the approval chain as ApprovalTask rows:
  1) SEF_IERARHIC  ->  2) ACHIZITII
  - if valoareLei >= 5000: add 3) DIR_ECONOMIC -> 4) DIR_GENERAL
  - if valoareLei < 5000: chain ends after ACHIZITII (simplified path)
- The active step is the single task with status WAITING; the rest start PENDING.
- Approve: mark current WAITING task APPROVED, flip the next PENDING task to WAITING;
  if none left, set referat FINALIZAT.
- Reject: ends the flow (referat RESPINS).
- Send back: re-activate the immediately previous step.
- EVERY action writes a Transition row in the SAME DB transaction as the advance.

Endpoints (REST, all return JSON):
- GET  /referate?role=...        // inbox: referate with a WAITING task for that role
- GET  /referate/all             // overview list with statuses
- GET  /referate/:id             // full detail + tasks + transitions (istoric)
- POST /referate                 // create + materialize chain from valoareLei
- POST /referate/:id/approve     // body: { actingUserId, comment? }
- POST /referate/:id/reject      // body: { actingUserId, comment (required) }
- POST /referate/:id/send-back   // body: { actingUserId, comment (required) }
Auth is faked for the demo: the acting user/role comes from the request body/query,
NOT from a session. Enable CORS for the Angular dev origin.

Seed script (~6 realistic Romanian referate spanning both paths + one user per role):
e.g. "Laptop Dell — Birou IT — 4.200 lei" (short path),
     "Pompă submersibilă — Stație captare — 18.500 lei" (full path),
plus a couple already mid-chain and one FINALIZAT, so the demo looks alive.
Add a pnpm/npm "seed" script. Provide .env.example with DATABASE_URL.

=== FRONTEND (/web, Angular + Angular Material) ===
Consume the API. Match this Material design language (clean, light, desktop-first,
Romanian copy). A single ApiService wraps all HTTP calls; API base URL from environment.
Screens:
1. Autentificare — a role switcher (dropdown: Angajat, Șef ierarhic, Birou Achiziții,
   Director Economic, Director General) that sets the "acting user" for the session.
2. Referat nou — Material form (Articol, Cantitate, Justificare, Centru de cost dropdown,
   Valoare estimată lei) with validation; hint which path the value triggers; POST on submit.
3. Inboxul meu — Material table of referate waiting on the current role with quick
   Aprobă / Respinge / Trimite înapoi actions; empty state.
4. Detaliu referat — full data + a Material STEPPER showing the chain (and visibly different
   for <5000 vs >=5000 paths) with per-step state; action panel (comment required for
   reject/send-back); read-only istoric timeline below.
5. Toate referatele — overview table with status badges (chips):
   În așteptare, Aprobat, Respins, Trimis înapoi, Finalizat.
Consistent app shell: top bar (app name + role switcher), left nav, reused Material
components and one type scale across all screens.

=== DELIVERABLES ===
- A root README with: how to run api (migrate + seed + start) and web (serve) locally,
  and deploy notes: /web -> Vercel or Netlify (free), /api + Postgres -> Railway or Render
  (free/hobby tier). Include the exact build/output settings.
- Keep all backend logic as real, readable code (no low-code), but keep scope to the demo.

Work in plan mode first: show me the monorepo layout, the Prisma schema, and the endpoint
list for my approval BEFORE writing code. Then build /api first (with seed working), then /web.
