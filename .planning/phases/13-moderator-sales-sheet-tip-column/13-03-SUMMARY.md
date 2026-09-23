---
phase: 13-moderator-sales-sheet-tip-column
plan: 03
subsystem: frontend
tags: [tanstack-react-table, react-query, csv-export]

# Dependency graph
requires:
  - phase: 13-moderator-sales-sheet-tip-column (plan 01)
    provides: Sale.tip shared type, EditableCell field="tip", serializeSale tip passthrough (also on VoidRequestWithSale.sale via voidRequests.ts)
provides:
  - "Inline-editable Tip column on AdminSalesTable (dashboard) after Price, reusing EditableCell/PATCH flow"
  - "Sanitized Tip column in AdminSalesTable CSV export, after Price"
  - "Display-only Tip column on VoidRequestsTable after Price"
affects: []

# Actuals (#2632)
actuals:
  tokens: 1076
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin tables reuse packages/frontend/src/components/sales/EditableCell.tsx directly (cross-directory import) rather than duplicating tip edit logic — admins get the same PATCH/permission flow as moderators for free"

key-files:
  created: []
  modified:
    - packages/frontend/src/components/admin/AdminSalesTable.tsx
    - packages/frontend/src/components/admin/VoidRequestsTable.tsx

key-decisions:
  - "AdminSalesTable Tip column cell renders <EditableCell sale={row.original} field=\"tip\" ...> with no new permission logic — EditableCell's existing canEdit-or-admin + status!=='void' gate already covers the admin case (D-17, Rule 9)"
  - "VoidRequestsTable Tip cell is a plain right-aligned <span> (not EditableCell) since void-request rows are never edited, matching the existing Price column's display-only convention (D-20)"

patterns-established: []

requirements-completed: [D-17, D-18, D-20, D-21]

coverage:
  - id: D1
    description: "AdminSalesTable shows a right-aligned Tip column right after Price, editable inline via EditableCell/PATCH, empty when no tip; voided rows are not editable (D-17, D-21)"
    verification:
      - kind: other
        ref: "13-03-PLAN.md Task 1 <verify> automated block — ADMIN TABLE OK (tsc clean, field=\"tip\" present, 3rd accessorKey is 'tip')"
        status: pass
    human_judgment: true
    rationale: "Right-alignment, empty-cell rendering, and the click-to-edit interaction are visual/interaction behaviors best confirmed by a human on the running dashboard rather than inferred from a grep-based static check."
  - id: D2
    description: "AdminSalesTable CSV export has a Tip column right after Price, sanitized via sanitizeCell, empty value when no tip (D-18, D-21)"
    verification:
      - kind: other
        ref: "13-03-PLAN.md Task 1 <verify> automated block — ADMIN TABLE OK (sanitizeCell(row.tip ?? '') present once, 3rd CSV field label is 'Tip')"
        status: pass
    human_judgment: false
  - id: D3
    description: "VoidRequestsTable shows a right-aligned, display-only Tip column right after Price, empty when no tip (D-20, D-21)"
    verification:
      - kind: other
        ref: "13-03-PLAN.md Task 2 <verify> automated block — VOID TABLE OK (tsc clean, row.original.sale.tip ?? '' present, 3rd column id is 'tip')"
        status: pass
    human_judgment: true
    rationale: "Right-alignment and empty-cell rendering next to Price are visual behaviors best confirmed by a human looking at the running Void Requests tab."

duration: ~10min
completed: 2026-09-23
status: complete
---

# Phase 13 Plan 03: Admin Tables Tip Column Summary

**Dashboard AdminSalesTable gets an inline-editable, right-aligned Tip column after Price (plus a sanitized Tip field in the CSV export), and VoidRequestsTable gets a matching display-only Tip column — both reusing Plan 13-01's EditableCell/serializeSale plumbing with zero new backend or permission code**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- Added an editable, right-aligned Tip column to `AdminSalesTable.tsx` immediately after Price, rendering `<EditableCell field="tip">` so admins edit tips through the exact same PATCH `/api/sales/:id` flow, permission gate, and validation as the moderator sheet — no new RBAC logic (D-17, Rule 9)
- Added a sanitized `Tip` column to the CSV export (`downloadCSV`), positioned right after Price, running through the existing `sanitizeCell` formula-injection guard with an empty value for null tips (D-18, D-21)
- Added a display-only, right-aligned Tip column to `VoidRequestsTable.tsx` after Price, rendering `sale.tip ?? ''` as a plain span (void-request rows are never edited) — no backend change needed since `voidRequests.ts` already serializes `sale.tip` via `serializeSale` from Plan 13-01 (D-20, D-21)
- Verified both changes with `tsc -p packages/frontend/tsconfig.json` (clean) plus the plan's static grep gates confirming column order (3rd column = Tip, after Product/Price) and correct sanitization/rendering expressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Dashboard sales table — inline-editable Tip column + CSV Tip field** - `0295413` (feat)
2. **Task 2: Void Requests table — display-only Tip column** - `b0844a6` (feat)

## Files Created/Modified
- `packages/frontend/src/components/admin/AdminSalesTable.tsx` - imported `EditableCell` from `../sales/EditableCell`; inserted `accessorKey: 'tip'` column after `priceSnapshot` rendering `<EditableCell sale={row.original} field="tip" displayValue={row.original.tip ?? ''} />`; added `tip: sanitizeCell(row.tip ?? '')` to the CSV row mapping and `{ label: 'Tip', value: 'tip' }` to the CSV `fields` array, both after Price; updated header comment
- `packages/frontend/src/components/admin/VoidRequestsTable.tsx` - inserted `id: 'tip'` column after the `price` column, rendering `row.original.sale.tip ?? ''` right-aligned; updated header comment's column list

## Decisions Made
- `AdminSalesTable`'s Tip cell reuses `EditableCell` directly (cross-directory import from `components/sales/`) instead of building a parallel admin-specific input — `EditableCell` already enforces `canEdit-or-admin` + `status !== 'void'`, which is exactly the admin permission model needed here
- `VoidRequestsTable`'s Tip cell stays a plain `<span>` (not `EditableCell`) since void-request rows are read-only by design, matching the existing Price column's convention in the same table

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — both threats in the plan's `<threat_model>` (T-13-10 CSV formula injection, T-13-11 elevation of privilege on inline tip edit) were mitigated exactly as specified: `sanitizeCell` wraps the CSV `tip` value, and the admin inline edit routes through the existing PATCH endpoint's server-side `canEdit-or-admin` + `parseTip` validation from Plan 13-01, with no new client-side trust added.

## Issues Encountered

None. The user's dev server (API :3001, Vite :5173 via `tsx --watch`) was already running at task start per project memory; no second instance was started. Both tasks were pure frontend component edits with `tsc` as the verification gate — no server restart or runtime check was needed beyond the existing dev server picking up Vite HMR.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- This is the last plan of Phase 13. All three plans (13-01 tip capture, 13-02 revenue totals, 13-03 admin tables) are complete.
- Two coverage items (D1, D3) are marked `human_judgment: true` for visual confirmation of the Tip column's alignment, empty-cell rendering, and inline-edit interaction on the running dashboard and Void Requests tab — recommended for `/gsd-verify-work`.
- No blockers identified.

---
*Phase: 13-moderator-sales-sheet-tip-column*
*Completed: 2026-09-23*

## Self-Check: PASSED
