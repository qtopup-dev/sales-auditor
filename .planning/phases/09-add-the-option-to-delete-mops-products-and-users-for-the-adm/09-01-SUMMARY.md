---
phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
plan: 01
subsystem: database
tags: [prisma, mysql, migration, schema, soft-delete, products, mops, users]

# Dependency graph
requires:
  - phase: 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal
    provides: Manual migration workflow precedent (db execute + migrate resolve) for environments with an unmanaged sessions table
provides:
  - deletedAt DateTime? nullable column on Product, Mop, User (second soft-delete signal distinct from isActive, D-01)
  - composite (organizationId, deletedAt) index on products, mops, users tables
  - shared $extends softDeleteFilter now injects deletedAt: null alongside isActive: true as the unconditional default on prisma.product.findMany / prisma.mop.findMany / prisma.user.findMany (D-02, no override path introduced)
affects:
  - 09-02 (Product delete route)
  - 09-03 (MOP delete route)
  - 09-04 (User delete route + self-delete/last-admin/session-kill safeguards)
  - 09-05 (frontend Delete buttons + confirm dialogs)
  - 09-06 (final wiring/verification)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "prisma db execute + migrate resolve for drift-safe manual migrations (Phase 5/7 precedent, reused here for a third time)"
    - "Second soft-delete signal (deletedAt) layered on top of existing isActive boolean — Delete is a stricter, distinct action from Deactivate; both remain non-destructive under the hood"

key-files:
  created:
    - packages/backend/prisma/migrations/20260721081035_add-deleted-at-soft-delete/migration.sql
  modified:
    - packages/backend/prisma/schema.prisma
    - packages/backend/src/lib/prisma.ts

key-decisions:
  - "deletedAt added as a nullable DATETIME(3) column via hand-written migration.sql, applied with prisma db execute --file then registered with prisma migrate resolve --applied — not prisma migrate dev, per the established sessions-table-drift workaround"
  - "$extends softDeleteFilter default where injection changed from { isActive: true, ...args.where } to { isActive: true, deletedAt: null, ...args.where } for user/product/mop blocks only; sale and receiver blocks left untouched (out of scope, D-03)"
  - "No deletedAt: undefined override was added anywhere — the existing isActive: undefined overrides in products.ts/mops.ts/users.ts/receivers.ts (used by GET-all admin routes to show active+inactive) were left exactly as-is and are unaffected by this change"

patterns-established:
  - "deletedAt DateTime? soft-delete field + @@index([organizationId, deletedAt]) is the template for any future entity needing a stricter delete signal distinct from an existing isActive toggle"

requirements-completed: [PHASE9-SC2, PHASE9-SC3, PHASE9-SC7]

# Metrics
duration: ~10min
completed: 2026-07-21
---

# Phase 09 Plan 01: Delete Schema + Migration Summary

**Nullable `deletedAt DateTime?` soft-delete signal added to Product, Mop, User via hand-written migration (db execute + migrate resolve), with the shared Prisma `$extends` filter now unconditionally excluding `deletedAt IS NOT NULL` rows from `findMany` on all three models**

## Performance

- **Duration:** ~10 min (schema edit + Docker Desktop cold-start + migration apply + client regen + type-check)
- **Started:** 2026-07-21T08:03:00Z (approx.)
- **Completed:** 2026-07-21T08:13:57Z
- **Tasks:** 3
- **Files modified:** 3 (schema.prisma, migration.sql, prisma.ts)

## Accomplishments

