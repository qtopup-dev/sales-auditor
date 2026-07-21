---
phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
plan: 04
subsystem: ui
tags: [react, react-query, tailwind, catalog, delete]

# Dependency graph
requires:
  - phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
    provides: "Plan 02 backend DELETE /api/products/:id and DELETE /api/mops/:id routes with soft-delete (deletedAt)"
provides:
  - "ProductDeleteConfirmDialog.tsx and MopDeleteConfirmDialog.tsx — props-based confirm dialogs modeled on VoidConfirmDialog.tsx"
  - "Red Delete link in Actions column of ProductsPage.tsx and MopsPage.tsx"
affects: [09-05, 09-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Props-based confirm dialog target (entity | null) instead of Zustand store, for dialogs triggered from plain (non-virtualized) pages"

key-files:
  created:
    - packages/frontend/src/components/catalog/ProductDeleteConfirmDialog.tsx
    - packages/frontend/src/components/catalog/MopDeleteConfirmDialog.tsx
  modified:
    - packages/frontend/src/pages/ProductsPage.tsx
    - packages/frontend/src/pages/MopsPage.tsx

key-decisions:
  - "Followed UI-SPEC.md exactly: no generic reusable ConfirmDialog introduced; each entity gets its own hand-built dialog, matching the codebase's existing per-feature confirm dialog convention"
  - "deleteTarget kept as separate local useState from modalTarget so Edit and Delete dialogs can never collide"

patterns-established:
  - "Delete link placed after Deactivate/Activate in Actions column, red destructive styling (text-red-600/bg-red-600), disabled during same-row toggle-pending state"

requirements-completed: [PHASE9-SC1, PHASE9-SC2]

# Metrics
duration: 12min
completed: 2026-07-21
---

# Phase 09 Plan 04: Product/MOP Delete Frontend Summary

**Red Delete link + confirm dialog wired into ProductsPage and MopsPage, calling DELETE /api/products/:id and /api/mops/:id via props-based dialogs modeled on VoidConfirmDialog**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-21T08:27:00Z
- **Completed:** 2026-07-21T08:39:20Z
- **Tasks:** 2 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Created `ProductDeleteConfirmDialog.tsx` and `MopDeleteConfirmDialog.tsx`, structurally identical to `VoidConfirmDialog.tsx` (Modal + useMutation + pessimistic pending state) but with props-based targets instead of a Zustand store
- Wired a red "Delete" link into the Actions column of `ProductsPage.tsx` and `MopsPage.tsx`, after the existing Deactivate/Activate button
- Successful delete invalidates the `['products']` / `['mops']` query, removing the row from the table with no page reload
- Existing Edit and Deactivate/Activate buttons untouched (verified via `setModalTarget` occurrence count unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ProductDeleteConfirmDialog.tsx and MopDeleteConfirmDialog.tsx** - `646207d` (feat)
2. **Task 2: Wire Delete button + dialog into ProductsPage.tsx and MopsPage.tsx** - `61fa19a` (feat)

**Plan metadata:** committed in this SUMMARY commit (worktree mode — orchestrator merges to master)

## Files Created/Modified
- `packages/frontend/src/components/catalog/ProductDeleteConfirmDialog.tsx` - Product delete confirm dialog, calls `DELETE /products/:id`
- `packages/frontend/src/components/catalog/MopDeleteConfirmDialog.tsx` - MOP delete confirm dialog, calls `DELETE /mops/:id`
- `packages/frontend/src/pages/ProductsPage.tsx` - Added `deleteTarget` state, red Delete link, dialog mount
- `packages/frontend/src/pages/MopsPage.tsx` - Added `deleteTarget` state, red Delete link, dialog mount

## Decisions Made
None beyond what UI-SPEC.md and the plan's interfaces section already locked in — followed the exact code blocks given in the plan verbatim.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npx tsc --noEmit` exited 0 after both tasks; all acceptance-criteria greps passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05 (User delete dialog + UsersPage wiring) runs in parallel in a separate worktree — no file overlap with this plan
- Plan 06 (integration/verification) can now confirm Products and MOPs delete flows end-to-end once merged with Plan 02's backend routes
- No blockers

---
*Phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: packages/frontend/src/components/catalog/ProductDeleteConfirmDialog.tsx
- FOUND: packages/frontend/src/components/catalog/MopDeleteConfirmDialog.tsx
- FOUND: commit 646207d
- FOUND: commit 61fa19a
