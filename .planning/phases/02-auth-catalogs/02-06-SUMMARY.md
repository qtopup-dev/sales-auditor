---
phase: 02-auth-catalogs
plan: "06"
subsystem: ui
tags: [react, tailwind, react-table, react-hook-form, react-query, products, mops, catalog, modal, soft-delete, pessimistic-ui]

# Dependency graph
requires:
  - phase: 02-auth-catalogs
    provides: "02-03: productsRouter and mopsRouter with GET list, POST create, PATCH update, PATCH toggle endpoints"
  - phase: 02-auth-catalogs
    provides: "02-04: axios singleton, QueryClient, authStore, router with ProtectedRoute guards and inline ProductsPage/MopsPage placeholders"
provides:
  - "Modal.tsx: shared overlay+card wrapper, Escape key + backdrop close, close blocked when onClose undefined during save"
  - "StatusBadge.tsx: green Active (bg-green-100/text-green-800) / gray Inactive (bg-gray-200/text-gray-600) chips"
  - "ProductModal.tsx: create/edit modal with react-hook-form, price as type=text, pessimistic UI, queryKey=['products'] invalidation"
  - "MopModal.tsx: create/edit modal, name only, same pessimistic pattern, queryKey=['mops'] invalidation"
  - "ProductsPage.tsx: react-table v8 table with Name/Price/Status/Actions columns, per-row toggle pessimism, empty state, row-click edit"
  - "MopsPage.tsx: same pattern without price column, MOPs-specific empty state copy"
  - "router/index.tsx: inline ProductsPage/MopsPage placeholders replaced with real imports"