- `deletedAt DateTime?` field added to `Product`, `Mop`, `User` Prisma models, each with a matching `@@index([organizationId, deletedAt])` composite index — `isActive` semantics on all three models left completely unchanged
- Migration `20260721081035_add-deleted-at-soft-delete` created by hand and applied against the live MySQL database via `prisma db execute --file` + `prisma migrate resolve --applied` (manual workflow — `prisma migrate dev` is blocked by the unmanaged `sessions` table, per Phase 5/7 precedent)
- Prisma client regenerated; live smoke check via a short `mysql2` script confirmed `deletedAt datetime(3) NULL` exists on `products`, `mops`, and `users` tables
- Shared `softDeleteFilter` `$extends` block in `prisma.ts` extended so `prisma.user.findMany`, `prisma.product.findMany`, `prisma.mop.findMany` all inject `deletedAt: null` alongside `isActive: true` by default — no override path was introduced anywhere in this plan (D-02)
- `sale` and `receiver` blocks in `prisma.ts` left untouched (out of scope, D-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update schema.prisma — add deletedAt to Product, Mop, User models** - `905359e` (feat)
2. **Task 2: Create migration manually, apply via db execute + migrate resolve, regenerate client** - `9435a0b` (feat)
3. **Task 3: Extend prisma.ts softDeleteFilter — inject deletedAt: null default on product/mop/user findMany** - `5841d83` (feat)

**Plan metadata:** (docs commit follows, applied by orchestrator after wave merge — this plan ran in worktree mode)

## Files Created/Modified

- `packages/backend/prisma/schema.prisma` — Added `deletedAt DateTime?` + `@@index([organizationId, deletedAt])` to `Product`, `Mop`, `User` models only
- `packages/backend/prisma/migrations/20260721081035_add-deleted-at-soft-delete/migration.sql` — `ALTER TABLE ... ADD COLUMN deletedAt DATETIME(3) NULL` + `ADD INDEX` for `products`, `mops`, `users`
- `packages/backend/src/lib/prisma.ts` — `user`/`product`/`mop` `findMany` default `where` now injects `deletedAt: null` alongside `isActive: true`

## Decisions Made

- Reused the exact manual migration workflow from Phase 5 and Phase 7 (`prisma db execute --file` then `prisma migrate resolve --applied`) without needing the SQL-splitting fallback described in the plan — the single combined `migration.sql` applied cleanly on the first attempt against the live database.
- No `deletedAt: undefined` override was added to any route in this plan (Task 3 only touches `prisma.ts`) — Plans 02-05 will add the actual delete endpoints and are responsible for not introducing such an override, per D-02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Started Docker Desktop and the `alejinput-mysql-1` container before the migration could be applied**
- **Found during:** Task 2, Step 3 (`prisma db execute --file`)
- **Issue:** `npx prisma db execute` failed with `P1001 Can't reach database server at localhost:3306` — Docker Desktop was not running in this worktree's host environment, so the `alejinput-mysql-1` container (created previously, per `docker ps -a`) was in an `Exited` state.
- **Fix:** Launched `Docker Desktop.exe`, waited for the daemon to accept connections (`docker version` succeeded after ~10s), then `docker start alejinput-mysql-1` and waited for its healthcheck to report `healthy` (~10s). No `docker-compose up` was needed since the container already existed from prior phases; a fresh container was not created and no data was reset.
- **Files modified:** None (infrastructure-only fix, no code/config change)
- **Verification:** `npx prisma db execute --file ...` then succeeded ("Script executed successfully"); `npx prisma migrate resolve --applied` and `npx prisma migrate status` both confirmed the migration is applied and the schema is up to date.
- **Committed in:** N/A (no file change — infra state only)

**2. [Rule 3 - Blocking] Copied gitignored `.env` files into the worktree**
- **Found during:** Start of Task 2, before running any `prisma` CLI command
- **Issue:** This worktree had no `packages/backend/.env` or root `.env` (both gitignored, not checked out by git into a fresh worktree) — same issue documented in the Phase 7 Plan 01 Summary. Without them, `DATABASE_URL` and DB connection env vars would be unset and every `prisma` CLI command would fail immediately.
- **Fix:** Copied `packages/backend/.env` and root `.env` verbatim from the main working directory (`D:\project\custom projects\alejinput`) into the equivalent worktree paths. Confirmed both remain gitignored via `git check-ignore -v` — neither was staged or committed.
- **Files modified:** None tracked by git (both files are gitignored)
- **Verification:** Subsequent `prisma` CLI commands resolved `DATABASE_URL` correctly (confirmed via successful `db execute`/`migrate resolve`/`generate`/`migrate status` runs)
- **Committed in:** N/A (gitignored files, not committed)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking infrastructure/environment issues, no code changes). Final schema, migration SQL, and `prisma.ts` filter logic are exactly as specified in the plan.
**Impact on plan:** None on the delivered schema/migration/filter contract. Both fixes were environment setup required to execute the plan at all in this fresh worktree, consistent with the Phase 5/7 precedent already documented in STATE.md and the Phase 7 Plan 01 Summary.

## Issues Encountered

Same class of issue as Phase 7 Plan 01: no `mysql` CLI available in this environment for `SHOW COLUMNS` diagnostics. Used a short ad-hoc `mysql2`-based `tsx` script (deleted after use, never committed) placed inside `packages/backend/` so Node's module resolution could find the hoisted `mysql2` package — confirmed `deletedAt datetime(3) NULL` on all three tables directly against the live database as an extra verification step beyond the plan's required checks.

## User Setup Required

None — migration runs against the existing local dev database (Docker container `alejinput-mysql-1`, already provisioned from prior phases). No external service configuration required. Note for the user: Docker Desktop was not running at the start of this session and had to be started programmatically; if running this plan again in a fresh environment, ensure Docker Desktop and the `alejinput-mysql-1` container are running before invoking any `prisma` CLI command.

## Next Phase Readiness

- Plans 02-05 (Product/MOP/User delete routes and frontend Delete UI) can start immediately — `deletedAt` is live in the database and exposed on the regenerated Prisma client (`Product`, `Mop`, `User` types), and the shared `$extends` filter unconditionally excludes deleted rows from every `findMany` on these three models with zero override path.
- `Sale`, `AuditLog`, `Shift` schema and data are completely untouched — confirmed structurally (no `deletedAt` occurrence in those model blocks, no `ALTER TABLE` statement targeting `sales`/`audit_log`/`shifts`).
- No blockers.

---
*Phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: packages/backend/prisma/schema.prisma
- FOUND: packages/backend/prisma/migrations/20260721081035_add-deleted-at-soft-delete/migration.sql
- FOUND: packages/backend/src/lib/prisma.ts
- FOUND: commit 905359e (Task 1)
- FOUND: commit 9435a0b (Task 2)
- FOUND: commit 5841d83 (Task 3)
