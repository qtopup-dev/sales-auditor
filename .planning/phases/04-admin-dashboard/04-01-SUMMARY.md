---
plan: 04-01
phase: 4
title: "Backend — admin summary route, username PATCH, app.ts mount"
subsystem: backend
tags: [admin, api, aggregations, rbac, routing]
completed_date: 2026-06-26
duration_minutes: 15
tasks_completed: 2
tasks_total: 2

dependency_graph:
  requires: []
  provides:
    - GET /api/admin/summary (totalCount, totalRevenue, trendData, productBreakdown, mopBreakdown)
    - PATCH /api/users/:id/username (409 on USERNAME_TAKEN)
    - adminRouter mounted at /api/admin behind requireAuth + requireRole('admin')
  affects:
    - packages/backend/src/routes/admin.ts (created)
    - packages/backend/src/routes/users.ts (modified)
    - packages/backend/src/app.ts (modified)

tech_stack:
  added: []
  patterns:
    - Promise.all for concurrent Prisma queries
    - $queryRaw for DATE() expression grouping (Prisma groupBy limitation)
    - Decimal.toFixed(2) for DECIMAL(10,2) money fields as strings
    - Number(BigInt) conversion before JSON serialization
    - Express route registration order: specific paths before parameterized paths

key_files:
  created:
    - packages/backend/src/routes/admin.ts
  modified:
    - packages/backend/src/routes/users.ts
    - packages/backend/src/app.ts

decisions:
  - "Used Promise.all for 5 concurrent Prisma queries in GET /summary — no data dependencies between aggregations"
  - "Used $queryRaw for trendData DATE(createdAt) grouping — Prisma groupBy cannot group by expressions (RESEARCH.md Pitfall 2)"
  - "Decimal.toFixed(2) used for all money fields — never .toNumber() (CLAUDE.md Rule 6)"
  - "BigInt COUNT(*) converted via Number() before JSON serialization — native JSON.stringify fails on BigInt"
  - "PATCH /:id/username registered before PATCH /:id — prevents Express capturing 'username' as :id param value"
  - "isActive: undefined in conflict findFirst overrides $extends softDeleteFilter to check all users"
---

# Phase 4 Plan 01: Backend Admin Summary Route, Username PATCH, App Mount Summary

Admin backend infrastructure providing GET /api/admin/summary with five concurrent Prisma aggregations and PATCH /api/users/:id/username with 409 conflict detection, with adminRouter mounted at /api/admin behind requireAuth + requireRole('admin').

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create GET /api/admin/summary | ffd4afd | packages/backend/src/routes/admin.ts (created) |
| 2 | Add PATCH /:id/username + mount adminRouter | 06802f8 | packages/backend/src/routes/users.ts, packages/backend/src/app.ts |

## What Was Built

### GET /api/admin/summary

New `adminRouter` in `packages/backend/src/routes/admin.ts`:

- `requireRole('admin')` mounted at router level — all admin routes protected at T-04-01
- Single route handler uses `Promise.all` for 5 concurrent queries:
  1. `prisma.sale.count` — all sales (active + void) for org
  2. `prisma.sale.aggregate` — `_sum.priceSnapshot` for active sales only (revenue)
  3. `prisma.sale.groupBy(['productNameSnapshot'])` — count + revenue per product name
  4. `prisma.sale.groupBy(['mopNameSnapshot'])` — count per MOP name
  5. `prisma.$queryRaw` — `DATE(createdAt)` trend grouping (Prisma groupBy cannot do expression grouping)
- `totalRevenue` returned as `Decimal.toFixed(2)` string — CLAUDE.md Rule 6
- `trendData[].count` converted via `Number(BigInt)` — JSON.stringify cannot serialize BigInt
- All groupBy queries use snapshot columns, not product/MOP ID joins — CLAUDE.md Rule 4
- Explicit `status: { in: ['active', 'void'] }` on count/aggregate — CLAUDE.md Rule 8 (not covered by `$extends`)

### PATCH /api/users/:id/username

Inserted into `packages/backend/src/routes/users.ts` BEFORE the existing `PATCH /:id` handler:

- Route registered at line 48; existing `PATCH /:id` at line 106 — routing order verified
- `express-validator` validates username 2–100 chars
- Uniqueness conflict check: `findFirst({ where: { username, organizationId, NOT: { id: targetId }, isActive: undefined } })`
  - `isActive: undefined` overrides `$extends` softDeleteFilter to check ALL users (active and inactive)
- Returns `409 { error: 'USERNAME_TAKEN' }` on conflict
- Returns updated user object on success

### app.ts Mount

- `import { adminRouter } from './routes/admin.js'` added with other route imports
- `protectedRouter.use('/admin', adminRouter)` added after catalogRouter line
- Full auth chain: `app.use('/api', requireAuth, protectedRouter)` + `adminRouter.use(requireRole('admin'))` — double protection

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface Scan

No new threat surface beyond what the plan's threat model already covers. All mitigations applied:
- T-04-01: requireRole('admin') at adminRouter level
- T-04-02: express-validator + org-scoped uniqueness check
- T-04-03: organizationId from session (not user input), parameterized $queryRaw
- T-04-04: adminRouter added after existing routes, requireRole at router level

## Self-Check

Files exist:
- packages/backend/src/routes/admin.ts — FOUND
- packages/backend/src/routes/users.ts — FOUND (modified)
- packages/backend/src/app.ts — FOUND (modified)

Commits:
- ffd4afd — FOUND (Task 1: admin.ts)
- 06802f8 — FOUND (Task 2: users.ts + app.ts)

TypeScript compilation: zero errors from plan files (pre-existing seed.ts/tsconfig errors unrelated to this plan).

## Self-Check: PASSED
