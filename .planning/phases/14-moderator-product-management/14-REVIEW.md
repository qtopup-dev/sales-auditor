---
phase: 14-moderator-product-management
reviewed: 2026-09-24T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - packages/backend/src/app.ts
  - packages/backend/src/middleware/requireRole.ts
  - packages/backend/src/routes/products.check.ts
  - packages/backend/src/routes/products.ts
  - packages/frontend/src/components/catalog/ProductDeleteConfirmDialog.tsx
  - packages/frontend/src/components/catalog/ProductModal.tsx
  - packages/frontend/src/layouts/AuthenticatedLayout.tsx
  - packages/frontend/src/pages/ProductsPage.tsx
  - packages/frontend/src/router/index.tsx
findings:
  critical: 2
  warning: 3
  info: 3
  total: 8
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-09-24
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

The RBAC widening is done correctly. `requireRole(...roles)` fails closed, other routers are unchanged, and the frontend `/products` route and nav entry are right. Toggle and delete write their audit rows in the same transaction, behind an `updateMany` + count guard.

The problems start with who can now reach these endpoints. This phase lets moderators, a less-trusted role, set product prices. The backend price validator accepts negative values, even though the threat model says it does not. The toggle endpoint flips whatever state the server currently holds, so a user looking at a stale list can do the opposite of what they meant. The PATCH `/:id` edit path skipped the race guard the plan applied everywhere else. The frontend also leaves users stuck when they lose a race.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Backend price validation accepts negative, malformed and out-of-range prices, and moderators can now set prices

**File:** `packages/backend/src/routes/products.ts:99-105, 151-159`
**Issue:** `isDecimal({ decimal_digits: '0,2' })` is the only server-side price check. I ran it against the installed validator:
- `"-5"`, `"-0.01"`, `"+.5"` → accepted. A product is created with a negative price. `sales.ts:258` copies `product.price` into `priceSnapshot`, so every sale of that product records a negative amount and reduces sales totals.
- `"."`, `"-."` → accepted, then Prisma cannot parse them as a Decimal → 500.
- `"99999999999"` → accepted, but it exceeds DECIMAL(10,2) → DB error → 500.
- `price: ["1"]` and `name: ["A","B"]` (arrays) → express-validator passes them item by item, then Prisma throws → 500.
- `name` has no length limit, and the column is VARCHAR(255) → a longer name gives a 500.

The frontend regex `/^\d+(\.\d{0,2})?$/` blocks negative prices. But that check is UI-only (Rule 9), and a moderator can call `/api/products` directly. The plan's threat entry T-14-06 says the existing validators mitigate this, which is not true. Before this phase only admins could set prices. Now every moderator can.
**Fix:**
```ts
const PRICE_RE = /^\d{1,8}(\.\d{1,2})?$/; // non-negative, fits DECIMAL(10,2)
const productCreateValidation = [
  body('name').isString().trim().notEmpty().withMessage('Product Name is required')
    .isLength({ max: 255 }).withMessage('Product Name is too long'),
  body('price').isString().trim().notEmpty().withMessage('Price is required')
    .matches(PRICE_RE).withMessage('Enter a valid price (e.g., 10.00)'),
];
// same rules with .optional() first in productUpdateValidation
```

### CR-02: Toggle flips whatever the server holds, so a stale UI can do the opposite of what the user meant

**File:** `packages/backend/src/routes/products.ts:238-277`; `packages/frontend/src/pages/ProductsPage.tsx:34-47, 96`
**Issue:** `PATCH /:id/toggle` reads the current `isActive` on the server and writes the opposite value. The `updateMany` guard only covers the few milliseconds between that read and the write. It does not protect the user's intent. Now that several moderators and admins manage the catalog at the same time, this is a realistic sequence:
1. Moderator A and Moderator B both have `/products` open. Product X shows as "Active" with a "Deactivate" button.
2. A deactivates X.
3. B's list is still stale (no refetch without a focus change). B clicks "Deactivate". The server reads `isActive=false` and flips it to `true`.

X is now **active** again, even though B clicked "Deactivate". An audit row records B as the actor for `isActive false → true`, a change B never intended. X reappears in every sales-sheet dropdown. A true race loser also gets `404 PRODUCT_NOT_FOUND` for a product that exists, and `onError` (ProductsPage.tsx:46) swallows it without refetching.
**Fix:** Send the desired state. The client already sends a `{}` body for the OpenLiteSpeed quirk, so the route and method can stay the same:
```ts
// frontend
api.patch(`/products/${p.id}/toggle`, { isActive: !p.isActive })
// backend
body('isActive').isBoolean().toBoolean(),
const target = req.body.isActive as boolean;
const { count } = await tx.product.updateMany({
  where: { id, organizationId: 1, deletedAt: null, isActive: !target },
  data: { isActive: target },
});
// count === 0 → re-read: if the row exists (not deleted) and isActive === target, return 200 with it
// (idempotent, no audit row). Return 404 only if it is actually missing or deleted.
```

## Warnings

### WR-01: PATCH /:id skips the race guard and can edit a product that was deleted concurrently

