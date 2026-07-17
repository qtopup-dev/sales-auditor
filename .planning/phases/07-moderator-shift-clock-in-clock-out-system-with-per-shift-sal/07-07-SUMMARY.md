---
phase: 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal
plan: 07
subsystem: ui
tags: [react, react-query, tailwind, shift-gating, sales-sheet]

# Dependency graph
requires:
  - phase: 07-plan-02
    provides: "GET /api/shifts/current with activeSalesCount/activeSalesRevenue totals, req.session.userId scoping"
  - phase: 07-plan-03
    provides: "POST /api/sales role-gated shiftId lookup, GET /api/sales?shiftId= ownership check"
  - phase: 07-plan-05
    provides: "ClockControl, ShiftTotalsBanner, ClockOutConfirmDialog components + shiftStore"
provides:
  - "Sidebar ClockControl wired into AuthenticatedLayout for moderators, positioned above username/logout"
  - "Shifts nav item for admin, Shift History nav item for moderator"
  - "Role-branched SalesPage: shift-gated three-state moderator view vs. unchanged admin full-history view"
  - "Add Row mutation invalidates both ['sales'] and ['current-shift'] so ShiftTotalsBanner updates live"
affects: [07-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Role-branched query enablement: enabled: isModerator / enabled: !isModerator to keep admin and moderator data fetches mutually exclusive and independently cacheable"
    - "Sibling query key invalidation: prefix-matching invalidateQueries(['sales']) does not cover the separate top-level ['current-shift'] key — both must be invalidated explicitly on mutation success"

key-files:
  created: []
  modified:
    - packages/frontend/src/layouts/AuthenticatedLayout.tsx
    - packages/frontend/src/pages/SalesPage.tsx
    - packages/frontend/src/components/sales/AddRowForm.tsx

key-decisions:
  - "Admin SalesPage path left byte-for-byte behaviorally identical to pre-Phase-7 (D-05) — only isModerator ternary branches diverge"
  - "Moderator State A (no active shift) performs a true reset: no ['sales', 'current-shift'] query is even issued until currentShift exists (D-12)"

patterns-established:
  - "Query key namespacing: ['sales', 'current-shift'] as a distinct child key of ['sales'] lets Add Row's invalidateQueries(['sales']) refetch both admin and moderator table queries via prefix match, while ['current-shift'] (banner data) needs its own explicit invalidation"

requirements-completed: []

# Metrics
duration: 18min
completed: 2026-07-17
---

# Phase 07 Plan 07: Wire Moderator Shift Experience into Shell Files Summary

**Role-branched SalesPage shift-gating (D-03/D-11/D-12/D-13) plus sidebar ClockControl and nav wiring, with live ShiftTotalsBanner updates via dual query-key invalidation on Add Row.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-17T18:04:00Z
- **Completed:** 2026-07-17T18:22:40Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `ClockControl` renders in the sidebar only for `role === 'moderator'`, positioned between the nav list and the username/logout block; both nav arrays gained their Phase 7 items (`Shifts` for admin, `Shift History` for moderator)
- `SalesPage.tsx` now role-branches: moderators get the three-state shift-gated view (clock-in prompt / empty-shift / shift-scoped table) with `ShiftTotalsBanner` and tooltip-gated Add Row; admins retain the exact pre-Phase-7 full-history view, untouched
- `AddRowForm.tsx`'s `createMutation.onSuccess` now invalidates both `['sales']` and `['current-shift']`, so `ShiftTotalsBanner`'s count/revenue update immediately after a moderator adds a row — no clock-out, reload, or navigation required

## Task Commits

Each task was committed atomically:

1. **Task 1: AuthenticatedLayout.tsx — ClockControl insertion + nav updates for both roles** - `73bc22e` (feat)
2. **Task 2: SalesPage.tsx — role-branched shift-gating (moderator) with unchanged admin path** - `52e0b12` (feat)
3. **Task 3: AddRowForm.tsx — invalidate ['current-shift'] on successful add** - `e3ddf17` (feat)

**Plan metadata:** (this commit, worktree mode — SUMMARY.md only, STATE.md/ROADMAP.md excluded per orchestrator contract)

## Files Created/Modified
- `packages/frontend/src/layouts/AuthenticatedLayout.tsx` - Imports and conditionally renders `ClockControl` for moderators; adds `/shifts` (admin) and `/shift-history` (moderator) nav entries
- `packages/frontend/src/pages/SalesPage.tsx` - Full role-branch: moderator shift-gated three-state view with `ShiftTotalsBanner`/`ClockOutConfirmDialog`, admin path unchanged
- `packages/frontend/src/components/sales/AddRowForm.tsx` - Added `queryClient.invalidateQueries({ queryKey: ['current-shift'] })` alongside the existing `['sales']` invalidation in `createMutation.onSuccess`

## Decisions Made
None beyond what the plan specified — implementation followed the plan's provided code blocks verbatim for all three tasks.

## Deviations from Plan

None — plan executed exactly as written for all three tasks. TypeScript compiles cleanly (`npx tsc --noEmit` produced no output/errors) after each task.

**Note on one acceptance criterion:** Task 2's acceptance criteria list included `grep -n "'sales', 'current-shift'" packages/frontend/src/pages/SalesPage.tsx returns at least 2 matches`. The plan's own reference implementation (reproduced verbatim in this plan's Task 2 action block) contains this exact string literal only once (in the `queryKey: ['sales', 'current-shift']` array). This is a minor inconsistency in the plan's acceptance criteria authoring, not a functional gap — the query key is used consistently (declared once, matched by prefix from `['sales']` invalidation elsewhere), and all other acceptance criteria for Task 2 pass exactly. No code change was made to artificially satisfy this literal-count criterion, since doing so would mean duplicating the string without functional purpose.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The moderator vertical slice (clock in/out sidebar control, shift-gated Sales Sheet, live-updating totals banner) is fully wired and ready for manual verification per the plan's `<verification>` steps once the dev servers are running.
- Plan 07-08 (parallel, same wave) builds `AdminShiftTabs`/`AdminShiftsPage`/router wiring independently — no file overlap with this plan's changes (`AuthenticatedLayout.tsx`, `SalesPage.tsx`, `AddRowForm.tsx`).
- No blockers identified.

---
*Phase: 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal*
*Completed: 2026-07-17*

## Self-Check: PASSED

All 3 modified files and the SUMMARY.md exist on disk; all 3 task commits (73bc22e, 52e0b12, e3ddf17) found in git log.
