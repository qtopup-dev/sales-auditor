---
phase: 12-moderator-void-requests
plan: 01
subsystem: database
tags: [prisma, mysql, migration, schema, shared-types, void-request]

# Dependency graph
requires:
  - phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
    provides: Manual migration workflow precedent (db execute + migrate resolve) for environments with an unmanaged sessions table
  - phase: 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal
    provides: Precedent for a DB-level STORED generated-column race guard (shifts.openLock) reused here as void_requests.pendingLock
provides:
  - VoidRequestStatus Prisma enum + VoidRequest model with distinct named relations (VoidRequestedBy/VoidReviewedBy) on User
  - void_requests table in the live MySQL database, with pendingLock STORED generated column and (organizationId, pendingLock) unique index enforcing at-most-one-pending-per-sale at the DB layer (CONTEXT.md D-02/D-03)
  - Regenerated Prisma client exposing prisma.voidRequest
  - VoidRequestStatus / VoidRequest / VoidRequestWithSale exported from @alejinput/shared
affects:
  - 12-02 (backend voidRequestsRouter — create/list/approve/reject endpoints)
  - 12-03 (moderator Sales sheet — Void Request button + dialog)
  - 12-04 (admin Void Requests page + sidebar badge)

# Actuals (#2632)
actuals:
  tokens: 2542
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "prisma db execute + migrate resolve for drift-safe manual migrations (Phase 5/7/9 precedent, reused here for a fourth time)"
    - "DB-level STORED generated column + unique index as a race-safety guard, second use after Phase 7's shifts.openLock"

key-files:
  created:
    - packages/backend/prisma/migrations/20260809102320_add-void-requests/migration.sql
    - packages/shared/src/types/voidRequest.ts
  modified:
    - packages/backend/prisma/schema.prisma
    - packages/shared/src/types/index.ts

key-decisions:
  - "pendingLock STORED generated column + (organizationId, pendingLock) unique index added by hand-written migration (not declared in schema.prisma) makes D-02 race-safe at the DB layer — mirrors the Phase 7 shifts.openLock precedent exactly"
  - "void_requests_saleId_fkey uses ON UPDATE RESTRICT (not this project's usual ON UPDATE CASCADE) because saleId is read inside the indexed pendingLock generated-column expression — MySQL 8.4 forbids CASCADE on such a base column; functionally equivalent since sales.id is an immutable auto-increment PK"
  - "Manual migration workflow (db execute + migrate resolve) reused for a fourth time — prisma migrate dev remains blocked by the unmanaged sessions table drift"
  - "VoidRequestWithSale embeds the full Sale snapshot row (not a re-join) so the admin table never needs a second round trip for product/mop/receiver display (CLAUDE.md Rule 4)"

patterns-established:
  - "pendingLock-style STORED generated column + unique index is now a two-time precedent (shifts.openLock, void_requests.pendingLock) for any future 'at most one X per Y' invariant needing DB-level race safety"

requirements-completed: [PHASE12-SC1, PHASE12-SC2, PHASE12-SC4]

coverage:
  - id: D1
    description: "VoidRequestStatus enum and VoidRequest model added to schema.prisma with distinct named relations to User, passing prisma validate"
    requirement: "PHASE12-SC1"
    verification:
      - kind: other
        ref: "npx prisma validate (packages/backend) — exits 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "void_requests table created in the live MySQL database with pendingLock generated column, its unique index, and four FK constraints; migration registered as applied; no existing table altered"
    requirement: "PHASE12-SC2"
    verification:
      - kind: other
        ref: "npx prisma migrate status (packages/backend) — reports database schema up to date, no drift"
        status: pass
      - kind: other
        ref: "npx prisma db execute --stdin <<< SELECT COUNT(*) FROM void_requests; and SHOW INDEX FROM void_requests WHERE Key_name='void_requests_organizationId_pendingLock_key' — both succeed"
        status: pass
    human_judgment: false
  - id: D3
    description: "@alejinput/shared exports VoidRequestStatus, VoidRequest, VoidRequestWithSale via the barrel; shared and backend workspaces build clean"
    requirement: "PHASE12-SC4"
    verification:
      - kind: other
        ref: "npm run build --workspace=@alejinput/shared — exits 0"
        status: pass
      - kind: other
        ref: "npm run build --workspace=@alejinput/backend — exits 0"
        status: pass
    human_judgment: false

