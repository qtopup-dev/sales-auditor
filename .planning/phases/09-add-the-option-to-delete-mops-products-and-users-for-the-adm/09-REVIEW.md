---
phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
reviewed: 2026-07-21T12:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - packages/backend/prisma/schema.prisma
  - packages/backend/prisma/migrations/20260721081035_add-deleted-at-soft-delete/migration.sql
  - packages/backend/src/lib/prisma.ts
  - packages/backend/src/routes/products.ts
  - packages/backend/src/routes/mops.ts
  - packages/backend/src/routes/users.ts
  - packages/backend/src/routes/auth.ts
  - packages/backend/src/routes/sales.ts
  - packages/frontend/src/components/catalog/ProductDeleteConfirmDialog.tsx
  - packages/frontend/src/components/catalog/MopDeleteConfirmDialog.tsx
  - packages/frontend/src/pages/ProductsPage.tsx
  - packages/frontend/src/pages/MopsPage.tsx
  - packages/frontend/src/components/users/UserDeleteConfirmDialog.tsx
  - packages/frontend/src/pages/UsersPage.tsx
findings:
  critical: 1
  warning: 6
  info: 2
  total: 9
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-07-21T12:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

The new DELETE endpoints themselves (`DELETE /api/products/:id`, `DELETE /api/mops/:id`, `DELETE /api/users/:id`) are well built: they correctly set `deletedAt` instead of hard-deleting, correctly re-check `deletedAt: null` before allowing the delete (treating an already-deleted row as 404), correctly block self-delete using the server-side session, and correctly kill all of the deleted user's sessions via a direct SQL `DELETE FROM sessions`.

However, the race-safe "last admin" guard has a real gap (it ignores `isActive`, so an org can be left with zero admins who can actually log in), and the `deletedAt` column added by this phase was not propagated to several pre-existing sibling endpoints (toggle, PATCH-edit, reset-password, canEdit-toggle, username-uniqueness, and `GET /auth/me`), which still operate on soft-deleted rows as if they were live. None of these are exploitable through the current UI (the list endpoints correctly hide deleted rows), but they are reachable via direct API calls and violate the "once deleted, gone from every admin-facing surface" guarantee the DELETE routes themselves document. The frontend dialogs and pages are straightforward and did not turn up issues.

## Critical Issues

### CR-01: Last-admin guard does not check `isActive`, so an org can end up with zero admins able to log in

**File:** `packages/backend/src/routes/users.ts:254-260`
**Issue:** The race-safe last-admin lock only filters on `deletedAt IS NULL`:
```sql
SELECT id FROM users
WHERE organizationId = ${organizationId}
  AND role = 'admin'
  AND deletedAt IS NULL
FOR UPDATE
```
It does not filter on `isActive = true`. If an organization has two admins — one active, one deactivated (`isActive: false`) but not deleted — deleting the active admin passes the "other admin exists" check (the deactivated admin counts as "other"), even though a deactivated admin cannot log in (`auth.ts` login requires `isActive: true`). The result is an organization with zero admins who can actually authenticate, and no UI path to recover (only an admin can promote/reactivate/delete other users). This directly undermines the purpose of the last-admin safeguard this phase was built to add.
**Fix:**
```sql
SELECT id FROM users
WHERE organizationId = ${organizationId}
  AND role = 'admin'
  AND deletedAt IS NULL
  AND isActive = true
FOR UPDATE
```
Also consider whether the target itself being inactive should still count toward "does at least one other *usable* admin remain" — the safeguard's intent is "at least one admin who can log in must remain," not merely "at least one admin row must remain."

## Warnings

### WR-01: Password-reset endpoint does not exclude soft-deleted users

