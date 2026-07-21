---
phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
plan: 07
subsystem: api
tags: [prisma, users, rbac, gap-closure, security]

# Dependency graph
requires:
  - phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
    provides: "DELETE /api/users/:id route with race-safe FOR UPDATE last-admin guard (Plan 09-03)"
provides:
  - "DELETE /api/users/:id last-admin guard now filters the FOR UPDATE locked admin set to isActive = true and gates the check on target.isActive, so only login-capable admins are counted"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Last-admin / last-privileged-user invariants must count only login-capable rows (isActive: true AND deletedAt: null) — matching the exact predicate used by the login route, not merely non-deleted rows"

key-files:
  created: []
  modified:
    - packages/backend/src/routes/users.ts

key-decisions:
  - "Gated the guard on target.role === 'admin' && target.isActive (not just target.role === 'admin') so deleting a deactivated admin — which can never reduce the usable-admin count — is never spuriously blocked, per the plan's explicit design rationale"

patterns-established:
  - "Any future 'last remaining X' guard must restrict its locked/counted row set to the exact predicate the corresponding authentication/authorization check uses (here: isActive: true AND deletedAt: null, matching auth.ts login), not a looser 'not deleted' predicate"

requirements-completed: [PHASE9-SC5]

# Metrics
duration: ~12min
completed: 2026-07-21
---

# Phase 09 Plan 07: Fix last-admin guard to count only login-capable admins Summary

**Closed PHASE9-SC5 / CR-01 by adding `AND isActive = true` to the `FOR UPDATE` locked admin set and gating the guard on `target.isActive`, so deleting the sole ACTIVE admin is rejected even when a deactivated admin row exists, while deleting a deactivated admin is never blocked**

## Performance

- **Duration:** ~12 min (worktree base correction + edit + env/Prisma client setup + type-check + verification)
- **Started:** 2026-07-21T09:05:00Z (approx.)
- **Completed:** 2026-07-21T09:17:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `DELETE /api/users/:id`'s last-admin guard in `packages/backend/src/routes/users.ts` now:
  - Selects `isActive` in the existence-check `tx.user.findFirst` (`select: { id: true, role: true, isActive: true }`) so the guard can gate on the target's own active status.
  - Runs the `FOR UPDATE` locked-set query and count check ONLY when `target.role === 'admin' && target.isActive` — deleting a deactivated admin now skips the guard entirely (can never reduce the usable-admin count).
  - Restricts the `FOR UPDATE` locked set with `AND isActive = true` (in addition to the pre-existing `role = 'admin' AND deletedAt IS NULL`), so a deactivated-but-not-deleted admin no longer counts as "another usable admin."
- The bug this closes: previously, an org with one ACTIVE admin and one deactivated (isActive: false, deletedAt: null) admin could have its sole active admin deleted (the deactivated row counted as "another admin"), leaving the org with zero login-capable admins — defeating the entire purpose of D-09's safeguard.
- Race-safety preserved: the target (when active) is still included in the locked SQL set (not excluded via `AND id !=`), so two concurrent deletes of two different active admins still lock the identical active-admin row set and contend, per the plan's threat-model entry T-09-10.
- All other logic in the file — self-delete check, session-kill queries (both instances), `deletedAt: new Date()` update, and every other route (`GET /`, `PATCH /:id/username`, `PATCH /:id`, `POST /:id/reset-password`) — confirmed byte-for-byte unchanged via full `git diff` review.

## Task Commits

Each task was committed atomically:

1. **Task 1: Filter the last-admin guard to login-capable admins only** - `073c399` (fix)

**Plan metadata:** (docs commit follows, applied by orchestrator after wave merge — this plan ran in worktree mode)

## Files Created/Modified

- `packages/backend/src/routes/users.ts` — Added `isActive: true` to the existence-check `select`; changed the guard condition from `target.role === 'admin'` to `target.role === 'admin' && target.isActive`; added `AND isActive = true` to the `FOR UPDATE` query; added an explanatory comment block above the guard documenting the fix rationale. No other lines changed.

## Decisions Made

- Followed the plan's exact before/after diff for both edits — no deviation from the specified change.
- No TDD RED/GREEN cycle was run: this backend package has no test framework/infrastructure configured anywhere in the codebase (confirmed via search in Plan 09-06 — no `*.test.ts`, no `vitest.config`/`jest.config`). Verification relies on `tsc --noEmit` + `grep` acceptance-criteria checks + full `git diff` review, consistent with prior Phase 9 gap-closure plans.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fresh worktree missing gitignored `.env` files and generated Prisma client**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** `npx tsc --noEmit` initially failed with `Cannot find module '../generated/prisma/client.js'`, cascading into ~30 unrelated pre-existing implicit-any errors across the backend, because this fresh worktree had no `packages/backend/.env`/root `.env` (gitignored, not checked out into a new worktree) and no `src/generated/prisma` client (also gitignored, produced by `prisma generate`) — same class of issue documented in Plans 09-01, 09-02, 09-03, and 09-06's Summaries.
- **Fix:** Copied `packages/backend/.env` and root `.env` verbatim from the main working directory into the equivalent worktree paths (confirmed still gitignored via `git check-ignore -v`, not staged/committed), then ran `npx prisma generate` (Prisma 7.8.0) to produce `src/generated/prisma`.
- **Files modified:** None tracked by git (both `.env` files gitignored; generated Prisma client output is gitignored).
- **Verification:** `npx tsc --noEmit` then exited 0 with zero errors.
- **Committed in:** N/A (no trackable file change — environment setup only)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking environment setup, no code change). The delivered `users.ts` diff is exactly the two edits specified in the plan.
**Impact on plan:** None on the delivered code change. The environment fix was required to run `tsc --noEmit` at all in this fresh worktree, consistent with prior Phase 9 plan precedent.

## Issues Encountered

The worktree's `HEAD` initially diverged from the expected base commit (`927fd405d926711613718d2c3ef017dd532e8488`); corrected via `git reset --hard` to the correct base before starting Task 1, per the `<worktree_branch_check>` step. No other issues.

## User Setup Required

None — the fix is a pure logic change to an existing raw SQL query and an existing existence-check `select`; no schema, migration, or environment change required in production/dev.

## Next Phase Readiness

- This closes PHASE9-SC5, the single blocking verification gap identified in `09-REVIEW.md` (CR-01). Phase 9's last-admin safeguard now enforces its stated invariant ("at least one admin who can actually log in must remain") exactly, rather than the looser "at least one admin row must remain."
- No blockers for merging this worktree's commit — the change is scoped to a single file (`packages/backend/src/routes/users.ts`) with no overlap with any other Phase 9 plan's modified files.

---
*Phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: packages/backend/src/routes/users.ts
- FOUND: commit 073c399 (Task 1)