affects:
  - 03-sales-sheet (uses StatusBadge and Modal patterns; table pattern establishes conventions for sales sheet)
  - 04-admin-dashboard (UsersPage will follow same table+modal pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "@tanstack/react-table v8 column definitions — ColumnDef<T>[] with accessorKey for data columns, id for derived columns"
    - "Per-row pessimistic toggle tracking — pendingToggleId: number|null disables only the in-flight row (not all rows)"
    - "Modal open state as local useState (not Zustand) — server data in React Query, UI state local"
    - "Row-click opens edit modal; actions cell uses e.stopPropagation() to prevent row click bubbling"
    - "Modal onClose=undefined during isPending blocks Escape key + backdrop click + close button (CLAUDE.md Rule 10)"
    - "Price input type=text (NOT number) — prevents JS float coercion on DECIMAL(10,2) values (CLAUDE.md Rule 6)"

key-files:
  created:
    - "packages/frontend/src/components/Modal.tsx"
    - "packages/frontend/src/components/StatusBadge.tsx"
    - "packages/frontend/src/components/catalog/ProductModal.tsx"
    - "packages/frontend/src/components/catalog/MopModal.tsx"
    - "packages/frontend/src/pages/ProductsPage.tsx"
    - "packages/frontend/src/pages/MopsPage.tsx"
  modified:
    - "packages/frontend/src/router/index.tsx"

key-decisions:
  - "Modal onClose prop undefined (not disabled flag) blocks all close paths — Escape, backdrop, X button all check onClose existence before firing"
  - "Per-row pendingToggleId tracks in-flight toggle by product/mop ID — prevents disabling all rows when one is saving (CLAUDE.md Rule 10 scoped to affected row)"
  - "Price input type=text with regex pattern validation — CLAUDE.md Rule 6 prevents float precision loss; backend express-validator is authoritative"
  - "Row-click opens edit modal; actions cell uses e.stopPropagation() — avoids modal open conflict with toggle buttons"

patterns-established:
  - "Table pattern: ColumnDef<T>[] with size for fixed-width columns, no size uses default 150 (header width check for style application)"
  - "Catalog page pattern: useQuery for list, useMutation for toggle, local useState for modal open state"
  - "Modal pattern: open prop + onClose prop (undefined during save), footer slot for action buttons, form with id attribute + submit button form=id"

requirements-completed:
  - PROD-01
  - PROD-02
  - PROD-03
  - PROD-04
  - PROD-06
  - PROD-07
  - PAY-01
  - PAY-02
  - PAY-03
  - PAY-04
  - PAY-06
  - ROLES-07
  - ROLES-08

# Metrics
duration: ~7min
completed: "2026-06-17"
---

# Phase 2 Plan 06: Catalog UI Pages Summary

**React-table v8 catalog management UI — Modal/StatusBadge primitives, ProductsPage and MopsPage with per-row pessimistic toggle tracking, admin-only product and MOP CRUD wired to Plan 03 backend API**

## Performance

- **Duration:** ~7 minutes
- **Started:** 2026-06-17T18:27:18Z
- **Completed:** 2026-06-17T18:34:00Z
- **Tasks:** 2
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

- Modal.tsx and StatusBadge.tsx shared primitives establish the table+modal pattern that Phase 3 (sales sheet) and Phase 4 (user management) will reuse
- ProductsPage delivers PROD-01 through PROD-04, PROD-06, PROD-07: react-table v8 table with Name/Price/Status/Actions; Add Product button; row-click edit; Deactivate/Activate toggle with per-row pending state; empty state copy per UI-SPEC.md
- MopsPage mirrors ProductsPage with no price column, delivering PAY-01 through PAY-04, PAY-06
- Router inline placeholders (`const ProductsPage = () => <div>Products</div>`) replaced with real page imports — admin can now navigate to /products and /mops and see functional catalog management
- ROLES-07/08: /products and /mops remain inside `<ProtectedRoute requiredRole="admin" />` guard; backend requireRole('admin') is authoritative per CLAUDE.md Rule 9

## Task Commits

1. **Task 1: Create shared UI primitives and catalog modals** - `8a99427` (feat)
2. **Task 2: Implement ProductsPage and MopsPage; wire router** - `f5a3fba` (feat)

## Files Created/Modified

- `packages/frontend/src/components/Modal.tsx` — overlay+card wrapper; Escape key + backdrop close blocked when onClose=undefined; aria-modal, aria-labelledby for accessibility
- `packages/frontend/src/components/StatusBadge.tsx` — green Active (bg-green-100/text-green-800) / gray Inactive (bg-gray-200/text-gray-600) pill badges
- `packages/frontend/src/components/catalog/ProductModal.tsx` — create/edit modal; price type=text with /^\d+(\.\d{0,2})?$/ pattern validation; pessimistic disabled state; POST /products / PATCH /products/:id mutations; queryKey=['products'] invalidation on success
- `packages/frontend/src/components/catalog/MopModal.tsx` — same pattern, name field only; POST /mops / PATCH /mops/:id; queryKey=['mops'] invalidation
- `packages/frontend/src/pages/ProductsPage.tsx` — react-table v8 with ColumnDef<Product>[] (Name, Price right-aligned, Status badge, Actions); per-row pendingToggleId; PATCH /products/:id/toggle; empty state UI-SPEC copy
- `packages/frontend/src/pages/MopsPage.tsx` — same pattern, no price column; PATCH /mops/:id/toggle; empty state "No modes of payment yet" / "Add your first payment method to get started."
- `packages/frontend/src/router/index.tsx` — removed inline `const ProductsPage = () => <div>Products</div>` and `const MopsPage = () => <div>MOPs</div>`; added real imports from pages/

## Decisions Made

- **Modal onClose=undefined (not disabled boolean)** — passing undefined for onClose is the natural way to signal "modal is busy"; all three close paths (Escape, backdrop click, X button) check `onClose?.()` or `if (onClose)` — no need for a separate `isClosable` prop
- **Per-row pendingToggleId** — tracks which product/mop ID has an in-flight toggle mutation. Only that row's buttons are disabled; other rows stay interactive. This is scoped pessimism per CLAUDE.md Rule 10 — disable during save round-trip but only the affected element
- **Price type=text with regex validation** — CLAUDE.md Rule 6 mandates never using Float for monetary values. type="number" would still parse to JS float internally; type="text" with regex `/^\d+(\.\d{0,2})?$/` keeps price as string end-to-end until backend validates with express-validator isDecimal
- **Row-click + e.stopPropagation on actions cell** — UX pattern: clicking a row opens the edit modal; but action buttons (Edit, Deactivate/Activate) should not also trigger the row click handler. stopPropagation on the actions cell resolves the conflict cleanly

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All API calls are wired to real backend endpoints from Plan 03 (GET/POST/PATCH /api/products and GET/POST/PATCH /api/mops). The only HTML `placeholder` attribute is `placeholder="0.00"` on the price input — this is a UX placeholder, not a data stub.

## Threat Surface Scan

All STRIDE threats from the plan's threat model are mitigated as implemented:

- T-02-P06-01 (Elevation of Privilege): /products and /mops remain inside `<ProtectedRoute requiredRole="admin" />`; backend requireRole('admin') at router level is authoritative
- T-02-P06-02 (Tampering): Price input is type="text" with `/^\d+(\.\d{0,2})?$/` frontend regex; backend express-validator isDecimal is authoritative per T-02-P03-05
- T-02-P06-03 (Tampering): pendingToggleId disables the specific row's toggle button during mutation — no double-submit possible for same product/mop
- T-02-P06-04 (Information Disclosure): Backend requireRole('admin') returns 403 for any moderator attempt; frontend ProtectedRoute redirects to /sales

No new threat surface beyond what the plan's threat model covers.

## Issues Encountered

None. TypeScript compilation passed with zero errors on both commits.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 3 (Sales Core) can now reference the Modal.tsx, StatusBadge.tsx, and table+modal patterns for the sales sheet inline edit cells and row-action dialogs
- Phase 4 (Admin Dashboard) UsersPage will follow the same react-table v8 + modal pattern established here
- All catalog management requirements (PROD-01 through PROD-04/06/07, PAY-01 through PAY-04/06) are frontend-complete; backend endpoints were delivered in Plan 03

---
*Phase: 02-auth-catalogs*
*Completed: 2026-06-17*

## Self-Check: PASSED

Files confirmed present:
- packages/frontend/src/components/Modal.tsx: FOUND (commit 8a99427)
- packages/frontend/src/components/StatusBadge.tsx: FOUND (commit 8a99427)
- packages/frontend/src/components/catalog/ProductModal.tsx: FOUND (commit 8a99427)
- packages/frontend/src/components/catalog/MopModal.tsx: FOUND (commit 8a99427)
- packages/frontend/src/pages/ProductsPage.tsx: FOUND (commit f5a3fba)
- packages/frontend/src/pages/MopsPage.tsx: FOUND (commit f5a3fba)
- packages/frontend/src/router/index.tsx: MODIFIED (commit f5a3fba — inline placeholders removed)

Commits confirmed:
- 8a99427: feat(02-06): create shared UI primitives Modal, StatusBadge and catalog modals ProductModal, MopModal
- f5a3fba: feat(02-06): implement ProductsPage and MopsPage; wire real imports into router

Verification checks:
- TypeScript compilation: PASSED (zero errors)
- No inline placeholder in router: PASSED
- Empty state "No products yet": FOUND (ProductsPage.tsx line 128)
- Empty state "No modes of payment yet": FOUND (MopsPage.tsx line 111)
- No type="number" on price input: PASSED
- pendingToggleId in ProductsPage: FOUND (lines 24, 71)
