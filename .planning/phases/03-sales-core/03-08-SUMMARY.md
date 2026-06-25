---
phase: 03-sales-core
plan: 08
subsystem: ui
tags: [react, tanstack-virtual, tanstack-table, virtualizer, performance]

requires:
  - phase: 03-07
    provides: initialRect fix and AddRowForm selectedProduct/selectedMop state

provides:
  - SalesTable.tsx refactored — AddRowForm outside virtualizer as static non-virtualized <tr>
  - Virtualizer count permanently stable at sales.length (never N+1)
  - ColumnDef<Sale>[] columns — no union type, no type guards in cell renderers
  - SALES-04 blocker closed — Add Row no longer freezes browser with 200+ rows

affects: [04-admin-dashboard]

tech-stack:
  added: []
  patterns:
    - "Static non-virtualized row pattern: render form/toolbar rows as plain <tr> in <tbody> before virtualizer output rows, not inside the virtualizer data array"

key-files:
  created: []
  modified:
    - packages/frontend/src/components/sales/SalesTable.tsx

key-decisions:
  - "AddRowForm rendered as static <tr> in <tbody> before paddingTop spacer — never inside virtualizer item loop"
  - "columns typed as ColumnDef<Sale>[] directly — TableRow union type and isNewRowGuard removed"
  - "useReactTable receives data: sales (never sentinel-prepended array) — virtualizer count stable"

patterns-established:
  - "Non-virtualized static row: place before paddingTop spacer in <tbody>, no data-index or ref={measureElement}, colSpan={columns.length}"

requirements-completed: [SALES-04]

duration: 5min
completed: 2026-06-25
---

# Plan 03-08: SalesTable Virtualizer Fix Summary

**AddRowForm moved outside the virtualizer — virtualizer count now permanently stable at `sales.length`, eliminating the size-cache remap that froze the browser with 200+ rows**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-25T18:30:00Z
- **Completed:** 2026-06-25T18:35:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Removed `TableRow` union type, `isNewRowGuard` type guard, and `isNewRow: true as const` sentinel from `SalesTable.tsx`
- `columns` is now `ColumnDef<Sale>[]` — no isNewRowGuard branches in any cell renderer
- `useReactTable` receives `data: sales` directly — virtualizer count is always `tableRows.length`, stable regardless of Add Row open state
- `AddRowForm` renders as a static non-virtualized `<tr>` in `<tbody>` before the paddingTop spacer row, visible only when `isAddRowOpen` is true
- All invariants from Plan 03-07 preserved: `initialRect`, `measureElement`, `overscan: 3`, `data-index` on each virtual row

## Task Commits

1. **Task 1: Refactor SalesTable.tsx — move AddRowForm outside virtualizer** — `c142324` (fix)

## Files Created/Modified

- `packages/frontend/src/components/sales/SalesTable.tsx` — Removed TableRow union, isNewRowGuard, sentinel prepend; AddRowForm now static <tr> before paddingTop spacer; columns typed as ColumnDef<Sale>[]

## Decisions Made

None — followed plan as specified. Target file content was prescribed in the plan.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

`npm run typecheck` script did not exist — used `npx tsc --noEmit` directly. TypeScript exited 0.

## Self-Check: PASSED

All 10 acceptance criteria verified:
1. `isNewRow: true` → 0 occurrences ✓
2. `isNewRowGuard` → 0 occurrences ✓
3. `type TableRow` → 0 occurrences ✓
4. `ColumnDef<Sale>` → 1 occurrence ✓
5. `isAddRowOpen && (` → 1 occurrence ✓
6. `data: sales,` → 1 occurrence ✓
7. `? <td colSpan` → 0 occurrences ✓
8. `initialRect` → 1 occurrence (Plan 03-07 fix preserved) ✓
9. `overscan: 3` → 1 occurrence ✓
10. `data-index={virtualItem.index}` → 1 occurrence ✓
TypeScript: exits 0 ✓

## Next Phase Readiness

- SALES-04 blocker resolved — Add Row no longer freezes browser with 200+ rows
- Phase 3 gap closure complete — 03-VERIFICATION.md had one remaining gap (this plan), now closed
- Human verification still needed: Add Row end-to-end flow with 200+ rows in live browser (03-HUMAN-UAT.md test 1)
- Phase 4 (Admin Dashboard) can proceed

---
*Phase: 03-sales-core*
*Completed: 2026-06-25*
