---
phase: 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal
plan: 01
subsystem: database
tags: [prisma, mysql, migration, schema, shifts, foreign-key, generated-column, race-condition]

# Dependency graph
requires:
  - phase: 05-receiver-catalog
    provides: Manual migration workflow precedent (db execute + migrate resolve) for environments with an unmanaged sessions table
provides:
  - shifts table in MySQL (id, organizationId, userId, clockInAt, clockOutAt nullable, createdAt, updatedAt)
  - DB-level openLock generated column + unique index enforcing at most one open shift per (organizationId, userId)
  - sales.shiftId nullable FK column (no backfill — pre-Phase-7 rows have shiftId = NULL)
  - Prisma Shift model with Organization and User relations, regenerated client exposing prisma.shift.*
affects:
  - 07-02 (clock-in/clock-out routes need Shift model types and must handle P2002 on openLock unique violation)
  - 07-03 (sales router — shiftId association on row creation)
  - 07-04 through 07-08 (shift history, live totals, shared types, frontend UI all depend on this schema)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MySQL generated STORED column + unique index as a DB-level race guard for 'at most one open X per user' constraints (openLock pattern)"
    - "prisma db execute + migrate resolve for drift-safe manual migrations (Phase 5 precedent, reused here)"

key-files:
  created:
    - packages/backend/prisma/migrations/20260717173220_add-shift-clock-in-out/migration.sql
  modified:
    - packages/backend/prisma/schema.prisma

key-decisions:
  - "openLock generated column: IF(clockOutAt IS NULL, userId, NULL) STORED, unique on (organizationId, openLock) — collapses to NULL once a shift closes, so MySQL's unique index only ever constrains the currently-open shift per moderator"
  - "shifts_userId_fkey uses ON UPDATE RESTRICT instead of this project's usual ON UPDATE CASCADE convention — MySQL 8.4 forbids CASCADE/SET NULL/SET DEFAULT on a base column referenced inside an indexed generated column's expression; RESTRICT is functionally identical here since users.id is an immutable auto-increment PK"
  - "FKs added in two phases within the migration: organizationId FK before the generated column, but userId FK is added AFTER the openLock column and its unique index exist (order matters — see Deviations)"
  - "Sale.shiftId nullable, no backfill migration step — matches D-02, unlike the Phase 5 receiverId NOT NULL backfill pattern"

patterns-established:
  - "openLock-style generated column race guard: reusable pattern for any future 'only one active X per Y' DB constraint"

requirements-completed: []

# Metrics
duration: 26min
completed: 2026-07-17
---

# Phase 07 Plan 01: Shift Schema + Migration Summary

**shifts table added with a MySQL generated-column race guard (openLock) that enforces at most one open shift per moderator at the DB layer, plus a nullable sales.shiftId FK with no backfill**

## Performance

- **Duration:** 26 min
- **Started:** 2026-07-17T17:30:00Z (approx.)
- **Completed:** 2026-07-17T17:56:00Z
- **Tasks:** 2
- **Files modified:** 2 (schema.prisma, migration.sql)

## Accomplishments

- `Shift` model added to Prisma schema: `organizationId`/`userId` FKs, `clockInAt` (defaults to now), nullable `clockOutAt`, standard timestamps; `Organization.shifts` and `User.shifts` relations wired
- `Sale` model updated: nullable `shiftId` FK + `shift` relation added between `receiverNameSnapshot` and `notes`; new `@@index([organizationId, shiftId])`
- Migration applied manually (db execute + migrate resolve) creating the `shifts` table, the `openLock` DB-level race guard, and `sales.shiftId`
- Prisma client regenerated — `prisma.shift.*` delegate and `Shift` model types confirmed present via `models/Shift.ts` and a runtime smoke test (`prisma.shift.count()` returns 0, `sale.findFirst({ select: { shiftId: true } })` returns `{ shiftId: null }` for existing rows)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update schema.prisma — add Shift model and Sale.shiftId FK** - `f5ba88a` (feat)
2. **Task 2: Create migration manually, apply via db execute + migrate resolve, regenerate client** - `a39f179` (feat)

**Plan metadata:** (docs commit follows, applied by orchestrator after wave merge — this plan ran in worktree mode)

## Files Created/Modified

- `packages/backend/prisma/schema.prisma` — Added `Shift` model; `Organization.shifts` and `User.shifts` relations; `Sale.shiftId`/`Sale.shift` fields + composite index
- `packages/backend/prisma/migrations/20260717173220_add-shift-clock-in-out/migration.sql` — `CREATE TABLE shifts`, `openLock` generated column + unique index, `shifts_organizationId_fkey`/`shifts_userId_fkey`, `sales.shiftId` nullable column + FK + composite index

## Decisions Made

