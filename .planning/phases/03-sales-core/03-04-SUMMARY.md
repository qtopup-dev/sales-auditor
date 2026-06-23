---
plan: 03-04
phase: 03-sales-core
status: complete
completed: 2026-06-23
---

# Plan 03-04 Summary — SalesTable + AddRowForm

## What Was Built

Virtual-scroll sales table (SalesTable.tsx) and inline Add Row form (AddRowForm.tsx) rendered as the first virtual row.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Create SalesTable.tsx with react-table v8 + react-virtual v3 | 2896039 | ✓ |
| 2 | Create AddRowForm.tsx as inline virtual row 0 | 089c36c | ✓ |

## Key Files

### Created
- `packages/frontend/src/components/sales/SalesTable.tsx` — react-table v8 column definitions + react-virtual v3 useVirtualizer with `measureElement` + `data-index` for dynamic row heights; sticky header; voided rows get `bg-red-50` + `line-through`; admin sees Void + Audit buttons; table min-width 1160px for mobile scroll (SALES-18)
- `packages/frontend/src/components/sales/AddRowForm.tsx` — react-hook-form + react-select AsyncSelect with `menuPortalTarget={document.body}` + `menuPosition="fixed"` to prevent overflow clipping; Product selection auto-populates Price; Save Row disabled until Product+MOP+Receiver filled; Escape dismisses; pessimistic UI disables all inputs during save

## Decisions & Deviations

- Implemented inline by orchestrator (subagent blocked by tool permissions in this session)
- `EditableCell` in SalesTable.tsx is a local stub (plain text span with strikethrough for void) — Plan 06 replaces it with the real interactive EditableCell import
- `isNewRowGuard` type guard used instead of casting to discriminate the `isNewRow` sentinel

## Verification

- `useVirtualizer` imported from `@tanstack/react-virtual`
- `data-index={virtualItem.index}` on every virtual row — REQUIRED for ResizeObserver
- `ref={virtualizer.measureElement}` on every virtual row — REQUIRED
- `transform: translateY(${virtualItem.start}px)` for row positioning
- `height: ${virtualizer.getTotalSize()}px` on the `<tr>` container
- `sticky top-0 z-10` on the header row
- `minWidth: '1160px'` on the table (SALES-18)
- `line-through` applied in EditableCell stub for voided rows (SALES-15)
- `openVoidDialog` / `openAuditDrawer` in actions column with `role === 'admin'` guard
- `isAddRowOpen` sentinel prepends `{ isNewRow: true }` to rows; AddRowForm spans `colSpan={columns.length}`
- `menuPortalTarget={document.body}` on both AsyncSelect instances — prevents overflow clipping inside virtual scroll container
- `disabled={isPending || !isFormValid}` on Save Row button (SALES-14)
- `queryClient.invalidateQueries({ queryKey: ['sales'] })` + `closeAddRow()` + `onSaveSuccess()` on success

## Self-Check: PASSED

SalesTable renders virtual rows with correct measureElement attributes; AddRowForm opens as virtual row 0 with column-aligned layout; AsyncSelect combos use portal to prevent clip.
