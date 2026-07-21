---
phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
plan: 03
subsystem: auth
tags: [express, prisma, mysql, session-management, soft-delete, rbac]

# Dependency graph
requires:
  - phase: 09-01
    provides: "deletedAt column + index on User/Product/Mop models, Prisma client regenerated"
provides:
  - "DELETE /api/users/:id admin-only route with self-delete, last-admin, and session-kill safeguards"
  - "POST /api/auth/login now rejects deletedAt-set users"
affects: [09-04, 09-05, frontend user-management UI plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Race-safe last-resource guard: SELECT ... FOR UPDATE locks the full candidate row set (target included), with exclusion filtering done in application code so concurrent transactions contend on identical locked rows"
    - "Unconditional session-kill via sessionPool JSON_EXTRACT DELETE (no session_id exclusion) reused verbatim from the existing reset-password route for delete flows"

key-files:
  created: []
  modified:
    - packages/backend/src/routes/users.ts
    - packages/backend/src/routes/auth.ts

key-decisions:
  - "Route naming: DELETE /api/users/:id, consistent with Plan 02's product/MOP delete routes"
  - "Error codes: 400 CANNOT_DELETE_SELF and 400 LAST_ADMIN (Claude's Discretion per CONTEXT.md)"
  - "Last-admin FOR UPDATE query deliberately does NOT exclude the target row in SQL — exclusion happens via admins.filter() in application code so two concurrent deletes of different admins lock the same row set and correctly contend"

patterns-established:
  - "Last-resource-of-a-kind delete safeguard: lock full candidate set with FOR UPDATE inside a transaction, filter target out in JS, reject if zero remain"

requirements-completed: [PHASE9-SC1, PHASE9-SC4, PHASE9-SC5, PHASE9-SC6]

# Metrics
duration: ~15min
completed: 2026-07-21
---

# Phase 09 Plan 03: User Delete (Backend) Summary

**DELETE /api/users/:id with race-safe last-admin lock, self-delete block, and unconditional session destruction; login now rejects deletedAt-set accounts**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-21
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `DELETE /api/users/:id` to the admin-only `usersRouter`: blocks self-delete via `req.session.userId` (never request body), blocks deleting an organization's last remaining admin via a `FOR UPDATE` row lock inside `prisma.$transaction`, sets `deletedAt` on success, and unconditionally destroys every session row for the deleted user
- Race-safety for the last-admin check: the `FOR UPDATE` lock covers ALL of the org's admin rows including the target (not excluded via SQL), with "other admin" counted in application code via `admins.filter()` — this makes two concurrent deletes of two different admins contend on the identical locked row set instead of locking disjoint rows
- Modified `POST /api/auth/login`'s `where` clause in `auth.ts` to add `deletedAt: null` alongside the existing `isActive: true` check, since `findFirst` is not covered by the Prisma `$extends` soft-delete filter — a deleted user's correct credentials now return the same generic 401 `INVALID_CREDENTIALS` as a wrong password

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DELETE /api/users/:id with self-delete, last-admin, and session-kill safeguards** - `7f4ad87` (feat)
2. **Task 2: Reject deleted users at login** - `815f4ea` (feat)

**Plan metadata:** committed alongside this summary (worktree agent — orchestrator merges).

_Note: tasks were marked `tdd="true"` in the plan, but the project has no test infrastructure/test files anywhere (verified via file search — zero `.test.*` files exist). No RED/GREEN commit split was possible; both commits are direct `feat` implementations matching the plan's literal `<action>` code block. See "TDD Gate Compliance" below._

## Files Created/Modified
- `packages/backend/src/routes/users.ts` - Added `DELETE /:id` route (self-delete block, race-safe last-admin `FOR UPDATE` guard, `deletedAt` soft-delete, unconditional session-kill)
- `packages/backend/src/routes/auth.ts` - Added `deletedAt: null` to the login `where` clause

## Decisions Made
None beyond what the plan specified — plan's "Claude's Discretion" items (route naming, error codes) were pre-decided in the plan's interfaces section and followed as written.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan's own verification] Reworded last-admin explanatory comment to avoid tripping the plan's negative-assertion acceptance check**
- **Found during:** Task 1 verification
- **Issue:** The plan's `<action>` block specifies an explanatory code comment containing the literal substring `` `AND id != ...` `` (used to describe the SQL exclusion that is deliberately NOT present). The plan's own acceptance criteria then asserts `! grep -q "AND id !=" packages/backend/src/routes/users.ts` must succeed — i.e., that substring must NOT appear anywhere in the file. The plan's action text and its own acceptance criterion directly contradict each other; as written, the file would fail its own verification.
- **Fix:** Reworded the comment's parenthetical from "`AND id != ...`" to "an id-inequality predicate" — same explanatory meaning, no functional/SQL change, and the actual `FOR UPDATE` query was already correctly written with no `AND id !=` exclusion.
- **Files modified:** packages/backend/src/routes/users.ts
- **Verification:** `! grep -q "AND id !=" packages/backend/src/routes/users.ts` now succeeds; `npx tsc --noEmit` exits 0
- **Committed in:** 7f4ad87 (Task 1 commit)

**2. [Rule 3 - Blocking] Generated Prisma client and copied `.env` into the fresh worktree**
- **Found during:** Pre-commit verification (`npx tsc --noEmit`)
- **Issue:** This worktree was freshly created and never had `prisma generate` run, nor did it have the gitignored `packages/backend/.env` file. `tsc --noEmit` failed with `Cannot find module '../generated/prisma/client.js'`, cascading into ~30 unrelated implicit-any errors across the whole backend (pre-existing files, not caused by this plan's changes) — a false signal masking whether my own two-file change actually type-checked.
- **Fix:** Copied `packages/backend/.env` from the main repo checkout into the worktree, then ran `npx prisma generate` (Prisma 7.8.0) to produce `src/generated/prisma`. Both are gitignored and were not committed.
- **Files modified:** none tracked (generated client + `.env` are gitignored, worktree-local only)
- **Verification:** `npx tsc --noEmit` exits 0 with zero errors after regeneration
- **Committed in:** N/A (no tracked files changed by this fix)

---

**Total deviations:** 2 auto-fixed (1 plan-verification bug, 1 blocking environment setup)
**Impact on plan:** Both fixes were necessary to actually verify the two-file code change compiles and matches its own acceptance criteria. No scope creep — no functional code beyond the plan's specified two routes/handlers was touched.

## TDD Gate Compliance

Both tasks were marked `tdd="true"` in the plan frontmatter, but this project has no test framework or test files installed anywhere in the repo (confirmed via file search for `*.test.*` and `__tests__` — zero results). The plan's `<action>` blocks provided direct implementation code with no accompanying test-writing instructions, matching the pattern of prior phases in this codebase. No `test(...)` RED commit exists for either task; both commits are `feat(...)` commits containing the full implementation as specified in the plan. This mirrors prior-phase precedent (Phase 7/8 plans) where `tdd="true"` plans without project test infrastructure produced direct `feat` commits.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `DELETE /api/users/:id` is live and admin-gated; ready for the frontend user-management UI plan to wire a delete button/confirmation flow against it
- Login now correctly rejects deleted accounts; no further backend work needed for User delete's auth-side safeguard
- No blockers for downstream plans in this phase (09-04, 09-05, 09-06 per phase plan map)

---
*Phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: packages/backend/src/routes/users.ts
- FOUND: packages/backend/src/routes/auth.ts
- FOUND: .planning/phases/09-add-the-option-to-delete-mops-products-and-users-for-the-adm/09-03-SUMMARY.md
- FOUND: commit 7f4ad87
- FOUND: commit 815f4ea
