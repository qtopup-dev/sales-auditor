---
phase: 10-add-the-option-to-delete-receivers-for-the-admin-role-mirror
plan: 02
subsystem: api
tags: [express, prisma, soft-delete, rbac, receivers]

# Dependency graph
requires:
  - phase: 10-add-the-option-to-delete-receivers-for-the-admin-role-mirror
    provides: "Plan 01's deletedAt schema field, composite index, and $extends softDeleteFilter injection on receiver.findMany"
provides:
  - "DELETE /api/receivers/:id admin-only soft-delete route (sets deletedAt, never touches Sale rows)"
  - "Write-path gap closure in sales.ts — soft-deleted receivers rejected on both sale create and receiverId edit"
affects: [10-03-frontend-delete-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DELETE route as a stricter, separate action from PATCH /:id/toggle — mirrors Phase 9 D-01 exactly, no cascade to Sale/AuditLog/Shift"
    - "Transaction call sites (tx.*) require explicit deletedAt: null since $extends is not active inside prisma.$transaction"

key-files:
  created: []
  modified:
    - packages/backend/src/routes/receivers.ts
    - packages/backend/src/routes/sales.ts

key-decisions:
  - "Existence check inside the new DELETE route bypasses isActive (undefined) but enforces deletedAt: null — an already-deleted receiver is treated identically to a nonexistent one (404 RECEIVER_NOT_FOUND), consistent with Plan 01's 'no show-deleted surface' decision"

patterns-established:
  - "Receiver now has the full Phase-9-equivalent delete surface: DELETE /:id sets deletedAt; both sales.ts write-path existence checks enforce deletedAt: null in addition to isActive: true"

requirements-completed: [PHASE10-SC2, PHASE10-SC3, PHASE10-SC4]

# Metrics
duration: 8min
completed: 2026-07-21
---

# Phase 10 Plan 02: Receiver DELETE route + sales.ts write-path gap fix Summary

**Added admin-only `DELETE /api/receivers/:id` (soft-delete via deletedAt, mirroring Phase 9 D-01) and closed the transaction write-path gap by adding `deletedAt: null` to both `tx.receiver.findFirst` existence checks in sales.ts, so a soft-deleted receiver can never be referenced by ID to create or edit a sale.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-21T22:18:00+08:00
- **Completed:** 2026-07-21T22:26:24+08:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- New `DELETE /api/receivers/:id` route appended to the end of `receivers.ts`, inheriting the router-level `requireRole('admin')` guard, scoped exclusively to `req.session.organizationId!` (never hardcoded `1`), setting `deletedAt = new Date()` on the target row and returning 204; returns 404 `RECEIVER_NOT_FOUND` for missing or already-deleted receivers
- Existing `PATCH /:id/toggle`, `PATCH /:id`, `POST /`, and `GET /` routes in `receivers.ts` left completely unmodified
- Both `tx.receiver.findFirst` existence checks in `sales.ts` (POST `/` create path and PATCH `/:id` receiverId edit branch) now require `deletedAt: null` in addition to `isActive: true`, closing the gap `$extends` cannot reach inside a transaction
- Phase 9's four product/mop `deletedAt: null` gap-fix blocks and the single `tx.shift.findFirst` call in `sales.ts` verified byte-for-byte unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DELETE /api/receivers/:id route** - `5d35ff2` (feat)
2. **Task 2: Add deletedAt: null to both receiver existence checks in sales.ts** - `f4532c0` (fix)

_No separate plan-metadata commit — final commit below covers SUMMARY/STATE/ROADMAP._

## Files Created/Modified
- `packages/backend/src/routes/receivers.ts` - Added `DELETE /:id` route (soft-delete via `deletedAt`), appended after the existing toggle route
- `packages/backend/src/routes/sales.ts` - Added `deletedAt: null` to the two `tx.receiver.findFirst` existence-check `where` clauses (create path + receiverId edit branch)

## Decisions Made
- Followed the plan's exact instruction: no `deletedAt` override anywhere in the new DELETE route or its existence check — a soft-deleted receiver is unconditionally treated as "not found" for delete-target purposes, matching Plan 01's decision that receivers have no "show deleted" surface

## Deviations from Plan

None - plan executed exactly as written. Both edits matched the plan's exact target code blocks on the first read; no auto-fixes were required.

## Issues Encountered

None. `npx tsc --noEmit` exited 0 after each task; all grep-based acceptance criteria passed on the first check.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend half of the Receiver delete feature is complete: `DELETE /api/receivers/:id` exists, is admin-only, org-scoped, sets `deletedAt`, and returns correct 204/404 responses. Deleted receivers immediately disappear from `GET /api/receivers` and `GET /api/catalog/receivers` via Plan 01's filter, and can no longer be referenced by ID on the sales write path.
- Plan 03 (frontend delete UI) can now wire a Delete button/confirm-dialog directly to this route with no further backend changes needed.
- No blockers.

---
*Phase: 10-add-the-option-to-delete-receivers-for-the-admin-role-mirror*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: packages/backend/src/routes/receivers.ts
- FOUND: packages/backend/src/routes/sales.ts
- FOUND commit: 5d35ff2
- FOUND commit: f4532c0
