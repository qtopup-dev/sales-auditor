---
phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
plan: 02
subsystem: api
tags: [express, prisma, soft-delete, products, mops, rbac]

# Dependency graph
requires:
  - phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm (plan 01)
    provides: deletedAt column on Product/Mop/User models, $extends softDeleteFilter enforcing deletedAt:null + isActive:true on all default reads
provides:
  - "DELETE /api/products/:id route (admin-only, soft-delete via deletedAt)"
  - "DELETE /api/mops/:id route (admin-only, soft-delete via deletedAt)"
affects: [09-04 (frontend Products delete UI), 09-05 (frontend MOPs delete UI)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DELETE :id route pattern: findFirst with isActive:undefined + deletedAt:null existence check, then update deletedAt:new Date(), 204 no body"

key-files:
  created: []
  modified:
    - packages/backend/src/routes/products.ts
    - packages/backend/src/routes/mops.ts

key-decisions:
  - "Used standard REST DELETE /:id verb (CONTEXT.md Claude's Discretion) — no collision with existing PATCH /:id (edit) or PATCH /:id/toggle routes"

patterns-established:
  - "Soft-delete existence check bypasses isActive filter but always enforces deletedAt: null, so an already-deleted row is treated as 404 not-found — consistent with 'once deleted, gone from every admin-facing surface'"

requirements-completed: [PHASE9-SC1, PHASE9-SC2, PHASE9-SC3, PHASE9-SC7]

# Metrics
duration: 20min
completed: 2026-07-21
---

# Phase 09 Plan 02: Delete Products/MOPs Backend Routes Summary

**Added admin-only `DELETE /api/products/:id` and `DELETE /api/mops/:id` routes that soft-delete via `deletedAt`, leaving existing toggle routes and all Sale rows completely untouched.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-21T08:01:00Z (approx)
- **Completed:** 2026-07-21T08:21:54Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `productsRouter.delete('/:id', ...)` — sets `deletedAt = new Date()`, returns 204 on success, 404 for missing/already-deleted products, 400 for invalid id
- `mopsRouter.delete('/:id', ...)` — identical shape for MOPs, returns `MOP_NOT_FOUND` on 404
- Both routes inherit admin-only enforcement automatically from router-level `requireRole('admin')` middleware (no per-route addition needed)
- Both routes scope every query/update to `organizationId: 1`, preventing cross-tenant deletion once multi-tenancy lands
- Neither route touches `Sale`, `AuditLog`, or `Shift` — verified structurally (no references to those models in the new code)
- Existing `PATCH /:id/toggle` and all other pre-existing routes verified byte-for-byte unchanged (`git diff` against the pre-plan commit shows only additive `+` lines, zero `-` lines, in both files)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DELETE /api/products/:id route** - `54e7d8d` (feat)
2. **Task 2: Add DELETE /api/mops/:id route** - `438e67e` (feat)

_No TDD test files were added — this plan's `tdd="true"` task markers reference the plan's own `<behavior>`-driven acceptance criteria (grep + tsc checks) rather than a separate unit test suite, consistent with the existing toggle routes in these files which also have no dedicated test files._

## Files Created/Modified
- `packages/backend/src/routes/products.ts` - Added `DELETE /:id` soft-delete route (40 lines appended, nothing else changed)
- `packages/backend/src/routes/mops.ts` - Added `DELETE /:id` soft-delete route (37 lines appended, nothing else changed)

## Decisions Made
- Followed CONTEXT.md's "Claude's Discretion" naming guidance: `DELETE /api/products/:id` / `DELETE /api/mops/:id` (standard REST verb, no naming collision with existing `PATCH .../toggle` or `PATCH /:id`)
- No other decisions — plan's `<action>` code blocks were copied verbatim

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated stale Prisma client in worktree**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** `packages/backend/src/generated/prisma` (gitignored, not checked into git) was stale in this fresh worktree — it predated Plan 01's schema change and did not expose `deletedAt` on `Product`/`Mop`/`User` `WhereInput`/`UpdateInput` types, causing pre-existing `src/lib/prisma.ts` (Plan 01's `$extends` soft-delete filter) to fail `tsc --noEmit` with `TS2353: Object literal may only specify known properties, and 'deletedAt' does not exist`
- **Fix:** Copied `.env` (gitignored, contains `DATABASE_URL`) from the main repo working copy into the worktree's `packages/backend/`, then ran `npx prisma generate` in the worktree to regenerate the client from the already-correct `schema.prisma` (Plan 01's schema changes were already committed on the branch)
- **Files modified:** none tracked by git (`packages/backend/.env` and `packages/backend/src/generated/prisma/*` are both gitignored); no code changes were needed once the client was regenerated
- **Verification:** `npx tsc --noEmit` exits 0 with no output after regeneration
- **Committed in:** N/A (gitignored artifacts, not committed)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary local-environment fix only (stale generated client in a fresh worktree checkout); no change to plan scope or shipped route code.

## Issues Encountered
- Initial verification commands were accidentally run against the main repo's `packages/backend` directory instead of the worktree's copy, which briefly appeared to show the routes missing (stale July-11 file content on disk in the unrelated main-repo checkout). Re-ran all verification against the correct worktree-scoped absolute path (`.claude/worktrees/agent-af6c1e0ef69b5e104/packages/backend`) and confirmed both routes are present and `tsc --noEmit` passes there. No code was affected — this was purely a verification-path mistake, corrected before committing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend delete routes for Products and MOPs are live and admin-gated; ready for Plan 04/05 frontend delete UI to call `DELETE /api/products/:id` and `DELETE /api/mops/:id`
- No blockers identified for dependent plans

---
*Phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: packages/backend/src/routes/products.ts
- FOUND: packages/backend/src/routes/mops.ts
- FOUND: .planning/phases/09-add-the-option-to-delete-mops-products-and-users-for-the-adm/09-02-SUMMARY.md
- FOUND: 54e7d8d (Task 1 commit)
- FOUND: 438e67e (Task 2 commit)