- **openLock race guard placement**: Generated column `IF(clockOutAt IS NULL, userId, NULL) STORED` with a unique index on `(organizationId, openLock)`. Rows with a closed shift (`clockOutAt` set) collapse to `openLock = NULL`, and MySQL unique indexes permit unlimited `NULL`s — so only the single currently-open shift per moderator is constrained. A losing concurrent clock-in gets a Prisma `P2002`, which Plan 02's route handler will catch and treat as the D-01 no-op.
- **shifts_userId_fkey uses `ON UPDATE RESTRICT`** instead of the project's usual `ON UPDATE CASCADE` — required by a MySQL 8.4 constraint (see Deviations below). No functional impact since `users.id` never changes.
- **Migration statement ordering**: generated column and its unique index are added to the `shifts` table BEFORE the `userId` foreign key (but AFTER the `organizationId` foreign key, which has no such restriction). This ordering was required to avoid the MySQL error described below.
- **No backfill for `sales.shiftId`**: matches D-02 exactly — column added as nullable with no data migration, unlike Phase 5's `receiverId` NOT-NULL backfill pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reordered FK/generated-column statements and changed `shifts_userId_fkey`'s ON UPDATE action to fix a MySQL 8.4 constraint violation**
- **Found during:** Task 2 (apply migration via `prisma db execute`)
- **Issue:** The plan's SQL (FKs immediately after `CREATE TABLE`, then the `openLock` generated column) failed with `Error: Cannot add foreign key constraint` (MySQL error 1215, `ER_CANNOT_ADD_FOREIGN`). Root-caused via direct `mysql2` connection testing (no `mysql` CLI available in this environment) and MySQL's generated-column documentation: MySQL 8.4 forbids `ON UPDATE CASCADE` (also `SET NULL`/`SET DEFAULT`) on a foreign-key base column that is referenced inside an **indexed** generated column's expression. `openLock`'s expression reads `userId`, and `openLock` is part of a UNIQUE index — so adding `shifts_userId_fkey` with `ON UPDATE CASCADE` (this project's usual FK convention, used everywhere else in schema.prisma) is rejected by InnoDB, with a misleading generic FK error rather than a message naming the real cause. Confirmed root cause empirically: the identical FK addition succeeds immediately when the referential action is changed to `RESTRICT`, and also succeeds when tested against a generated column that does NOT reference `userId`.
- **Fix:** (a) Reordered the migration so the `openLock` generated column and its unique index are created before `shifts_userId_fkey` (the `organizationId` FK, unaffected by the restriction, remains before the generated column for clarity). (b) Changed `shifts_userId_fkey`'s referential action from `ON DELETE RESTRICT ON UPDATE CASCADE` to `ON DELETE RESTRICT ON UPDATE RESTRICT`. Since `users.id` is an immutable auto-increment primary key that this app never updates, `RESTRICT` vs `CASCADE` on UPDATE has zero functional difference in practice — it only changes behavior for an UPDATE that will never occur.
- **Files modified:** `packages/backend/prisma/migrations/20260717173220_add-shift-clock-in-out/migration.sql` (statement order + one referential action changed; `packages/backend/prisma/schema.prisma` is unaffected — Prisma's schema-level `@relation` does not express `ON UPDATE` actions, so no schema.prisma change was needed)
- **Verification:** Re-ran the corrected migration file against a rolled-back clean DB state (dropped the partially-created `shifts` table between attempts) — `npx prisma db execute --file ...` completed with "Script executed successfully", `npx prisma migrate status` shows all 4 migrations applied, `npx prisma validate` passes, and a runtime smoke test via `npx tsx` confirmed `prisma.shift.count()` and `sale.findFirst({ select: { shiftId: true } })` both work against the live generated client.
- **Committed in:** `a39f179` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — MySQL constraint incompatibility discovered only at apply-time, not visible from schema.prisma or migrate validate alone)
**Impact on plan:** SQL-structure-only deviation. Final schema shape, column set, index set, and race-guard semantics are identical to what the plan specified — only the internal FK referential action for `shifts_userId_fkey` (CASCADE → RESTRICT on UPDATE) and statement ordering changed, both invisible to any consumer of the Prisma client or the `shifts`/`sales` tables. No impact on Plan 02+ (route handlers interact via `prisma.shift.*`, not raw FK behavior).

## Issues Encountered

No `mysql` CLI was available in this environment to run ad-hoc `SHOW CREATE TABLE` / `SHOW ENGINE INNODB STATUS` diagnostics. Used a short Node.js script with the `mysql2` package (already present in the resolved `node_modules` via the monorepo's hoisted dependency tree — this worktree's own `packages/backend/node_modules` was empty; Node's module resolution walked up to the main repository's `node_modules`, which is how `npx prisma` itself was also being resolved) to inspect table structure and reproduce the FK error in isolation, which made root-causing the MySQL constraint restriction possible.

Also: this worktree had no `.env` files (gitignored, not checked out to the worktree by git). Copied `packages/backend/.env` and root `.env` from the main working directory so `prisma db execute` / `migrate resolve` / `generate` could reach the live `alejinput_db` database — both files remain gitignored and were not committed (verified via `git check-ignore -v`).

## User Setup Required

None — migration runs locally against the existing dev database. No external service configuration required.

## Next Phase Readiness

- Plan 02 (clock-in/clock-out routes) can start immediately — `Shift` model types are in the generated Prisma client, and the route handler must catch Prisma `P2002` on the `shifts_organizationId_openLock_key` unique constraint and return the winning open shift (D-01 no-op) instead of a 500, per the T-07-01 threat mitigation this plan implemented at the DB layer.
- Plan 03 (sales router shiftId association) can reference `Sale.shiftId`/`Sale.shift` immediately.
- No blockers.

---
*Phase: 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: packages/backend/prisma/migrations/20260717173220_add-shift-clock-in-out/migration.sql
- FOUND: packages/backend/prisma/schema.prisma
- FOUND: commit f5ba88a (Task 1)
- FOUND: commit a39f179 (Task 2)
