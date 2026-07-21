---
phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
reviewed: 2026-07-21T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - packages/backend/src/routes/users.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-07-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Scoped re-review of `packages/backend/src/routes/users.ts` after the plan-09-07 gap-closure fix to the last-admin guard in `DELETE /api/users/:id`. The fix restricts the `FOR UPDATE` row-lock query to `isActive = true` admins and gates the guard on `target.role === 'admin' && target.isActive`. This review supersedes the prior 09-REVIEW.md (which reviewed the full phase, including this file's earlier CR-01 gap, before the fix).

**Last-admin guard correctness:** verified correct. Traced the concurrency scenario the guard is designed for — two concurrent `DELETE` requests targeting two *different* active admins in the same org, where those two are the only active admins. Both transactions lock the identical result set (`role='admin' AND deletedAt IS NULL AND isActive=true`, target row included, not excluded via SQL predicate). The first to acquire the lock proceeds and commits (setting `deletedAt`); the second blocks on `FOR UPDATE`, then re-evaluates its `SELECT` after the first commits, correctly no longer sees the now-deleted admin as "other," and throws `LAST_ADMIN`. Deactivated (`isActive: false`) admins are correctly excluded from the lock set and from the guard's applicability, matching the stated rationale (a deactivated admin cannot authenticate per `auth.ts`, so deleting one never reduces usable-admin count). Column names used in the raw SQL (`organizationId`, `role`, `deletedAt`, `isActive`) match the Prisma schema (no `@map` renames), and `organizationId` is server-derived from the session, not user input, so there is no injection risk.

**Race-safety of the `FOR UPDATE` lock:** verified sound — the target row is deliberately included in the locked set (not excluded via `id !=` predicate), which is what makes two concurrent transactions targeting different admins contend on the same rows rather than lock disjoint sets.

Two lower-severity issues were found: a narrow TOCTOU window when the *same* user is targeted by two concurrent `DELETE` requests, and a pre-existing (not introduced by this fix) race in the username-uniqueness check on `PATCH /:id/username`. Two informational notes are also included for awareness. No critical or security issues were found in this file.

## Warnings

### WR-01: Double-delete race on the same target can produce a misleading LAST_ADMIN error instead of idempotent success/404

**File:** `packages/backend/src/routes/users.ts:234-282`
**Issue:** The existence check (`tx.user.findFirst`, line 234) is a plain snapshot read, not a locking read. Under MySQL's default REPEATABLE READ isolation, two concurrent `DELETE /api/users/:id` requests for the *identical* admin id can both pass this check (both see `deletedAt: null`) before either transaction commits.

For an admin target, the second request then blocks on the `FOR UPDATE` query (line 262) until the first commits. After the first transaction sets `deletedAt` on the target row, the second transaction's `SELECT ... WHERE deletedAt IS NULL AND isActive = true` no longer returns the target row at all (it's now soft-deleted). If the target was the sole active admin, `admins` comes back empty, `otherAdmins` is also empty, and the second request throws `LAST_ADMIN` — a confusing/incorrect error for what is really "this user was already deleted a moment ago" (ideally a 404 or an idempotent 204).

For a non-admin target, there's no `FOR UPDATE` gate at all: both concurrent requests can pass the existence check and both execute the `deletedAt` update and the sessions-kill query, so a duplicate/double-click delete silently "succeeds" twice instead of the second returning 404.

This is a narrow, low-frequency race (requires near-simultaneous duplicate requests for the same id) and not exploitable as a security issue, but it produces incorrect status codes/error bodies for legitimate double-click or retry scenarios.

**Fix:** Make the existence check part of the same locking read, e.g. fold it into a raw `FOR UPDATE` query keyed on `id` so a concurrent duplicate delete sees the row's post-commit state consistently and can be short-circuited to a 404 before the last-admin guard runs:
```ts
const targetRow = await tx.$queryRaw<{ id: number; role: string; isActive: boolean }[]>`
  SELECT id, role, isActive FROM users
  WHERE id = ${targetId} AND organizationId = ${organizationId} AND deletedAt IS NULL
  FOR UPDATE
`;
if (targetRow.length === 0) {
  throw Object.assign(new Error('User not found'), { statusCode: 404, code: 'USER_NOT_FOUND' });
}
```

### WR-02: Username uniqueness check has a TOCTOU race that surfaces as an unhandled 500 instead of 409

**File:** `packages/backend/src/routes/users.ts:69-95`
**Issue:** `PATCH /:id/username` checks uniqueness via a plain `findFirst` (line 69) outside any transaction, then performs the `update` (line 82) separately. Two concurrent requests renaming different users to the same new username can both pass the uniqueness check before either commits. The second `update` will then violate the `@@unique([organizationId, username])` constraint and throw a Prisma `P2002` error, which is not caught here — it falls through to the generic error handler and returns `500 INTERNAL_ERROR` instead of the intended `409 USERNAME_TAKEN`.
**Fix:** Catch the Prisma unique-constraint error and map it to 409, or wrap the check+update in a transaction with a row lock:
```ts
try {
  const updated = await prisma.user.update({ /* ... */ });
  res.json(updated);
} catch (err) {
  if ((err as { code?: string }).code === 'P2002') {
    res.status(409).json({ error: 'USERNAME_TAKEN' });
    return;
  }
  throw err;
}
```

## Info

### IN-01: `target.isActive` branch in the last-admin guard currently guards an unreachable state

**File:** `packages/backend/src/routes/users.ts:261`
**Issue:** The guard's `target.isActive` gate (added by the PHASE9-SC5 fix) is only meaningful if a `User` row can have `isActive: false` while `deletedAt: null`. A repo-wide search found no route anywhere in `packages/backend/src` that ever sets `User.isActive = false` — only `deletedAt` is ever set (via this DELETE handler), and `canEdit`/`username` are the only other mutable fields exposed on users. So the "deactivated admin" scenario this fix defends against cannot currently occur through the API, meaning this branch is presently unverifiable by real traffic.
**Fix:** No code change required — this is legitimate forward-looking correctness (e.g., in case a future admin-deactivation endpoint is added). Consider adding a code comment noting that `isActive: false` on a `User` is not currently reachable via any endpoint, so a future reviewer doesn't assume it's exercised today, or add a unit/integration test that seeds `isActive: false` directly via Prisma to exercise this branch.

### IN-02: Comment claims `isActive: undefined` overrides the `$extends` default on `findFirst` calls, but the extension doesn't intercept `findFirst` for `user`

**File:** `packages/backend/src/routes/users.ts:68, 74, 170-171, 232-233`
**Issue:** Comments at these lines state `isActive: undefined` "overrides the $extends default" / "overrides $extends softDeleteFilter." However, `packages/backend/src/lib/prisma.ts` only intercepts `findMany` for the `user` model (lines 39-44) — `findFirst` is not extended at all. So on these `findFirst` calls, `isActive: undefined` is inert (Prisma already omits `undefined` keys from the query); there is no default being "overridden" because no default was ever applied to `findFirst` in the first place. The resulting behavior (no `isActive` filter) is correct, but the rationale in the comment is inaccurate and could mislead a future maintainer into believing `findFirst` is filtered by default elsewhere in the codebase.
**Fix:** Update the comments to clarify, e.g.: `// isActive intentionally omitted — findFirst is not covered by the $extends softDeleteFilter (only findMany is), so no isActive filter applies here regardless.`

---

_Reviewed: 2026-07-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
