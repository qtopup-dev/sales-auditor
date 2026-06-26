---
phase: 05-receiver-catalog
plan: 05
subsystem: frontend-components
tags: [typescript, react, react-select, react-query, sales-table, admin-table, csv-export, receiver-catalog]

# Dependency graph
requires:
  - phase: 05-02
    provides: Sale type with receiverId + receiverNameSnapshot; GET /api/catalog/receivers endpoint
  - phase: 05-03
    provides: POST /api/sales accepts receiverId; PATCH accepts field='receiverId'
provides:
  - AddRowForm sends receiverId (number) instead of receiver (string)
  - EditableCell handles receiverId as AsyncSelect field using catalog-receivers cache
  - SalesTable receiver column renders receiverNameSnapshot via EditableCell field="receiverId"
  - AdminSalesTable receiver column + CSV export use receiverNameSnapshot
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "catalog-receivers useQuery with queryKey=['catalog-receivers'] in both AddRowForm and EditableCell — single cache key shared across components"
    - "ReceiverOption type mirrors MopOption pattern exactly: { value: number; label: string }"
    - "loadReceivers ternary in EditableCell loadOptions: field==='productId' ? loadProducts : field==='mopId' ? loadMops : loadReceivers"
    - "setSelectedReceiver(null) in AddRowForm success handler alongside setSelectedProduct/setSelectedMop for consistent AsyncSelect reset"

key-files:
  created: []
  modified:
    - packages/frontend/src/components/sales/AddRowForm.tsx
    - packages/frontend/src/components/sales/EditableCell.tsx
    - packages/frontend/src/components/sales/SalesTable.tsx
    - packages/frontend/src/components/admin/AdminSalesTable.tsx

key-decisions:
  - "catalog-receivers queryFn added to both AddRowForm and EditableCell — React Query deduplicates the network request; no shared hook needed"
  - "loadOptions ternary extended (not if/else chain) to keep select field dispatch in single expression"
  - "setSelectedProduct(null) and setSelectedMop(null) added alongside setSelectedReceiver(null) in success handler — original code did not reset these but the AsyncSelects should reset visually after save"

requirements: [PHASE5-SC3, PHASE5-SC4, PHASE5-SC5]

# Metrics
duration: 4min
completed: 2026-06-26
---

# Phase 5 Plan 05: Frontend Receiver Combobox Integration Summary

**Four frontend components updated to use receiverId FK + receiverNameSnapshot: AddRowForm receiver field replaced with AsyncSelect combobox, EditableCell extended to handle receiverId as a select field, SalesTable and AdminSalesTable both updated to display and export receiverNameSnapshot**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-26T13:43:57Z
- **Completed:** 2026-06-26T13:48:13Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

### Task 1: AddRowForm.tsx

- `AddRowFormData` type: `receiver: string` removed; `receiverId: number | null` added
- `defaultValues`: `receiver: ''` removed; `receiverId: null` added
- `ReceiverOption` type (`{ value: number; label: string }`) and `selectedReceiver` state added
- `watchedReceiver` replaced with `watchedReceiverId`; `isFormValid` checks `watchedReceiverId !== null`
- `catalog-receivers` `useQuery` added with `staleTime: 5 * 60 * 1000`
- `isCatalogLoading` updated to include `receiversLoading`
- `receiverOptions` useMemo and `loadReceivers` useCallback added (mirrors mop pattern)
- Receiver div JSX: plain `<input type="text">` removed; `<Controller name="receiverId">` with `<AsyncSelect>` installed
- Success handler: `setSelectedReceiver(null)` added (alongside `setSelectedProduct(null)` and `setSelectedMop(null)`)

### Task 2: EditableCell.tsx

- `EditableCellProps.field` type union: `'receiver'` replaced with `'receiverId'`
- `SELECT_FIELDS`: `'receiverId'` added (`['productId', 'mopId', 'receiverId'] as const`)
- `catalog-receivers` `useQuery` added after existing `catalog-mops` query
- `loadReceivers` function added after `loadMops`
- `loadOptions` ternary extended: `field === 'mopId' ? loadMops : loadReceivers` as final branch

