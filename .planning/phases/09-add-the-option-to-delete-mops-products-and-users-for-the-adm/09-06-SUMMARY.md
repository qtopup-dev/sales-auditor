---
phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
plan: 06
subsystem: api
tags: [prisma, soft-delete, sales, gap-closure, security]

# Dependency graph
requires:
  - phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
    provides: "deletedAt DateTime? soft-delete column on Product/Mop/User models, exposed by the regenerated Prisma client (Plan 09-01)"
provides:
  - "All four product/MOP existence-check queries in packages/backend/src/routes/sales.ts (POST / create path x2, PATCH /:id productId/mopId edit branches x2) now require deletedAt: null in addition to isActive: true, closing a write-path gap that Plan 09-01's $extends filter could not reach (transactions bypass $extends)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explicit deletedAt: null filter at tx.*.findFirst call sites inside prisma.$transaction blocks — required because Prisma $extends middleware does not apply inside transactions; this is the write-path counterpart to the $extends findMany fix from Plan 09-01"

key-files:
  created: []
  modified:
    - packages/backend/src/routes/sales.ts

key-decisions:
  - "Applied the exact four-line diff specified in the plan with no deviation — tx.receiver.findFirst (x2) and tx.shift.findFirst (x1) left byte-for-byte unchanged since Receiver and Shift have no deletedAt field in Phase 9 (D-03)"

patterns-established:
  - "Any future tx.*.findFirst existence check against a model with a deletedAt column must include deletedAt: null explicitly, since $extends does not apply inside prisma.$transaction"

requirements-completed: [PHASE9-SC2, PHASE9-SC3]

# Metrics
duration: ~10min
completed: 2026-07-21
---

# Phase 09 Plan 06: Close sales.ts soft-delete existence-check gap Summary

**Added `deletedAt: null` alongside `isActive: true` to all four `tx.product.findFirst`/`tx.mop.findFirst` existence checks in `sales.ts` (POST create x2, PATCH edit x2), closing a write-path gap flagged by gsd-plan-checker where a soft-deleted-but-still-`isActive` product/MOP could still be referenced by ID to create or edit a sale**

## Performance

- **Duration:** ~10 min (worktree base correction + edit + Prisma client generation + type-check)
- **Started:** 2026-07-21T08:08:00Z (approx.)
- **Completed:** 2026-07-21T08:19:40Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- All four product/MOP existence-check `where` clauses in `packages/backend/src/routes/sales.ts` now filter on both `isActive: true` and `deletedAt: null`:
  - `POST /api/sales` — `tx.product.findFirst` (create path)
  - `POST /api/sales` — `tx.mop.findFirst` (create path)
  - `PATCH /api/sales/:id` — `tx.product.findFirst` (`productId` edit branch)
  - `PATCH /api/sales/:id` — `tx.mop.findFirst` (`mopId` edit branch)
- A soft-deleted product or MOP (`deletedAt` set, regardless of `isActive`) can no longer be referenced by ID to create or edit a sale, even by an authenticated user who knows/guesses its numeric ID — extends the write-path enforcement of CLAUDE.md Rule 8 to these four `tx.*` calls, which Plan 09-01's `$extends` filter cannot reach because transactions bypass `$extends`.
- The existing generic `404 { error: 'NOT_FOUND' }` response shape and `Object.assign(new Error(...), { statusCode: 404, code: 'NOT_FOUND' })` pattern are unchanged in all four blocks — no new error code, no information-disclosure regression.
- Both `tx.receiver.findFirst` call sites (create path + `receiverId` edit branch) and the `tx.shift.findFirst` call, and every other route/block in the file, are confirmed byte-for-byte unchanged (grep counts + full-file diff review).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add deletedAt: null to all four product/mop existence checks in sales.ts** - `235f3bc` (fix)

**Plan metadata:** (docs commit follows, applied by orchestrator after wave merge — this plan ran in worktree mode)

## Files Created/Modified

- `packages/backend/src/routes/sales.ts` — Added `deletedAt: null` to the `where` clause of 4 `tx.product.findFirst`/`tx.mop.findFirst` existence checks (POST create path x2, PATCH edit path x2). No other lines changed.

## Decisions Made

- Followed the plan's exact before/after diff for all four blocks — no deviation from the specified change.
- No TDD RED/GREEN cycle was run: this backend package has no test framework/infrastructure configured anywhere in the codebase (confirmed via search — no `*.test.ts`, no `vitest.config`/`jest.config`). The plan's own `<verify>` section relies on `tsc --noEmit` + `grep` counts rather than a test suite, consistent with this. Verification was done via those two mechanisms plus a full `git diff` review confirming only the four intended lines changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fresh worktree missing gitignored `.env` files and generated Prisma client**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** `npx tsc --noEmit` failed with `Cannot find module '../generated/prisma/client.js'` because this fresh worktree had no `packages/backend/.env`/root `.env` (gitignored, not checked out into a new worktree) and no `src/generated/prisma` client (also gitignored, produced by `prisma generate`) — same class of issue documented in Plan 09-01's Summary.
- **Fix:** Copied `packages/backend/.env` and root `.env` verbatim from the main working directory into the equivalent worktree paths (confirmed still gitignored via `git check-ignore -v`, not staged/committed), then ran `npx prisma generate` to produce `src/generated/prisma`.
- **Files modified:** None tracked by git (both `.env` files gitignored; generated Prisma client output is gitignored).
- **Verification:** `npx tsc --noEmit` then exited 0 with zero errors.
- **Committed in:** N/A (no trackable file change — environment setup only)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking environment setup, no code change). The delivered `sales.ts` diff is exactly the four lines specified in the plan.
**Impact on plan:** None on the delivered code change. The environment fix was required to run `tsc --noEmit` at all in this fresh worktree, consistent with the Phase 9 Plan 01 precedent.

## Issues Encountered

The worktree's `HEAD` initially diverged from the expected base commit (`66a0bbecd4d876ac00df0443912173dc385f2f86`); corrected via `git reset --hard` to the correct base before starting Task 1, per the `<worktree_branch_check>` step. No other issues.

## User Setup Required

None — same as Plan 09-01, `deletedAt` is already live in the database and exposed on the Prisma client; this plan only consumes it in `sales.ts` query `where` clauses.

## Next Phase Readiness

- This closes the last open gap identified by gsd-plan-checker for Phase 9's soft-delete enforcement (schema, list queries, and now the sales write-path existence checks are all consistent).
- No blockers for merging this worktree's commit alongside plans 09-02 and 09-03 (disjoint files: `products.ts`/`mops.ts` and `users.ts`/`auth.ts` respectively — no overlap with `sales.ts`).

---
*Phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: packages/backend/src/routes/sales.ts
- FOUND: commit 235f3bc (Task 1)