# Metrics
duration: ~15min
completed: 2026-08-09
status: complete
---

# Phase 12 Plan 01: VoidRequest Schema, Migration & Shared Types Summary

**Dedicated `VoidRequest` Prisma model + live-database `void_requests` table with a `pendingLock` STORED generated-column race guard, plus `VoidRequestStatus`/`VoidRequest`/`VoidRequestWithSale` exported from `@alejinput/shared`**

## Performance

- **Duration:** ~15 min (schema edit + Docker Desktop cold-start + migration apply + client regen + shared types + build verification)
- **Started:** 2026-08-09T18:10:00+08:00 (approx.)
- **Completed:** 2026-08-09T18:25:28+08:00
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `VoidRequestStatus` enum (`pending`/`approved`/`rejected`) and `VoidRequest` model added to `schema.prisma` with `organizationId`, `saleId`, `reason` (TEXT), status, requester/reviewer snapshot fields and three composite indexes; `Organization`, `User` (via distinct `"VoidRequestedBy"`/`"VoidReviewedBy"` named relations), and `Sale` all carry the matching back-relations
- `void_requests` table created and applied against the live MySQL database via the established manual migration workflow (`prisma db execute` + `prisma migrate resolve --applied`), including the `pendingLock` STORED generated column and its `(organizationId, pendingLock)` unique index — a DB-level race guard mirroring the Phase 7 `shifts.openLock` precedent — plus four FK constraints (`saleId` uses `ON UPDATE RESTRICT` per the MySQL 8.4 generated-column limitation)
- Prisma client regenerated; `prisma.voidRequest` delegate confirmed present in `packages/backend/src/generated/prisma/`
- `@alejinput/shared` now exports `VoidRequestStatus`, `VoidRequest`, and `VoidRequestWithSale` from a new `voidRequest.ts` file, re-exported through the existing barrel; both `@alejinput/shared` and `@alejinput/backend` build clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add VoidRequestStatus enum, VoidRequest model, and back-relations to schema.prisma** - `6bc2452` (feat)
2. **Task 2: [BLOCKING] Create and apply the void_requests migration manually, then regenerate the Prisma client** - `72ff062` (feat)
3. **Task 3: Add VoidRequest shared types and export them from the barrel** - `7c7c520` (feat)

**Plan metadata:** (docs commit follows, applied by orchestrator after wave merge — this plan ran in worktree mode)

## Files Created/Modified

- `packages/backend/prisma/schema.prisma` — Added `VoidRequestStatus` enum, `VoidRequest` model, and back-relations on `Organization`, `User`, `Sale`
- `packages/backend/prisma/migrations/20260809102320_add-void-requests/migration.sql` — `CREATE TABLE void_requests`, `pendingLock` generated column, its unique index, and four FK constraints
- `packages/shared/src/types/voidRequest.ts` — `VoidRequestStatus`, `VoidRequest`, `VoidRequestWithSale` types
- `packages/shared/src/types/index.ts` — Barrel re-export of the new void-request types

## Decisions Made

