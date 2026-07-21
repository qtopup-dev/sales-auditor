---
phase: 10-add-the-option-to-delete-receivers-for-the-admin-role-mirror
plan: 01
subsystem: database
tags: [prisma, mysql, soft-delete, schema-migration]

# Dependency graph
requires:
  - phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
    provides: The exact deletedAt soft-delete pattern (schema field + index + manual migration workflow + $extends filter injection) this plan mirrors for Receiver
provides:
  - deletedAt DateTime? nullable column + composite (organizationId, deletedAt) index on the live receivers table
  - Regenerated Prisma client exposing deletedAt on the Receiver model type
  - Extended $extends softDeleteFilter receiver.findMany block injecting deletedAt: null alongside isActive: true, with no override path anywhere
affects: [10-02-delete-route, 10-03-frontend-delete-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second soft-delete signal (deletedAt) distinct from isActive on catalog models — mirrors Phase 9 D-01/D-02, now applied uniformly to Product/Mop/User/Receiver"
    - "Manual migration workflow (prisma db execute + prisma migrate resolve --applied) instead of prisma migrate dev, due to unmanaged sessions table drift"

key-files:
  created:
    - packages/backend/prisma/migrations/20260721131247_add-receiver-deleted-at/migration.sql
  modified:
    - packages/backend/prisma/schema.prisma
    - packages/backend/src/lib/prisma.ts

key-decisions:
  - "No deletedAt override was introduced anywhere for receivers (unlike isActive: undefined on the admin list route) — deleted receivers are unconditionally excluded from both the admin table and the catalog combo box, since there is no 'show deleted' surface in this phase"

patterns-established:
  - "Receiver model now has the same dual soft-delete shape as Product/Mop/User: isActive (reversible Deactivate) + deletedAt (stricter Delete)"

requirements-completed: [PHASE10-SC1, PHASE10-SC2]

# Metrics
duration: 15min
completed: 2026-07-21
---

# Phase 10 Plan 01: Receiver deletedAt schema + migration + filter Summary

**Added a second, nullable `deletedAt` soft-delete signal to the Receiver model — schema field, composite index, live MySQL migration, and `$extends` filter injection — mirroring Phase 9's Product/Mop/User pattern exactly, with zero override path.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-21T13:50:00Z
- **Completed:** 2026-07-21T14:05:52Z
- **Tasks:** 3
- **Files modified:** 3 (schema.prisma, migration.sql created, prisma.ts)

## Accomplishments
- `deletedAt DateTime?` field + `@@index([organizationId, deletedAt])` added to the `Receiver` model in schema.prisma, mirroring the exact field/comment used for Product/Mop/User in Phase 9
- Migration created by hand (`20260721131247_add-receiver-deleted-at`), applied to the live `alejinput_db` MySQL database via `prisma db execute`, registered via `prisma migrate resolve --applied`, and Prisma client regenerated — `receivers` table now has a nullable `deletedAt DATETIME(3)` column and matching composite index
- Extended the shared `$extends` `softDeleteFilter` `receiver.findMany` block to inject `deletedAt: null` alongside the existing `isActive: true` default, with no override introduced anywhere in the codebase — deleted receivers vanish from both `GET /api/receivers` (admin) and `GET /api/catalog/receivers` (combo box)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update schema.prisma — add deletedAt to the Receiver model** - `011be4f` (feat)
2. **Task 2: Create migration manually, apply via db execute + migrate resolve, regenerate client** - `cc8b575` (feat)
3. **Task 3: Extend prisma.ts softDeleteFilter — inject deletedAt: null default on receiver.findMany** - `0cf09ac` (feat)

_No separate plan-metadata commit — final commit below covers SUMMARY/STATE/ROADMAP._

## Files Created/Modified
- `packages/backend/prisma/schema.prisma` - Added `deletedAt DateTime?` field + `@@index([organizationId, deletedAt])` to the `Receiver` model
- `packages/backend/prisma/migrations/20260721131247_add-receiver-deleted-at/migration.sql` - Hand-written migration adding `deletedAt` column + composite index to the `receivers` table
- `packages/backend/src/lib/prisma.ts` - Extended `receiver.findMany` in the `$extends` softDeleteFilter to inject `deletedAt: null` alongside `isActive: true`

## Decisions Made
- Followed the plan's explicit instruction to introduce zero `deletedAt` override path for receivers (unlike the existing `isActive: undefined` override on the admin route) — this is intentional per the plan's threat model (T-10-01/T-10-02) since no "show deleted" surface exists for receivers in this phase
- Used UTC timestamp `20260721131247` for the migration directory name, generated via `date -u +%Y%m%d%H%M%S` as instructed

## Deviations from Plan

None - plan executed exactly as written. All three tasks completed with no auto-fixes required; Docker container and `.env` files were already present and healthy, so no fallback paths from the plan's contingency instructions were needed.

## Issues Encountered

None. Migration applied cleanly on the first attempt (Docker `alejinput-mysql-1` container was already running and healthy; both gitignored `.env` files were already present).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The `receivers` table and Prisma client now expose `deletedAt`, and the shared filter enforces it by default — Plan 02 (DELETE route) and Plan 03 (frontend delete UI) can now build directly on this data contract without any further schema work.
- `Sale`, `AuditLog`, `Shift`, `Product`, `Mop`, `User` schema and data were verified untouched (grep-confirmed no `deletedAt` occurrence added outside the `Receiver`/existing Phase-9 model blocks, and no `ALTER TABLE` statement in the migration targets any table other than `receivers`).
- No blockers.

---
*Phase: 10-add-the-option-to-delete-receivers-for-the-admin-role-mirror*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: packages/backend/prisma/migrations/20260721131247_add-receiver-deleted-at/migration.sql
- FOUND: packages/backend/prisma/schema.prisma
- FOUND: packages/backend/src/lib/prisma.ts
- FOUND commit: 011be4f
- FOUND commit: cc8b575
- FOUND commit: 0cf09ac
