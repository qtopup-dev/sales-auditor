---
phase: 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal
plan: 05
subsystem: frontend
tags: [react, zustand, react-query, tailwind, shift, dialogs]

# Dependency graph
requires:
  - phase: 07-02
    provides: "GET /shifts/current, POST /shifts/clock-in, POST /shifts/clock-out endpoints + Shift/ShiftWithTotals shared types"
  - phase: 07-04
    provides: "POST /admin/shifts/:id/force-clock-out endpoint"
provides:
  - "useShiftStore — Zustand overlay state for ClockOutConfirmDialog/ForceClockOutConfirmDialog"
  - "ClockControl — sidebar clock in/out control (unwired, consumed by Plan 07)"
  - "ClockOutConfirmDialog, ForceClockOutConfirmDialog — confirm dialogs (unwired, consumed by Plans 07/08)"
  - "ShiftTotalsBanner — reusable two-stat presentational banner (unwired, consumed by Plans 07/08)"
affects: ["07-07 (SalesPage/AuthenticatedLayout wires ClockControl + ShiftTotalsBanner)", "07-08 (AdminShiftsPage wires ForceClockOutConfirmDialog + ShiftTotalsBanner)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Curried create<State>()((set) => ({...})) Zustand pattern cloned from salesEditStore.ts for shift dialog overlay state"
    - "VoidConfirmDialog.tsx structural clone basis reused for both new confirm dialogs, varying only title/endpoint/invalidated keys/button color"
    - "UTC-derived 12-hour clock display (getUTCHours/getUTCMinutes) as the one intentional exception to the app's 24-hour UTC table convention, scoped to this glanceable sidebar readout"

key-files:
  created:
    - packages/frontend/src/stores/shiftStore.ts
    - packages/frontend/src/components/shift/ClockControl.tsx
    - packages/frontend/src/components/shift/ClockOutConfirmDialog.tsx
    - packages/frontend/src/components/shift/ForceClockOutConfirmDialog.tsx
    - packages/frontend/src/components/shift/ShiftTotalsBanner.tsx
  modified: []

key-decisions:
  - "ClockOutConfirmDialog confirm button is accent-blue (bg-blue-600), not destructive-red — moderator's own voluntary clock-out is reversible and low-consequence (D-09), unlike ForceClockOutConfirmDialog which keeps red since it's an admin override of another user's live session"
  - "ShiftTotalsBanner composes its own divs rather than importing StatCard, to keep count (number) and revenue (string) props typed distinctly per UI-SPEC, while matching StatCard's visual shell exactly"
  - "Clock In requires no confirmation dialog at all (D-09) — single click fires POST /shifts/clock-in directly"

patterns-established:
  - "Shift confirm dialogs follow the exact VoidConfirmDialog clone recipe: same Modal wrapper, same footer button pair shape, same pessimistic-disable-during-mutation behavior — only title/endpoint/invalidated-queries/button-color differ per dialog's semantics"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-07-18
---

# Phase 07 Plan 05: Shift Clock Control Primitives Summary

**Five reusable frontend building blocks — Zustand shiftStore, sidebar ClockControl, both confirm dialogs (blue for self clock-out, red for admin force clock-out), and a presentational ShiftTotalsBanner — built together, none yet wired into a page**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-17T18:02:00Z
- **Completed:** 2026-07-17T18:10:23Z
- **Tasks:** 3
- **Files created:** 5

## Accomplishments
- `useShiftStore` tracks `isClockOutDialogOpen`, `isForceClockOutDialogOpen`, and `forceClockOutTarget` ({shiftId, username}) with open/close actions, cloned from `salesEditStore.ts`'s curried Zustand pattern
- `ClockControl` shows a single-click "Clock In" button (no confirmation, D-09) when the moderator has no open shift, and "Clocked in at {12hr UTC-derived time}" + "Clock Out" button when clocked in; polls `['current-shift']` via React Query
- `ClockOutConfirmDialog` clones `VoidConfirmDialog`'s structure but confirms with an accent-blue (not red) button and invalidates `['current-shift']` + `['sales', 'current-shift']` on success
- `ForceClockOutConfirmDialog` keeps the destructive-red confirm button (admin overriding another user's live session), interpolates the target username into the confirmation copy, and invalidates `['admin-shifts']`
- `ShiftTotalsBanner` is a pure presentational two-card component (Sales This Shift / Revenue This Shift) with zero float arithmetic on the revenue string — pure `'₱' + revenue` concatenation

## Task Commits

Each task was committed atomically:

1. **Task 1: shiftStore.ts — Zustand overlay state for both confirm dialogs** - `375904d` (feat)
2. **Task 2: ClockControl.tsx + ClockOutConfirmDialog.tsx — moderator clock flow** - `45966c5` (feat)
3. **Task 3: ForceClockOutConfirmDialog.tsx + ShiftTotalsBanner.tsx** - `5ac178c` (feat)

_Note: worktree mode — SUMMARY.md commit only includes SUMMARY.md/REQUIREMENTS.md; STATE.md/ROADMAP.md are excluded and owned by the orchestrator._

## Files Created/Modified
- `packages/frontend/src/stores/shiftStore.ts` - Zustand overlay state store for both shift confirm dialogs
- `packages/frontend/src/components/shift/ClockControl.tsx` - Sidebar clock in/out control with UTC-derived 12hr time display
- `packages/frontend/src/components/shift/ClockOutConfirmDialog.tsx` - Moderator's own clock-out confirmation (accent-blue confirm)
- `packages/frontend/src/components/shift/ForceClockOutConfirmDialog.tsx` - Admin override confirmation (destructive-red confirm)
- `packages/frontend/src/components/shift/ShiftTotalsBanner.tsx` - Reusable two-stat presentational banner (count + revenue)

## Decisions Made
- Followed the plan's exact code blocks verbatim (direct clones of `VoidConfirmDialog.tsx`/`salesEditStore.ts`/`StatCard.tsx` shell), since the plan fully specified copy strings, Tailwind classes, and behavior with no ambiguity requiring judgment calls
- No new files, endpoints, or store shapes beyond what the plan specified

## Deviations from Plan

None — plan executed exactly as written. All three tasks' code blocks were used verbatim as specified.

**Note on Task 3 acceptance criteria wording:** The plan's own `ShiftTotalsBanner.tsx` action code includes an inline comment reading `// Pure string concat — NEVER parseFloat/Number() (CLAUDE.md Rule 6)`. The literal acceptance-criteria grep (`parseFloat\|Number(`) matches this comment text (1 match on line 28), even though the actual code performs zero float arithmetic on the revenue prop — the comment is documentation, not a function call. This is a pre-existing false-positive in the plan's own verification grep pattern (present in the plan's source, not introduced by this execution), not a code defect. No code deviation was needed; documenting here for the verifier's awareness.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. TypeScript compiled cleanly against the existing worktree without needing to copy the backend's generated Prisma client or `.env` (this plan touches frontend-only files with no backend dependency).

## Next Phase Readiness
- All five primitives are ready for Plan 07 to wire `ClockControl` into `AuthenticatedLayout` (conditional on `role === 'moderator'`) and `ShiftTotalsBanner`/`ClockOutConfirmDialog` into `SalesPage`
- Ready for Plan 08 to wire `ForceClockOutConfirmDialog` and a second `ShiftTotalsBanner` instance into `AdminShiftsPage`
- No blockers for downstream phases

---
*Phase: 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: packages/frontend/src/stores/shiftStore.ts
- FOUND: packages/frontend/src/components/shift/ClockControl.tsx
- FOUND: packages/frontend/src/components/shift/ClockOutConfirmDialog.tsx
- FOUND: packages/frontend/src/components/shift/ForceClockOutConfirmDialog.tsx
- FOUND: packages/frontend/src/components/shift/ShiftTotalsBanner.tsx
- FOUND: 375904d (Task 1 commit)
- FOUND: 45966c5 (Task 2 commit)
- FOUND: 5ac178c (Task 3 commit)
