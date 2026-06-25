---
phase: 03-sales-core
plan: "07"
subsystem: ui
tags: [react-virtual, react-select, virtualizer, zustand, tanstack]

requires:
  - phase: 03-04
    provides: SalesTable with useVirtualizer + AddRowForm as virtual row 0
  - phase: 03-06
    provides: Full SalesPage integration with AddRowForm rendered when isAddRowOpen

provides:
  - useVirtualizer with initialRect so AddRowForm renders on first SalesTable mount
  - AddRowForm tracks selectedProduct/selectedMop option state — AsyncSelect shows chosen name after pick

affects: [03-sales-core]

tech-stack:
  added: []
  patterns:
    - initialRect on useVirtualizer for first-render sizing before ResizeObserver fires
    - Controlled react-select with local option state alongside form field ID state

key-files:
  created: []
  modified:
    - packages/frontend/src/components/sales/SalesTable.tsx
    - packages/frontend/src/components/sales/AddRowForm.tsx

key-decisions:
  - "initialRect: { width: 0, height: 600 } — height matches default viewport estimate; width:0 avoids horizontal overflow"
  - "selectedProduct/selectedMop tracked independently from react-hook-form field state — form receives numeric ID, display state is separate"

patterns-established:
  - "react-virtual: always pass initialRect when the scroll container may be unmeasured on first render"
  - "react-select controlled mode: maintain option object in state alongside field ID value"

requirements-completed:
  - SALES-02
  - SALES-04
  - SALES-08
  - SALES-10
---

# Plan 03-07 Summary

**useVirtualizer initialRect fix + AsyncSelect controlled state — AddRowForm renders on first mount, selected option names persist after pick**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-25T17:00:00Z
- **Completed:** 2026-06-25T17:32:23Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Fixed: clicking "Add Row" on a page with no existing sales rows (fresh SalesTable mount) now immediately renders the AddRowForm — `initialRect: { width: 0, height: 600 }` provides the virtualizer a sizing assumption before ResizeObserver fires
- Fixed: after selecting a product in AddRowForm, the AsyncSelect control now shows the selected product name instead of resetting to placeholder — same fix applied to MOP AsyncSelect

## Task Commits

1. **Task 1: initialRect for useVirtualizer** — `c975f83` (fix)
2. **Task 2: selectedProduct/selectedMop state tracking** — `c975f83` (fix, combined with Task 1)

## Files Created/Modified

- `packages/frontend/src/components/sales/SalesTable.tsx` — Added `initialRect: { width: 0, height: 600 }` to `useVirtualizer` call
- `packages/frontend/src/components/sales/AddRowForm.tsx` — Added `ProductOption`/`MopOption` types, `selectedProduct`/`selectedMop` state, bound as `value` props on AsyncSelect; `onChange` handlers set both field ID (react-hook-form) and display option (state)

## Decisions Made

- `height: 600` for initialRect — provides enough virtual space to render the AddRowForm row (and any pre-existing rows) before the ResizeObserver measurement; 600px is a safe minimum for typical viewport heights
- Option state types (`ProductOption`, `MopOption`) defined inline in AddRowForm rather than in shared types — they are display-only and not consumed by any other component

## Deviations from Plan

None — plan executed exactly as specified.

## Issues Encountered

None.

## Next Phase Readiness

- The two first-mount/UX bugs are resolved for the empty-table and no-rows-yet scenarios
- An additional blocker was discovered during UAT: clicking "Add Row" when 200+ rows exist hangs the browser (virtualizer size-cache remap cascade). This requires a separate gap plan.

---
*Phase: 03-sales-core*
*Completed: 2026-06-25*
