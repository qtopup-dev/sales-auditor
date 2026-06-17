---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in_progress
last_updated: "2026-06-17T06:54:07Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 5
  completed_plans: 5
  percent: 100
---

# Project State — Sales Auditing Web App

**Last updated:** 2026-06-17
**Mode:** yolo | **Granularity:** coarse
**Last session:** Phase 1 plan 01-04 complete — Express 5 backend skeleton with helmet, mysql session store, GET /health 200 confirmed, TZ=UTC at startup

---

## Project Reference

**Core value:** Every sales entry is traceable — who submitted it, what changed, when, and by whom — giving the admin a reliable audit trail of all sales activity.

**Current focus:** Phase --phase — 01

**Stack:** React 18 + Vite + TypeScript (frontend) | Express v4 + Prisma v5 + MySQL (backend) | express-session + express-mysql-session (auth) | Monorepo via npm workspaces

---

## Current Position

Phase: --phase (01) — EXECUTING
Plan: 1 of --name
| Field | Value |
|-------|-------|
| Milestone | 1 — v1 MVP |
| Current phase | 1 — Foundation |
| Current plan | 01-04 (complete) |
| Phase status | Complete — 5/5 plans complete |
| Overall progress | 1 of 4 phases complete |

```
Progress: [=====>] 25%
Phase 1: Foundation         [==========] Complete (5/5 plans complete)
Phase 2: Auth + Catalogs    [ ] Not started
Phase 3: Sales Core         [ ] Not started
Phase 4: Admin Dashboard    [ ] Not started
```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 1/4 |
| Requirements complete | 0/57 |
| Plans written | 5 |
| Plans complete | 5 |

---

## Accumulated Context

### Key Decisions Locked

| Decision | Rationale |
|----------|-----------|
| express-session over JWT | Admin password reset and edit-rights revocation require immediate server-side session invalidation — JWT statelessness is incompatible |
| Prisma ORM (never raw SQL) | Type safety, auto-migration, prisma middleware for soft-delete filter enforcement, easier v2 multi-tenant evolution |
| Pessimistic UI updates | Small team, low VPS latency, eliminates rollback complexity for rapid successive inline edits |
| DECIMAL(10,2) for all monetary fields | Prevents JS float precision loss; return price as string from API; all server-side math via Prisma.Decimal |
| organization_id on every business table | Near-zero cost now; essential for v2 multi-tenant migration — retrofitting is a multi-hour migration on every table |
| Soft-delete only (status ENUM, is_active BOOLEAN) | Full auditability — no data is ever lost; Prisma middleware enforces filter on all list queries |
| Price snapshot at row creation | price_snapshot column on sales row; joining back to products table for display price is explicitly forbidden |
| Audit log in same DB transaction as mutation | AUDIT-02 hard constraint — impossible to mutate without an audit record; impossible to have orphaned audit records |
| Virtual scroll with @tanstack/react-virtual | Dynamic row heights via dynamic size measurement; edit state in Zustand isolated from React Query server state |
| Monorepo — npm workspaces | /packages/backend, /packages/frontend, /packages/shared for shared TypeScript types |
| React pinned to 18.3.1 exact (no caret) | npm latest is React 19.x; caret would allow accidental upgrade |
| Prisma 7.x adopted (not v5) | npm latest is Prisma 7.8.0; research covers v7 patterns ($extends, prisma.config.ts, dotenv/config) |
| Backend tsconfig uses moduleResolution:node16 | tsx runs in Node.js context where bundler resolution is invalid |
| MySQL docker-compose uses mysql_native_password | Avoids caching_sha2_password issues with mariadb JS driver |
| TypeScript ~5.9.3 pinned (not TS 6) | Avoids ecosystem compatibility risk with Vite 8 and tsx 4.x |
| Prisma 7 config at CWD root (packages/backend/prisma.config.ts) | Prisma 7 CLI resolves config relative to CWD; placing in prisma/ subdirectory fails |
| Prisma 7 generates client.ts (not index.js) | Entry point is client.js for ESM resolution; imports must use client.js not index.js |
| Seed command in prisma.config.ts migrations.seed | Prisma 7 no longer reads package.json prisma.seed field |
| packages/backend/.env alongside root .env | Prisma CLI resolves dotenv from CWD (packages/backend/); root .env not found |
| MySQL 8.4 uses --mysql-native-password=ON | --default-authentication-plugin removed in MySQL 8.4 |
| Vite config sets root: __dirname via fileURLToPath(import.meta.url) | When invoked via `vite --config packages/frontend/vite.config.ts` from repo root, Vite resolves index.html relative to CWD; setting root to config file's directory is required |
| errorHandler reads err.statusCode and err.code for extensibility | Phase 2 auth errors use statusCode: 401 + code: 'UNAUTHORIZED' pattern; fallback to 500/INTERNAL_ERROR |
| express-mysql-session pool separate from Prisma mariadb adapter | MySQLStore(session) pattern with dedicated mysql2.createPool; sessions table auto-created with createDatabaseTable: true |

### Critical Pitfalls to Watch

- Soft-delete filter leakage: voided rows must never appear in totals or dropdowns — use Prisma global where extension
- RBAC middleware must be mounted at router level, not per-route — new routes outside protected router break security
- Backend must enforce row ownership — never trust frontend UI alone (ROLES-09)
- MemoryStore is not for production — configure express-mysql-session from day one
- Audit records must capture Prisma return values, not raw input (prevents phantom change records on numeric coercion)
- Inline edit state in Zustand must be isolated from React Query server data — prevents focus-loss bugs during virtual scroll
- CSV injection: sanitize any value starting with =, -, +, @, tab, CR; prepend UTF-8 BOM
- Invite link: GET renders form only (stateless); POST consumes token — prevents security scanner false-consumption
- All three UTC configs required: MySQL my.cnf + Prisma connection URL (?timezone=UTC) + TZ=UTC Node env var
- Prisma 7: prisma.config.ts must be at CWD root (where npx prisma runs), NOT inside prisma/ subdirectory
- Prisma 7: generated client entry point is client.ts/client.js NOT index.js — update all imports
- Prisma 7: seed command is migrations.seed in prisma.config.ts, NOT package.json prisma.seed

### Todos

- [x] Verify Express 4 vs Express 5 stable status → Express 5.2.1 is stable (Oct 2024); plans use Express 5
- [ ] Verify Tailwind CSS v3 vs v4 stable status before Phase 2 (frontend build phase)
- [x] Verify Prisma v5 current patch → Prisma 7.8.0 is latest; plans use Prisma 7 with $extends pattern
- [x] Verify express-mysql-session active maintenance → v3.0.3, last release July 2024, still maintained
- [ ] Confirm with user: SALES-03 dynamic row heights vs CSS truncation + tooltip for Notes field (before Phase 3)
- [ ] Confirm with user: Admin password reset UX — display new password or send reset-invite link?

### Blockers

*(none)*

---

## Session Continuity

**How to resume:** Read PROJECT.md and ROADMAP.md. Check current phase in this file. Run `/gsd-execute-phase 1` to execute the 5 plans for Phase 1.

**Phase planning order:**

1. `/gsd-plan-phase 1` — Foundation (schema, monorepo, seed, Express skeleton)
2. `/gsd-plan-phase 2` — Auth + Catalogs (login, invite, sessions, RBAC, products, MOPs)
3. `/gsd-plan-phase 3` — Sales Core (inline-edit sheet, add row, void, transactional audit log)
4. `/gsd-plan-phase 4` — Admin Dashboard + Management (filters, charts, CSV, user management)