- Reused the exact manual migration workflow from Phase 5/7/9 (`prisma db execute --file` then `prisma migrate resolve --applied`) — the single combined `migration.sql` applied cleanly on the first attempt against the live database, no SQL-splitting fallback needed.
- No manual spot-check of the D-02/D-03 duplicate-pending / re-eligibility behavior was performed against real data (the plan's `<verification>` section marks this "informational" rather than required); the unique index and generated-column expression were verified structurally instead (index exists via `SHOW INDEX`, generated-column DDL confirmed in the applied migration.sql).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Started Docker Desktop and the `alejinput-mysql-1` container before the migration could be applied**
- **Found during:** Task 2, before Step 3 (`prisma db execute --file`)
- **Issue:** `docker ps` failed — Docker Desktop was not running in this worktree's host environment; `alejinput-mysql-1` was `Exited` per `docker ps -a`.
- **Fix:** Launched `Docker Desktop.exe`, waited for the daemon to accept connections, then `docker start alejinput-mysql-1` and waited ~15s for its healthcheck to report `healthy`. No `docker-compose up` needed; the existing container and its data were reused unchanged.
- **Files modified:** None (infrastructure-only fix)
- **Verification:** Subsequent `npx prisma db execute --file ...` succeeded ("Script executed successfully"); `npx prisma migrate status` confirmed the schema up to date.
- **Committed in:** N/A (no file change — infra state only)

**2. [Rule 3 - Blocking] Copied gitignored `.env` files into the worktree**
- **Found during:** Start of Task 1 (`npx prisma validate` failed with `Cannot resolve environment variable: DATABASE_URL`)
- **Issue:** This fresh worktree had no `packages/backend/.env` or root `.env` (both gitignored, not checked out into a fresh worktree) — same issue documented in the Phase 7 and Phase 9 Plan 01 summaries.
- **Fix:** Copied `packages/backend/.env` and root `.env` verbatim from the main working directory (`D:\project\custom projects\alejinput`) into the equivalent worktree paths. Confirmed both remain gitignored via `git check-ignore -v` — neither was staged or committed.
- **Files modified:** None tracked by git (both files are gitignored)
- **Verification:** Subsequent `prisma` CLI commands resolved `DATABASE_URL` correctly (validate/db execute/migrate resolve/generate/migrate status all succeeded).
- **Committed in:** N/A (gitignored files, not committed)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking infrastructure/environment issues, no code changes). Final schema, migration SQL, and shared types are exactly as specified in the plan.
**Impact on plan:** None on the delivered schema/migration/types contract. Both fixes were environment setup required to execute the plan at all in this fresh worktree, consistent with the Phase 5/7/9 precedent already documented in STATE.md and prior plan summaries.

## Issues Encountered

None beyond the two documented deviations above.

## User Setup Required

None — migration runs against the existing local dev database (Docker container `alejinput-mysql-1`, already provisioned from prior phases). Note for the user: Docker Desktop was not running at the start of this session and had to be started programmatically; if running this plan again in a fresh environment, ensure Docker Desktop and the `alejinput-mysql-1` container are running before invoking any `prisma` CLI command.

## Next Phase Readiness

- Plan 12-02 (backend `voidRequestsRouter`) can start immediately — `prisma.voidRequest` is live and typed, the `pendingLock` unique index is in place for the P2002-to-409 duplicate-pending mapping, and `VoidRequestStatus`/`VoidRequest`/`VoidRequestWithSale` are importable from `@alejinput/shared`.
- Plans 12-03 and 12-04 (frontend) can import the shared types once 12-02's endpoints exist.
- `Sale`, `AuditLog`, `Shift`, `Product`, `Mop`, `Receiver`, `User`, `Organization` schema and data are completely untouched by this migration — confirmed structurally (no `ALTER TABLE` targeting any of those tables in `migration.sql`).
- No blockers.

---
*Phase: 12-moderator-void-requests*
*Completed: 2026-08-09*

## Self-Check: PASSED

- FOUND: packages/backend/prisma/schema.prisma
- FOUND: packages/backend/prisma/migrations/20260809102320_add-void-requests/migration.sql
- FOUND: packages/shared/src/types/voidRequest.ts
- FOUND: packages/shared/src/types/index.ts (modified)
- FOUND: commit 6bc2452 (Task 1)
- FOUND: commit 72ff062 (Task 2)
- FOUND: commit 7c7c520 (Task 3)