**File:** `packages/backend/src/routes/products.ts:180-218`
**Issue:** The `before` read runs outside the transaction. The write is `tx.product.update({ where: { id, organizationId: 1 } })`, with no `deletedAt: null` predicate and no count check. If another user deletes the product between the pre-read and the update, the update still succeeds on the deleted row. It writes `name`/`price` audit rows against a deleted product and returns 200. The plan's own contract says PATCH on a deleted product returns 404. The project memory `project_prisma_updatemany_race_guard` says to use `updateMany` + count instead of a combined-where `update()` for this kind of guard, and toggle and delete in this same file already do that. Because the pre-read is outside the transaction, the audit `oldValue` can also be stale under concurrent edits (accepted as T-14-08). Moving the read into the transaction reduces that at no extra cost.
**Fix:**
```ts
const result = await prisma.$transaction(async (tx) => {
  const before = await tx.product.findFirst({ where: { id, organizationId: 1, deletedAt: null } });
  if (!before) return null;
  // (dup-name check can stay outside, using `before` from a first read, or move in here)
  const { count } = await tx.product.updateMany({ where: { id, organizationId: 1, deletedAt: null }, data });
  if (count === 0) return null;
  const updated = await tx.product.findUniqueOrThrow({ where: { id } });
  /* audit rows as today */
  return updated;
});
if (!result) { res.status(404).json({ error: 'PRODUCT_NOT_FOUND' }); return; }
```

### WR-02: A 404 from losing a race leaves the user stuck on stale data

**File:** `packages/frontend/src/components/catalog/ProductDeleteConfirmDialog.tsx:18-26`; `packages/frontend/src/pages/ProductsPage.tsx:46`; `packages/frontend/src/components/catalog/ProductModal.tsx:43-64`
**Issue:** The backend now returns 404 on purpose to race losers (delete-after-delete, toggle-after-delete, edit-after-delete). None of the three frontend mutations handles it:
- Delete dialog: shows "Failed to delete product. Please try again." and does not invalidate `['products']`. Every retry returns 404 again, until the user cancels and refocuses the window.
- Toggle: `onError` only clears the pending id. The user sees nothing, and the row keeps its stale state.
- Modal: shows the generic "Something went wrong", and the list stays stale.

With several actors editing the catalog at once, these paths are now likely.
**Fix:** In each `onError`, when `axios.isAxiosError(err) && err.response?.status === 404`, invalidate `['products']` and `['catalog-products']`. Then close the dialog, or show "This product was already deleted/changed by someone else." Show a visible error for toggle failures as well.

### WR-03: The end-to-end check leaves test data and a known-password moderator behind when it fails

**File:** `packages/backend/src/routes/products.check.ts:27-216`
**Issue:** Cleanup (soft-deleting products and deleting the moderator) runs only if every assertion passes. Any failed assertion leaves behind:
- a live moderator account with the hardcoded password `p14-check-pass`
- up to four `P14 ...` products
- a `prisma.product.create` legacy duplicate

All of these stay in the shared dev DB. The script also never disconnects Prisma when it fails. That makes the check non-hermetic, and it leaves a known credential behind wherever it is run.
**Fix:** Wrap the body after setup in `try { ... } finally { /* delete created products and the moderator if their ids are set; await prisma.$disconnect() */ }`.

## Info

### IN-01: Audit rows take organizationId from the session, while the product write hardcodes 1

**File:** `packages/backend/src/routes/products.ts:47` vs `68, 86, 126, 180, 200, 243, 257, 312`
**Issue:** `productAudit` uses `req.session.organizationId!`, but every product query and write uses `organizationId: 1`. With a single org the two always match. If a session's org is ever not 1, the product change and its audit row end up in different tenants, which undercuts Rule 5.
**Fix:** Use `req.session.organizationId!` for the product queries too, or the literal `1` in the audit row. Whichever you choose, use one source.

### IN-02: The duplicate-name check runs outside the transaction (TOCTOU)

**File:** `packages/backend/src/routes/products.ts:115-121, 189-198`
**Issue:** Two concurrent creates or renames to the same name both pass `nameTaken` and both commit. This was accepted as T-14-05 (D-09 says this is app-level validation). I list it so the ceiling stays visible. Moving `nameTaken` inside the transaction does not fix it under REPEATABLE READ without a lock.
**Fix:** Keep as accepted, or add a `ponytail:` note next to `nameTaken` naming the ceiling (for example, a generated `lower(name)` column plus a partial unique index if duplicates ever matter).

### IN-03: The modal treats any 409 as a duplicate name

**File:** `packages/frontend/src/components/catalog/ProductModal.tsx:34-38, 69`
**Issue:** `onNameConflict` and `isNameConflict` check only `status === 409` and ignore `error === 'DUPLICATE_PRODUCT_NAME'`. If any other 409 is added to these endpoints later, it would be mislabeled "A product with this name already exists," and the generic error would be hidden.
**Fix:** Also check `err.response?.data?.error === 'DUPLICATE_PRODUCT_NAME'`.

---

_Reviewed: 2026-09-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
