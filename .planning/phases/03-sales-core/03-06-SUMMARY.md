---
plan: 03-06
phase: 03-sales-core
status: complete
completed: 2026-06-23

dependency_graph:
  requires:
    - 03-04  # SalesTable.tsx (stub EditableCell replaced here)
    - 03-05  # AuditDrawer.tsx (wired into SalesPage here)
    - 03-03  # VoidConfirmDialog.tsx (wired into SalesPage here)
    - 03-02  # salesEditStore.ts (useSalesEditStore — activeCellSaleId, draftValue, etc.)
    - 03-01  # backend PATCH /api/sales/:id (EditableCell fires PATCH on blur)
  provides:
    - EditableCell.tsx — inline cell edit state machine (display→active→pending→display)
    - SalesPage.tsx — full integrated Phase 3 sales page
  affects:
    - SalesTable.tsx — stub removed, real EditableCell import added

tech_stack:
  added:
    - react-select AsyncSelect — used in EditableCell for productId/mopId cell edit mode
  patterns:
    - Zustand draftValue isolation — draft value lives in salesEditStore, not React Query cache (prevents focus-loss during virtual scroll redraws)
    - Pessimistic cell disable with spinner — isThisCellPending renders bg-gray-100 opacity-60 + animate-spin
    - menuPortalTarget={document.body} + menuPosition=fixed — prevents AsyncSelect menu clipping inside virtualizer container

key_files:
  created:
    - packages/frontend/src/components/sales/EditableCell.tsx
  modified:
    - packages/frontend/src/pages/SalesPage.tsx
    - packages/frontend/src/components/sales/SalesTable.tsx

decisions:
  - EditableCell uses Zustand draftValue (not React Query or sale prop) per D-05 — avoids focus-loss on scroll redraws
  - AuditDrawer rendered only when user?.role === 'admin' — T-03-19 mitigation; moderators never mount it
  - SalesPage uses flex-1 min-h-0 on table container — critical for Firefox height containment with virtualizer

metrics:
  duration_minutes: 15
  tasks_completed: 2
  files_created: 1
  files_modified: 2
---

# Phase 3 Plan 06 Summary — EditableCell + SalesPage Integration

## What Was Built

Inline cell edit state machine (EditableCell.tsx) and full SalesPage.tsx replacing the placeholder, wiring all Phase 3 components together as the final plan of the sales-core phase.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Create EditableCell.tsx — inline cell edit state machine | 98d1b0d | complete |
| 2 | Replace SalesPage.tsx placeholder with full integrated page | 222de19 | complete |

## Key Files

### Created
- `packages/frontend/src/components/sales/EditableCell.tsx` — ~245 lines; display→active→pending→display state machine; text input with Escape-to-discard; textarea for Notes with auto-height; AsyncSelect for productId/mopId with immediate PATCH on change; spinner on pending; D-03 (isAddRowOpen guard) and D-04 (isPending guard) on handleClick; menuPortalTarget={document.body} on both AsyncSelect instances

### Modified
- `packages/frontend/src/pages/SalesPage.tsx` — replaced 9-line placeholder with 65-line full page; integrates SalesTable, AuditDrawer (admin only), VoidConfirmDialog; useQuery(['sales']); flex-1 min-h-0 table container; loading/error/empty states
- `packages/frontend/src/components/sales/SalesTable.tsx` — removed local stub EditableCell function; added `import { EditableCell } from './EditableCell'`

## Decisions Made

1. **draftValue from Zustand only** — EditableCell reads `draftValue` exclusively from `useSalesEditStore()`, never from the sale prop or React Query cache. This is the critical STATE.md pitfall: if draft were in React Query, scroll redraws re-render and reset the input to the server value, losing typed text.

2. **AuditDrawer admin-only mount** — `{user?.role === 'admin' && <AuditDrawer />}` means the component is never in the DOM for moderators. Backend also returns 403 for moderators. Defense in depth for T-03-19.

3. **VoidConfirmDialog rendered for all users** — visibility is store-controlled (`isVoidDialogOpen`). Only admin can trigger it via the Void button (which only renders for admins in SalesTable).

4. **flex-1 min-h-0 on table container** — without `min-h-0`, Firefox does not collapse the flex child to fit the parent, so the virtualizer cannot calculate scroll container height. This is a known Firefox flex behavior difference.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — EditableCell replaces the last stub in the Phase 3 frontend codebase. SalesPage is fully wired.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. EditableCell fires `PATCH /api/sales/:id` (already in threat register as T-03-17/T-03-18). SalesPage `AuditDrawer` gating implements T-03-19 mitigation.

## Verification

- `cd packages/frontend && npx tsc --noEmit` — exits 0, no errors
- `packages/frontend/src/components/sales/EditableCell.tsx` — exists, exports `EditableCell`
- `packages/frontend/src/pages/SalesPage.tsx` — contains `export function SalesPage`, `<SalesTable sales={sales} />`, `{user?.role === 'admin' && <AuditDrawer />}`, `<VoidConfirmDialog />`, `flex-1 min-h-0`, `queryKey: ['sales']`
- SalesTable.tsx stub removed; real `import { EditableCell } from './EditableCell'` in place

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| EditableCell.tsx exists | FOUND |
| SalesPage.tsx exists | FOUND |
| Commit 98d1b0d exists | FOUND |
| Commit 222de19 exists | FOUND |
| `npx tsc --noEmit` exits 0 | PASSED |
