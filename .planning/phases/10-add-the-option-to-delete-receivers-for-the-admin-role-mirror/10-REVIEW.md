---
phase: 10-add-the-option-to-delete-receivers-for-the-admin-role-mirror
reviewed: 2026-07-21T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - packages/backend/prisma/migrations/20260721131247_add-receiver-deleted-at/migration.sql
  - packages/backend/prisma/schema.prisma
  - packages/backend/src/lib/prisma.ts
  - packages/backend/src/routes/receivers.ts
  - packages/backend/src/routes/sales.ts
  - packages/frontend/src/components/catalog/ReceiverDeleteConfirmDialog.tsx
  - packages/frontend/src/pages/ReceiversPage.tsx
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-07-21
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 10 adds a `deletedAt` soft-delete signal to `Receiver`, mirroring Phase 9's Product/Mop/User pattern. The migration and schema changes are clean and consistent (index co-located with the FK filter pattern, no hard deletes, snapshot fields on `Sale` untouched). The `DELETE /api/receivers/:id` route correctly enforces `deletedAt: null` when checking existence, and the sales.ts gap fixes (`tx.receiver.findFirst` in POST and PATCH `receiverId` branch) correctly prevent new sales from referencing a deleted receiver — both mirror the established Product/Mop pattern exactly. Frontend delete confirmation dialog and shared type stay in sync (no `deletedAt` leak across the API boundary).

One functional gap was found: the existing `PATCH /api/receivers/:id` and `PATCH /api/receivers/:id/toggle` routes do not filter out soft-deleted rows, so an admin who already knows a deleted receiver's ID can still rename it or flip its `isActive` flag via a direct API call, contradicting the documented design ("once deleted, gone from every admin-facing surface") and the pattern the DELETE route itself follows. This is low-impact (admin-only, requires already knowing a deleted row's ID, and the row still never reappears in any list), but it is a real inconsistency worth closing while this code is still fresh, especially since it stems from an incorrect assumption about which Prisma methods the `$extends` soft-delete filter actually covers.

## Warnings

### WR-01: PATCH routes don't exclude soft-deleted receivers, unlike DELETE

**File:** `packages/backend/src/routes/receivers.ts:94-96` and `:129-132`

**Issue:** Both `PATCH /api/receivers/:id` (rename/edit) and `PATCH /api/receivers/:id/toggle` (activate/deactivate) look up the target row via:
```ts
const existing = await prisma.receiver.findFirst({
  where: { id, organizationId: req.session.organizationId!, isActive: undefined },
});
```
The inline comments ("bypassing $extends default", "no filter") imply this call is intercepted by the soft-delete `$extends` query extension the same way `findMany` is. It is not: in `packages/backend/src/lib/prisma.ts:60-65`, the `receiver` block only overrides `findMany` —
```ts
receiver: {
  findMany({ args, query }) {
    args.where = { isActive: true, deletedAt: null, ...args.where };
    return query(args);
  },
},
```
— there is no `findFirst` override. So `isActive: undefined` here has zero effect either way, and — critically — nothing filters on `deletedAt`. As a result, an admin who knows (or brute-forces) the numeric ID of an already soft-deleted receiver can still successfully rename it or toggle its active flag through these two endpoints, even though `DELETE /:id` (lines 165-173) explicitly adds `deletedAt: null` to its own existence check and treats an already-deleted row as 404 ("an already-deleted receiver is treated as not-found, consistent with 'once deleted, gone from every admin-facing surface'").

This can't be reached from the current UI (deleted receivers never appear in the `GET /` list, so there's no row to click), but it is reachable via a direct API call and is inconsistent with the stated invariant and with CLAUDE.md Rule 8 (soft-delete filter enforcement).

**Fix:** Add `deletedAt: null` explicitly to both `findFirst` where clauses, mirroring the DELETE route's own pattern:
```ts
// PATCH /:id
const existing = await prisma.receiver.findFirst({
  where: { id, organizationId: req.session.organizationId!, isActive: undefined, deletedAt: null },
});

// PATCH /:id/toggle
const current = await prisma.receiver.findFirst({
  where: { id, organizationId: req.session.organizationId!, isActive: undefined, deletedAt: null },
  select: { isActive: true },
});
```
Both already return `RECEIVER_NOT_FOUND` when the lookup misses, so no other code path changes are needed.

## Info

### IN-01: Comments overstate what the `$extends` soft-delete filter covers

**File:** `packages/backend/src/routes/receivers.ts:94-96, 128-131`

**Issue:** The inline comments at these two call sites ("Fetch current state bypassing $extends default (isActive: undefined = no filter)") describe `findFirst` as though it were covered by the same `$extends` query extension as `findMany`. It isn't (see WR-01) — `packages/backend/src/lib/prisma.ts` only intercepts `findMany` for `receiver`, `product`, `mop`, and `user`. This inaccurate framing is the likely root cause of the WR-01 gap, since it gives the impression `deletedAt` protection is already active by default.

**Fix:** Once WR-01 is fixed, update the comments to state plainly that `findFirst` is never covered by `$extends` for any model in this file, and that `deletedAt: null` (and any other soft-delete predicate) must always be written explicitly at each `findFirst`/`findUnique` call site.

### IN-02: Three near-identical branches in `PATCH /api/sales/:id` (productId / mopId / receiverId)

**File:** `packages/backend/src/routes/sales.ts:326-518`

**Issue:** The `productId`, `mopId`, and `receiverId` branches of the field-patch handler are structurally identical (lookup referenced entity with `isActive: true, deletedAt: null` → capture old snapshot values → update FK + snapshot column(s) → write matching audit entries), differing only in field names. The `receiverId` branch added in this phase is an explicit copy of the `mopId` branch (per its own comment, "Mirror the mopId special-case above"). This is intentional and consistent with existing precedent, but three parallel copies increase the chance that a future fix (e.g., another gap-fix like the `deletedAt: null` additions already made three times over) gets applied to one branch and missed in the others.

**Fix (optional, non-blocking):** Consider extracting a small shared helper, e.g. `updateFkWithSnapshot(tx, { saleId, field, idField, nameField, lookup, ...audit })`, that the three branches call with different table/field parameters. Not required for this phase, but worth considering before a fourth FK-with-snapshot field is added.

---

_Reviewed: 2026-07-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