**File:** `packages/backend/src/routes/users.ts:170-173`
**Issue:** `POST /api/users/:id/reset-password` looks up the target with `isActive: undefined` (intentionally bypassing the active filter) but no `deletedAt: null`:
```ts
const target = await prisma.user.findFirst({
  where: { id: targetId, organizationId: orgId, isActive: undefined },
  select: { id: true },
});
```
`findFirst` is not covered by the `$extends` soft-delete filter (only `findMany` is, per `prisma.ts`), so a deleted user's password can still be reset, a new hash written, and their sessions torn down again — all no-ops that should instead return `USER_NOT_FOUND`, consistent with the DELETE route's own "deleted = not-found" semantics.
**Fix:**
```ts
const target = await prisma.user.findFirst({
  where: { id: targetId, organizationId: orgId, isActive: undefined, deletedAt: null },
  select: { id: true },
});
```

### WR-02: Toggle endpoints for products/mops don't filter `deletedAt`

**File:** `packages/backend/src/routes/products.ts:138-141`, `packages/backend/src/routes/mops.ts:104-107`
**Issue:** Both `PATCH /:id/toggle` handlers fetch the current row via `findFirst` with `isActive: undefined` but no `deletedAt: null`:
```ts
const current = await prisma.product.findFirst({
  where: { id, organizationId: 1, isActive: undefined },
  select: { isActive: true },
});
```
This lets a soft-deleted product/MOP be toggled active/inactive and return `200 OK` instead of `404`. It does not resurrect the row in list views (the `$extends` default `deletedAt: null` on `findMany` still applies there), but it is an inconsistent, unintended surface for mutating a "deleted" resource.
**Fix:** Add `deletedAt: null` to both lookups, matching the pattern already used in the DELETE routes:
```ts
where: { id, organizationId: 1, isActive: undefined, deletedAt: null },
```

### WR-03: PATCH edit endpoints for products/mops allow editing deleted rows

**File:** `packages/backend/src/routes/products.ts:94-118`, `packages/backend/src/routes/mops.ts:67-85`
**Issue:** `PATCH /api/products/:id` and `PATCH /api/mops/:id` call `prisma.product.update(...)` / `prisma.mop.update(...)` directly with no prior existence check at all (no `deletedAt`, no `isActive` check). Because a soft-deleted row still physically exists, the `update` succeeds silently — an admin (or anyone able to guess/replay a stale ID) can still rename or reprice a product that has already been "irreversibly" deleted from the catalog.
**Fix:** Add an existence check before the update (mirroring the toggle/delete routes), e.g.:
```ts
const existing = await prisma.product.findFirst({
  where: { id, organizationId: 1, isActive: undefined, deletedAt: null },
  select: { id: true },
});
if (!existing) {
  res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
  return;
}
```

### WR-04: `users.ts` username-edit and canEdit-toggle endpoints don't filter `deletedAt`

**File:** `packages/backend/src/routes/users.ts:69-76, 119-122`
**Issue:**
- The username-uniqueness conflict check (lines 69-76) and the subsequent `update` (lines 82-96) don't check `deletedAt`, so a deleted user's username can still be changed via `PATCH /:id/username`.
- The `canEdit` toggle's target lookup (lines 119-122) has no `isActive`/`deletedAt` filter at all:
```ts
const target = await prisma.user.findFirst({
  where: { id: targetId, organizationId },
  select: { role: true },
});
```
A deleted (or deactivated) user's `canEdit` flag can be silently toggled. Not independently dangerous (a deleted user cannot log in regardless), but inconsistent with the "deleted is gone" contract and confusing if ever surfaced.
**Fix:** Add `deletedAt: null` (and consider `isActive: true` for the canEdit toggle, since toggling edit rights on an inactive user is meaningless) to both lookups, and return `USER_NOT_FOUND` when absent.

### WR-05: `GET /api/auth/me` doesn't verify `deletedAt`; relies entirely on session-kill succeeding

