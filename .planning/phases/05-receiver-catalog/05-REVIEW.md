---
phase: 05-receiver-catalog
reviewed: 2026-06-26T10:30:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - packages/backend/prisma/schema.prisma
  - packages/backend/prisma/migrations/20260626091954_add-receiver-catalog/migration.sql
  - packages/shared/src/types/receiver.ts
  - packages/shared/src/types/sale.ts
  - packages/shared/src/types/index.ts
  - packages/backend/src/lib/prisma.ts
  - packages/backend/src/routes/receivers.ts
  - packages/backend/src/routes/catalog.ts
  - packages/backend/src/app.ts
  - packages/backend/src/routes/sales.ts
  - packages/frontend/src/pages/ReceiversPage.tsx
  - packages/frontend/src/components/catalog/ReceiverModal.tsx
  - packages/frontend/src/router/index.tsx
  - packages/frontend/src/layouts/AuthenticatedLayout.tsx
  - packages/frontend/src/components/sales/AddRowForm.tsx
  - packages/frontend/src/components/sales/EditableCell.tsx
  - packages/frontend/src/components/sales/SalesTable.tsx
  - packages/frontend/src/components/admin/AdminSalesTable.tsx
findings:
  critical: 0
  warning: 0
  info: 4
  total: 4
status: issues_found
---

# Phase 05: Code Review Report (Iteration 2)

**Reviewed:** 2026-06-26T10:30:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

This is the second iteration of the auto code-review loop. The previous WR-01 finding — the `PATCH /api/receivers/:id` edit endpoint calling `prisma.receiver.update` without first confirming the receiver exists and belongs to the session org — was correctly resolved. The fix adds a `findFirst` with `isActive: undefined` before the update (matching the pattern already used by the toggle endpoint), returns an explicit `404 RECEIVER_NOT_FOUND` on miss, and the subsequent `update` retains `organizationId` in the `where` clause as a defence-in-depth layer. No regressions were introduced by the fix.

All architecture rules remain respected across the reviewed files: RBAC is enforced at the backend on every route, soft-delete is correctly implemented for the Receiver model, org-isolation (`organizationId`) is present on every receiver query and every sale mutation, `receiverNameSnapshot` is copied atomically at sale creation, price snapshots use `toFixed(2)` serialization, audit logs are written in the same Prisma transaction as each sale mutation, and pessimistic UI updates are in place throughout.

The four info-level items identified in iteration 1 were not addressed and remain unchanged.

## Info

### IN-01: Soft-delete extension does not cover `receiver.findFirst`; toggle comment is misleading

**File:** `packages/backend/src/lib/prisma.ts:59-65` / `packages/backend/src/routes/receivers.ts:128-131`

**Issue:** The `$extends softDeleteFilter` extension wraps `receiver.findMany` but not `receiver.findFirst`. The comment on the toggle endpoint's `findFirst` call reads "bypassing $extends default (isActive: undefined = no filter)", but there is no `findFirst` default to bypass — it was never overridden. The `isActive: undefined` in the where clause is a harmless no-op. Code behaviour is correct, but the comment misrepresents the mechanism and creates a subtle footgun: a future author adding a `prisma.receiver.findFirst` call without an explicit `isActive` filter would believe the extension guards them, when it does not.

**Fix:** Either extend `receiver.findFirst` to match the `sale` model pattern (and update the toggle comment to accurately describe the bypass), or replace the misleading comment with a factual one:

```typescript
// receiver.findFirst is NOT extended — no default isActive filter is applied.
// isActive: undefined is passed here to be explicit about intent (find all, active or not).
const current = await prisma.receiver.findFirst({
  where: { id, organizationId: req.session.organizationId!, isActive: undefined },
```

---

### IN-02: Migration has no guard for sales rows with a NULL or empty `receiver` column

**File:** `packages/backend/prisma/migrations/20260626091954_add-receiver-catalog/migration.sql:31-47`

**Issue:** Step 2 inserts distinct receivers only for rows `WHERE receiver IS NOT NULL AND receiver != ''`. Step 3 back-fills `receiverId` via a JOIN on `s.receiver = r.name` — rows with a NULL or empty `receiver` value do not match any inserted receiver, leaving their `receiverId` as NULL. Step 5 (`MODIFY COLUMN receiverId INTEGER NOT NULL`) will fail with a MySQL constraint violation if any such rows exist. For a project where receiver has always been required at sale creation this is not a runtime risk. However the migration does not assert this assumption, so it would silently break on any database that has stale or improperly seeded data.

**Fix:** Add a pre-Step 5 assertion comment documenting the precondition, or a manual verification query to run before applying the migration:

```sql
-- Precondition check: run this before Step 5.
-- If this returns any rows, resolve them manually before continuing.
SELECT id, organizationId, receiver FROM `sales`
WHERE `receiverId` IS NULL;
```

---

### IN-03: `catalog.ts` omits the `!` non-null assertion on `organizationId` for `/products` and `/mops`

**File:** `packages/backend/src/routes/catalog.ts:11,21`

**Issue:** The Phase 5 `/receivers` endpoint was written with `req.session.organizationId!` (line 32), but the pre-existing `/products` and `/mops` endpoints use `req.session.organizationId` without `!` (lines 11 and 21). While `!` provides no runtime protection, Prisma treats an `undefined` value in a `where` clause as "no filter" — meaning a session without `organizationId` populated would return data across all organizations. The new `/receivers` endpoint is correctly written. The inconsistency within the same file creates a latent cross-org data leak risk and produces TypeScript strict-mode warnings.

**Fix:**

```typescript
// catalog.ts — add ! to match the /receivers pattern
// Line 11
where: { organizationId: req.session.organizationId! },

// Line 21
where: { organizationId: req.session.organizationId! },
```

---

### IN-04: `SalesTable.tsx` `handleSaveSuccess` `useCallback` has an empty dependency array

**File:** `packages/frontend/src/components/sales/SalesTable.tsx:132-135`

**Issue:**

```typescript
const handleSaveSuccess = useCallback(
  () => virtualizer.scrollToIndex(0, { align: 'start' }),
  []  // virtualizer is captured but not declared as a dependency
);
```

`virtualizer` is captured from the enclosing scope but omitted from the dep array. In practice this is safe because `useVirtualizer` returns the same stable instance across renders. However, the exhaustive-deps lint rule flags this, and the empty array pattern applied elsewhere to genuinely changing values would cause real stale-closure bugs.

**Fix:**

```typescript
const handleSaveSuccess = useCallback(
  () => virtualizer.scrollToIndex(0, { align: 'start' }),
  [virtualizer]
);
```

---

_Reviewed: 2026-06-26T10:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
