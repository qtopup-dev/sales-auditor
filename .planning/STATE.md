# Project State — Sales Auditing Web App

**Last updated:** 2026-06-17
**Mode:** yolo | **Granularity:** coarse

---

## Project Reference

**Core value:** Every sales entry is traceable — who submitted it, what changed, when, and by whom — giving the admin a reliable audit trail of all sales activity.

**Current focus:** Phase 1 — Foundation

**Stack:** React 18 + Vite + TypeScript (frontend) | Express v4 + Prisma v5 + MySQL (backend) | express-session + express-mysql-session (auth) | Monorepo via npm workspaces

---

## Current Position

| Field | Value |
|-------|-------|
| Milestone | 1 — v1 MVP |
| Current phase | 1 — Foundation |
| Current plan | None (planning not yet started) |
| Phase status | Not started |
| Overall progress | 0 of 4 phases complete |

```
Progress: [----] 0%
Phase 1: Foundation         [ ] Not started
Phase 2: Auth + Catalogs    [ ] Not started
Phase 3: Sales Core         [ ] Not started
Phase 4: Admin Dashboard    [ ] Not started
```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 0/4 |
| Requirements complete | 0/57 |
| Plans written | 0 |
| Plans complete | 0 |

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

### Todos

- [ ] Verify Express 4 vs Express 5 stable status at expressjs.com before Phase 1
- [ ] Verify Tailwind CSS v3 vs v4 stable status before Phase 1
- [ ] Verify Prisma v5 current patch via `npm info prisma version` before Phase 1
- [ ] Verify express-mysql-session is still actively maintained in 2026
- [ ] Confirm with user: SALES-03 dynamic row heights vs CSS truncation + tooltip for Notes field (before Phase 3)
- [ ] Confirm with user: Admin password reset UX — display new password or send reset-invite link?

### Blockers

*(none)*

---

## Session Continuity

**How to resume:** Read PROJECT.md and ROADMAP.md. Check current phase in this file. Run `/gsd-plan-phase 1` to begin planning Phase 1.

**Phase planning order:**
1. `/gsd-plan-phase 1` — Foundation (schema, monorepo, seed, Express skeleton)
2. `/gsd-plan-phase 2` — Auth + Catalogs (login, invite, sessions, RBAC, products, MOPs)
3. `/gsd-plan-phase 3` — Sales Core (inline-edit sheet, add row, void, transactional audit log)
4. `/gsd-plan-phase 4` — Admin Dashboard + Management (filters, charts, CSV, user management)