**File:** `packages/backend/src/routes/auth.ts:103-112`
**Issue:**
```ts
const user = await prisma.user.findUnique({
  where: { id: req.session.userId },
  select: { id: true, username: true, role: true, canEdit: true, organizationId: true, isActive: true },
});
if (!user || !user.isActive) {
  res.status(401).json({ error: 'UNAUTHORIZED' });
  return;
}
```
`isActive` is checked but `deletedAt` is neither selected nor checked. Normally this is masked because `DELETE /api/users/:id` (`users.ts:277-280`) unconditionally destroys the deleted user's sessions right after the transaction commits — but that `sessionPool.query` call is not inside the transaction, has no retry/catch, and runs after the `deletedAt` write is already durable. If it throws (e.g., transient error reaching the session-store DB), the deleted user's existing session remains valid, and `GET /api/auth/me` — the sole rehydration/authorization check on page load — has no independent `deletedAt` check to catch it. The same gap exists for the reset-password route's session kill.
**Fix:** Select and check `deletedAt` here as well, matching the login handler's guard:
```ts
select: { id: true, username: true, role: true, canEdit: true, organizationId: true, isActive: true, deletedAt: true },
...
if (!user || !user.isActive || user.deletedAt !== null) {
  res.status(401).json({ error: 'UNAUTHORIZED' });
  return;
}
```
This makes deletion terminate access even if the best-effort session-store cleanup fails.

### WR-06: Deleted usernames permanently block reuse; invite consumption has no pre-check

**File:** `packages/backend/prisma/schema.prisma:70`, `packages/backend/src/routes/auth.ts:218-225`
**Issue:** `@@unique([organizationId, username])` is not soft-delete-aware — a deleted user's row still occupies the unique slot forever, so their username can never be reused for a new invited/renamed account in that org. This is consistent with how `PATCH /:id/username`'s conflict check (`users.ts:69-76`) already treats it, but it likely was not an intended permanent effect of "delete." Compounding this, `POST /api/auth/invite/:token` (invite consumption) does no uniqueness pre-check before `tx.user.create(...)`:
```ts
await tx.user.create({
  data: { username, passwordHash, role: invite.role, organizationId: invite.organizationId },
});
```
If the invited username collides with any existing row (active, inactive, or deleted), this throws a raw Prisma `P2002` unique-constraint error instead of a clean `USERNAME_TAKEN` validation response.
**Fix:** Decide and document the intended behavior: either (a) accept that deleted usernames are permanently retired (in which case add a friendly pre-check + `P2002` handler in the invite-consumption route so it degrades to a clean 409 instead of a raw DB error), or (b) make the constraint soft-delete-aware, e.g. drop the DB-level unique constraint and enforce uniqueness only against `deletedAt: null` rows in application code (with a transaction to close the TOCTOU window).

## Info

### IN-01: Hardcoded `organizationId: 1` in products.ts/mops.ts vs. session-derived org elsewhere

**File:** `packages/backend/src/routes/products.ts:39-194`, `packages/backend/src/routes/mops.ts:34-157`
**Issue:** Every route in `products.ts` and `mops.ts` — including the new `DELETE /:id` routes — hardcodes `organizationId: 1` rather than deriving it from `req.session.organizationId`, as `users.ts` and `sales.ts` correctly do. This predates Phase 9 (the existing GET/POST/PATCH routes already did this), so it's not a regression introduced here, but the new DELETE routes perpetuate the inconsistency and CLAUDE.md Rule 5 calls for `organization_id`-scoped enforcement "from day one."
**Fix:** Replace `organizationId: 1` with `req.session.organizationId!` throughout both files for consistency with `users.ts`/`sales.ts`, ahead of any multi-tenant rollout.

### IN-02: Duplicated delete-route logic between products.ts and mops.ts

**File:** `packages/backend/src/routes/products.ts:163-194`, `packages/backend/src/routes/mops.ts:129-157`
**Issue:** The `DELETE /:id` handlers in both files are structurally identical (fetch-with-`deletedAt:null`-check, then `update` setting `deletedAt: new Date()`), differing only in the Prisma model and error code. This duplication also means the WR-02/WR-03 gaps above had to be (and will need to be) fixed twice.
**Fix:** Consider extracting a small shared helper, e.g. `softDeleteRecord(model, id, organizationId, notFoundCode)`, used by both routers (and by the toggle/PATCH routes once WR-02/WR-03 are addressed) to keep the soft-delete semantics in one place.

---

_Reviewed: 2026-07-21T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
