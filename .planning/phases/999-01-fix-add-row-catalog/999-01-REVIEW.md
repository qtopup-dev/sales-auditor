---
phase: 999-01-fix-add-row-catalog
reviewed: 2026-06-24T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - packages/backend/src/routes/catalog.ts
  - packages/backend/src/app.ts
  - packages/frontend/src/pages/SalesPage.tsx
  - packages/frontend/src/components/sales/AddRowForm.tsx
  - packages/frontend/src/components/sales/EditableCell.tsx
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 999-01: Code Review Report

**Reviewed:** 2026-06-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the bugfix phase that introduces `/api/catalog/products` and `/api/catalog/mops` endpoints and updates the frontend to read from the React Query cache seeded by those endpoints. The backend wiring (`app.ts`) and the React Query cache pattern in all three frontend files are correctly implemented. One critical multi-tenancy bug was found in `catalog.ts`: `organizationId` is hard-coded to `1` instead of reading from the authenticated session. Two warnings were identified in `AddRowForm.tsx`: a controlled-value issue with `react-select` that causes the selected option to visually reset immediately after selection.

---

## Critical Issues

### CR-01: Catalog routes hard-code `organizationId: 1` — ignores session tenant

**File:** `packages/backend/src/routes/catalog.ts:11` and `:21`

**Issue:** Both handlers hard-code `organizationId: 1` in the Prisma `where` clause. The `requireAuth` middleware (which protects these routes via `protectedRouter`) validates and stores `req.session.organizationId` and rejects sessions that lack it. However, the catalog handlers never read that value — they always query org 1 regardless of which tenant the authenticated user belongs to. This is a silent multi-tenancy bug: a user from any future organization will receive org-1 catalog data, and org-1 users could in principle be handed another org's data if the hard-code were ever changed. Additionally, the parameter is named `_req` (underscore prefix), signaling it is unused — but it must be used to fix this issue.

**Fix:**
```typescript
// GET /api/catalog/products
catalogRouter.get('/products', async (req, res) => {
  const products = await prisma.product.findMany({
    where: { organizationId: req.session.organizationId },
    orderBy: { name: 'asc' },
  });
  res.json(products.map((p) => ({ id: p.id, name: p.name, price: p.price.toFixed(2) })));
});

// GET /api/catalog/mops
catalogRouter.get('/mops', async (req, res) => {
  const mops = await prisma.mop.findMany({
    where: { organizationId: req.session.organizationId },
    orderBy: { name: 'asc' },
  });
  res.json(mops.map((m) => ({ id: m.id, name: m.name })));
});
```

---

## Warnings

### WR-01: `value={null}` on product AsyncSelect causes visual reset after selection

**File:** `packages/frontend/src/components/sales/AddRowForm.tsx:123`

**Issue:** The product `AsyncSelect` is rendered with `value={null}` as a controlled prop. After the user selects a product, `react-select` immediately re-renders with `value={null}`, clearing the displayed selection to the placeholder text. The form state (`productId`) and the price display do update correctly, but the dropdown control itself shows no selected option — a confusing UX regression where the user cannot see what they chose. The MOP `AsyncSelect` at line 162 has the same problem (`value={null}` is absent there — but see WR-02 below).

**Fix:** Use a local `useState` to hold the selected option and bind `value` to it, or remove the controlled `value` prop entirely and let `react-select` manage display state internally. Since the form already tracks `productId` via react-hook-form and price via `priceDisplay`, the simplest fix is to remove `value={null}`:

```tsx
// In the product Controller render prop — remove the `value={null}` line entirely.
// react-select will display the most recently selected option without external control.

// If you need to reset on form submit, call reset() from useForm and wrap
// AsyncSelect in a key prop derived from a reset counter instead of value={null}.
```

### WR-02: `value={null}` missing on MOP AsyncSelect — inconsistent controlled state

**File:** `packages/frontend/src/components/sales/AddRowForm.tsx:141-167`

**Issue:** The MOP `AsyncSelect` does not have `value={null}` (unlike the product select), making it uncontrolled while product is controlled. This is an inconsistency: both selects are managed by react-hook-form `Controller`, but they behave differently after selection. The MOP select will retain the visual selection, while the product select resets. This inconsistency may mask the WR-01 fix — removing `value={null}` from the product select aligns both selects' behaviour. Flagged separately because the asymmetry itself is a quality defect independent of WR-01.

**Fix:** After resolving WR-01 (removing `value={null}` from the product select), both selects will be consistently uncontrolled at the `value` level. No additional code change needed beyond the WR-01 fix.

---

## Info

### IN-01: Catalog route handlers have no try/catch — unhandled Prisma errors

**File:** `packages/backend/src/routes/catalog.ts:9` and `:19`

**Issue:** Both async route handlers lack `try/catch`. Express 5 forwards unhandled promise rejections to the next error handler automatically, so this is not a crash risk under Express 5. However, all other routers in this codebase (`products.ts`, `mops.ts`, `users.ts`, `sales.ts`) also omit try/catch and rely on Express 5 error forwarding — so this is consistent with the project pattern. Flagged as info for awareness; no immediate action required.

**Fix:** No change needed to match current codebase pattern. If the project ever adds structured error logging inside route handlers, add try/catch at that point.

### IN-02: `_req` underscore parameter convention is incorrect in catalog handlers

**File:** `packages/backend/src/routes/catalog.ts:9` and `:19`

**Issue:** Both handlers use `_req` to signal "unused parameter". Once CR-01 is fixed to read `req.session.organizationId`, the parameter is no longer unused. The underscore must be removed. Leaving `_req` after using it is misleading and may cause lint warnings depending on the project's ESLint config (`no-unused-vars` with `argsIgnorePattern: '^_'`).

**Fix:** Rename `_req` to `req` in both handler signatures (required by the CR-01 fix above).

---

_Reviewed: 2026-06-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