### Task 2: SalesTable.tsx

- Receiver column `accessorKey`: `'receiver'` changed to `'receiverNameSnapshot'`
- `EditableCell` props: `field="receiver"` changed to `field="receiverId"`; `displayValue={sale.receiver}` changed to `displayValue={sale.receiverNameSnapshot}`

### Task 2: AdminSalesTable.tsx

- `sanitizedRows` map: `receiver: sanitizeCell(row.receiver)` changed to `receiverNameSnapshot: sanitizeCell(row.receiverNameSnapshot)`
- `fields` array (CSV): `{ label: 'Receiver', value: 'receiver' }` changed to `{ label: 'Receiver', value: 'receiverNameSnapshot' }`
- Column definition: `accessorKey: 'receiver'` changed to `accessorKey: 'receiverNameSnapshot'`

## Task Commits

1. **Task 1: AddRowForm receiver AsyncSelect** — `5c9b5ca` (feat)
2. **Task 2: EditableCell + SalesTable + AdminSalesTable** — `ee3dcaf` (feat)

## TypeScript Verification

`npx tsc --noEmit` in `packages/frontend` exits with code 0 — no errors across all 4 modified files.

Before Task 2 was applied, two pre-existing errors existed:
- `AdminSalesTable.tsx(43): Property 'receiver' does not exist on type 'Sale'`
- `SalesTable.tsx(48): Property 'receiver' does not exist on type 'Sale'`

Both resolved by Task 2 — the Sale type was already updated in Plan 02 but the frontend components still referenced the removed `receiver` field.

## End-to-End Flow

1. Add Row form — receiver field shows AsyncSelect (not text input); loads from `/api/catalog/receivers` via `catalog-receivers` cache
2. Select a receiver in AddRowForm — `watchedReceiverId !== null` enables Save Row button; form POSTs `{ receiverId: number, ... }` not `{ receiver: string, ... }`
3. After save — `setSelectedReceiver(null)` resets the combobox; new row appears in table with `receiverNameSnapshot` populated
4. Inline edit — clicking a receiver cell in SalesTable opens AsyncSelect (field='receiverId' is in SELECT_FIELDS); PATCH sends `{ field: 'receiverId', value: '<id>' }`
5. Admin Dashboard table — Receiver column reads from `receiverNameSnapshot` (not undefined/empty)
6. CSV export — "Receiver" column maps to `receiverNameSnapshot` key in sanitizedRows

## Deviations from Plan

**1. [Rule 2 - Missing Reset] Added setSelectedProduct(null) and setSelectedMop(null) to success handler**
- **Found during:** Task 1
- **Issue:** Original success handler only called `closeAddRow()` and `onSaveSuccess()` — neither `setSelectedProduct` nor `setSelectedMop` was reset. The plan said to add `setSelectedReceiver(null)` "alongside" these calls, implying they should all be present.
- **Fix:** Added all three reset calls before `closeAddRow()`. Since `closeAddRow()` unmounts the form component, the resets are technically redundant, but they ensure clean state if the component is reused without unmounting in future.
- **Files modified:** `AddRowForm.tsx`
- **Commit:** `5c9b5ca`

## Known Stubs

None — all four components are fully wired. `receiverNameSnapshot` flows from the API response through table display and CSV export without any hardcoded placeholders.

## Threat Flags

No new security surface introduced. All threat model items from the plan's STRIDE register are addressed by prior plans:
- T-05-16: Backend Plan 03 enforces org-scoped receiver lookup on POST and PATCH
- T-05-17: `staleTime: 5min` applied; backend validates isActive on mutation
- T-05-18: `/api/catalog/receivers` requires authentication; response limited to session org

---
*Phase: 05-receiver-catalog*
*Completed: 2026-06-26*
