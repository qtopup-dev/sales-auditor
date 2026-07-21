---
phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
plan: 05
subsystem: ui
tags: [react, react-query, tanstack-table, users, delete, error-mapping]

# Dependency graph
requires:
  - phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
    provides: "DELETE /api/users/:id endpoint with CANNOT_DELETE_SELF/LAST_ADMIN safeguards (Plan 03)"
provides:
  - "UserDeleteConfirmDialog component with error-code-to-message mapping"
  - "Delete link in UsersPage Actions column, disabled on admin's own row"
affects: [09-06-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Error-code-to-copy mapping function (getErrorMessage) reused from InviteRegisterPage precedent, applied to User delete safeguards"

key-files:
  created:
    - packages/frontend/src/components/users/UserDeleteConfirmDialog.tsx
  modified:
    - packages/frontend/src/pages/UsersPage.tsx

key-decisions:
  - "Confirm dialog body copy uses the same generic template as Product/MOP delete dialogs (D-05) — no extra User-specific warning text"
  - "Own-row Delete disable is a UX guard only; CANNOT_DELETE_SELF enforcement is server-side (Plan 03), matching T-09-17 threat disposition"

patterns-established: []

requirements-completed: [PHASE9-SC1, PHASE9-SC4, PHASE9-SC5, PHASE9-SC6]

# Metrics
duration: 8min
completed: 2026-07-21
---

# Phase 09 Plan 05: User Delete Frontend Summary

**UserDeleteConfirmDialog with CANNOT_DELETE_SELF/LAST_ADMIN error-code mapping, wired into UsersPage's Actions column with an own-row UX disable guard**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-21T16:33:37+08:00
- **Completed:** 2026-07-21T16:39:23+08:00
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Built `UserDeleteConfirmDialog.tsx` modeled on `VoidConfirmDialog.tsx`'s structural pattern (Modal + useMutation + pessimistic pending state), using the codebase's minimal `{ id, username }` props convention from `UserModal.tsx`
- Implemented `getErrorMessage()` mapping `CANNOT_DELETE_SELF` and `LAST_ADMIN` API error codes to their exact UI-SPEC copy, with a generic fallback for any other error — following the `InviteRegisterPage.tsx` error-extraction precedent
- Wired a red "Delete" link into `UsersPage.tsx`'s Actions column after Reset Password, disabled on the admin's own row (`isOwnRow` UX guard) and during any row-pending state
- Confirmed successful delete removes the row via `queryClient.invalidateQueries({ queryKey: ['users'] })` — no page reload, no client-side optimistic removal

## Task Commits

Each task was committed atomically:

1. **Task 1: Create UserDeleteConfirmDialog.tsx with error-code mapping** - `f4fb3a3` (feat)
2. **Task 2: Wire Delete button + dialog into UsersPage.tsx with own-row disable** - `656ad72` (feat)

## Files Created/Modified
- `packages/frontend/src/components/users/UserDeleteConfirmDialog.tsx` - New delete confirm dialog with error-code-to-message mapping for the two User-specific backend safeguards
- `packages/frontend/src/pages/UsersPage.tsx` - Added `deleteTarget` state, `isOwnRow` guard, red Delete link in Actions column, and `UserDeleteConfirmDialog` mount

## Decisions Made
- Followed the plan's exact prescribed content for the dialog component and page edits — no deviation from the specified copy, classes, or structure.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Frontend User delete flow is complete and type-checks clean (`npx tsc --noEmit` exits 0)
- Depends on Plan 03's `DELETE /api/users/:id` endpoint (already merged) for runtime correctness
- Ready for Plan 06 (phase-wide verification) to exercise the manual smoke test steps: own-row disable, cancel flow, successful delete, last-admin error message

---
*Phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: packages/frontend/src/components/users/UserDeleteConfirmDialog.tsx
- FOUND: packages/frontend/src/pages/UsersPage.tsx
- FOUND: commit f4fb3a3
- FOUND: commit 656ad72
