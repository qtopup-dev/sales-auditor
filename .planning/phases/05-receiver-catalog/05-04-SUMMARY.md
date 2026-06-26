---
phase: 05-receiver-catalog
plan: 04
subsystem: frontend-ui
tags: [typescript, react, tanstack-query, tanstack-table, react-hook-form, receivers, catalog-page, modal, routing, navbar]

# Dependency graph
requires:
  - phase: 05-02
    provides: Receiver TypeScript interface in @alejinput/shared; GET/POST/PATCH/toggle endpoints at /api/receivers
  - phase: 05-03
    provides: Sales routes migrated to receiverId (no impact on this plan)
provides:
  - ReceiversPage: admin catalog page with Name | Account # | Status | Actions table
  - ReceiverModal: create/edit modal with name (required) + accountNumber (optional) fields
  - /receivers route (admin-only, nested in ProtectedRoute requiredRole="admin")
  - Receivers nav link in ADMIN_NAV sidebar (between MOPs and Users)
affects:
  - 05-05 (sales sheet: SalesTable and AdminSalesTable still reference old receiver string — fixed by 05-05)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ReceiversPage follows MopsPage pattern exactly; accountNumber column (160px) added between name and status"
    - "ReceiverModal follows MopModal pattern; adds accountNumber field with optional/maxLength(100) validation"
    - "empty string accountNumber mapped to null on submit via .trim() || null"
    - "modalTarget: Receiver | 'create' | null — same discriminated union as MopsPage"

key-files:
  created:
    - packages/frontend/src/pages/ReceiversPage.tsx
    - packages/frontend/src/components/catalog/ReceiverModal.tsx
  modified:
    - packages/frontend/src/router/index.tsx
    - packages/frontend/src/layouts/AuthenticatedLayout.tsx

key-decisions:
  - "ReceiverModal uses form id='receiver-form' + submit button form='receiver-form' attribute (same pattern as MopModal's 'mop-form')"
  - "accountNumber field optional: empty string coerced to null on submit; maxLength(100) validation matches backend"
  - "/receivers route positioned between /mops and /users in admin children block to match sidebar ordering"
  - "Receivers nav item inserted between MOPs and Users in ADMIN_NAV to maintain consistent catalog section grouping"

# Metrics
duration: 5min
completed: 2026-06-26
---

# Phase 5 Plan 04: Receivers Catalog Admin Page Summary

**ReceiversPage (Name / Account # / Status / Actions table) and ReceiverModal (name required + accountNumber optional) built; /receivers route added to admin ProtectedRoute block; Receivers nav link added to ADMIN_NAV sidebar**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-26T13:43:51Z
- **Completed:** 2026-06-26T13:49:24Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `packages/frontend/src/components/catalog/ReceiverModal.tsx` created — create/edit modal mirroring MopModal:
  - `form id="receiver-form"` with external submit button binding
  - `Receiver Name` field: required, error message "Receiver Name is required"
  - `Account Number (optional)` field: maxLength(100), placeholder "e.g. ACC-001"
  - Empty `accountNumber` string coerced to `null` via `.trim() || null` on submit
  - `createMutation`: POST /receivers; `updateMutation`: PATCH /receivers/:id
  - Both mutations invalidate `['receivers']` query on success
  - Pessimistic UI: `disabled={isPending}` on all inputs and both buttons (CLAUDE.md Rule 10)
  - Title: "Add Receiver" (create) / "Edit Receiver" (edit)
  - CTA: "Add Receiver" (create) / "Save Changes" (edit); cancel: "Discard"

- `packages/frontend/src/pages/ReceiversPage.tsx` created — catalog admin page mirroring MopsPage:
  - `useQuery<Receiver[]>({ queryKey: ['receivers'] })` → `api.get<Receiver[]>('/receivers')`
  - 4 columns: `name` (auto-size) | `accountNumber` (160px, shows '—' when null) | `status` (100px, StatusBadge) | `actions` (160px)
  - `toggleMutation` with pessimistic `pendingToggleId` state — disables row's Edit + toggle buttons during in-flight toggle
  - `api.patch<Receiver>(\`/receivers/${receiverId}/toggle\`)` + invalidates `['receivers']` on success
  - Row click opens edit modal; `stopPropagation` on actions cell prevents modal from opening when clicking action buttons
  - Empty state: "No receivers yet" + "Add your first receiver to get started."
  - Loading state: `<p className="text-sm text-gray-500">Loading...</p>`

- `packages/frontend/src/router/index.tsx` modified:
  - `ReceiversPage` imported from `'../pages/ReceiversPage'`
  - `{ path: '/receivers', element: <ReceiversPage /> }` added to admin ProtectedRoute children (between /mops and /users)

- `packages/frontend/src/layouts/AuthenticatedLayout.tsx` modified:
  - `{ to: '/receivers', label: 'Receivers' }` added to ADMIN_NAV between MOPs and Users

## Task Commits

1. **Task 1: ReceiverModal** — `161d153` (feat)
2. **Task 2: ReceiversPage + router + ADMIN_NAV** — `d7d4754` (feat)

## Deviations from Plan

None — plan executed exactly as written. ReceiversPage and ReceiverModal are direct analogs of MopsPage/MopModal with the addition of the `accountNumber` column and field.

## TypeScript Compilation Status

`packages/frontend npx tsc --noEmit` exits with 2 pre-existing errors NOT introduced by this plan:

```
src/components/admin/AdminSalesTable.tsx(43,34): error TS2551: Property 'receiver' does not exist on type 'Sale'. Did you mean 'receiverId'?
src/components/sales/SalesTable.tsx(48,76): error TS2551: Property 'receiver' does not exist on type 'Sale'. Did you mean 'receiverId'?
```

These errors were introduced in Plan 05-02 when `Sale.receiver: string` was replaced by `Sale.receiverId: number` and `Sale.receiverNameSnapshot: string`. `AdminSalesTable.tsx` and `SalesTable.tsx` still reference the old `receiver` field. These are out of scope for this plan (scope boundary: only files in `files_modified`). Plan 05-05 (sales sheet receiver combobox) is expected to update these files.

Neither `ReceiverModal.tsx` nor `ReceiversPage.tsx` produces any TypeScript errors.

## Known Stubs

None — ReceiversPage and ReceiverModal are fully wired to the backend API. All data flows end-to-end:
- `useQuery(['receivers'])` → `GET /api/receivers` (plan 05-02)
- `createMutation` → `POST /api/receivers` (plan 05-02)
- `updateMutation` → `PATCH /api/receivers/:id` (plan 05-02)
- `toggleMutation` → `PATCH /api/receivers/:id/toggle` (plan 05-02)

## Threat Flags

No new security surface beyond the plan's threat model:
- T-05-13: /receivers route is nested inside `<ProtectedRoute requiredRole="admin" />` — moderators redirected to /sales
- T-05-14: React JSX escapes receiver.name and receiver.accountNumber automatically — no dangerouslySetInnerHTML used
- T-05-15: Toggle uses PATCH (not GET) — session cookie sameSite: 'lax'

---
*Phase: 05-receiver-catalog*
*Completed: 2026-06-26*
