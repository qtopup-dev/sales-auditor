---
phase: 03-sales-core
fixed_at: 2026-06-23T22:00:00Z
review_path: .planning/phases/03-sales-core/03-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-06-23T22:00:00Z
**Source review:** .planning/phases/03-sales-core/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (3 Critical + 4 Warning)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: `mopId` PATCH does not refresh `mopNameSnapshot`

**Files modified:** `packages/backend/src/routes/sales.ts`
**Commit:** 103636b
**Applied fix:** Added a dedicated `else if (field === 'mopId')` branch in the PATCH handler that mirrors the `productId` special case. The new branch fetches the MOP from the database within the transaction (with `isActive: true` and org scoping), updates `mopId` + `mopNameSnapshot` atomically, and writes two audit log entries (`mopId` and `mopNameSnapshot`). The old `else` branch now only handles `receiver` and `notes` (neither are FK fields), and its `mopId` coercion path was removed.

---

### CR-02: `serializeAuditEntry` truncates BigInt IDs via `Number()`

**Files modified:** `packages/backend/src/routes/sales.ts`, `packages/shared/src/types/audit.ts`
**Commit:** 103636b (sales.ts serializer), b727c81 (shared type)
**Applied fix:** Changed `Number(entry.id)` to `String(entry.id)` in `serializeAuditEntry`. Updated the comment from "must convert to Number" to "must convert to String". Updated `AuditEntry.id` in the shared type from `number` to `string` with an updated comment explaining the CR-02 rationale. `key={entry.id}` in `AuditDrawer.tsx` accepts a string without change.

---

### CR-03: Hardcoded fallback session secret

**Files modified:** `packages/backend/src/app.ts`
**Commit:** 0640e18
**Applied fix:** Added a startup guard at the top of `createApp()` that reads `process.env.SESSION_SECRET` into a local const and throws `Error('SESSION_SECRET environment variable is required')` if it is absent or empty. The session middleware now uses `secret: sessionSecret` instead of `secret: process.env.SESSION_SECRET ?? 'change-me-in-production'`. The application will crash at boot rather than start with a forgeable HMAC secret.

---

### WR-01: `bcrypt.hash` runs inside a Prisma `$transaction`

**Files modified:** `packages/backend/src/routes/auth.ts`
**Commit:** c1e7320
**Applied fix:** Moved `bcrypt.hash(password, 12)` and the `const { username, password }` destructuring to before the `prisma.$transaction(...)` call. The transaction now only performs fast DB operations (findUnique, update, create), keeping connection hold time minimal. The `passwordHash` variable is in scope for `tx.user.create` as before.

---

### WR-02: `requireAuth` does not validate `organizationId`

**Files modified:** `packages/backend/src/middleware/requireAuth.ts`
**Commit:** c2074ef
**Applied fix:** Changed the condition from `if (!req.session.userId)` to `if (!req.session.userId || !req.session.organizationId)`. Added a comment explaining the failure mode: a session with `userId` but no `organizationId` would silently pass `undefined` to every `WHERE organizationId = ?` clause, matching zero rows rather than rejecting the request. The fix makes such sessions fail with 401 instead.

---

### WR-03: `AddRowForm` has two submit paths that can both fire on keyboard Enter

**Files modified:** `packages/frontend/src/components/sales/AddRowForm.tsx`
**Commit:** 8d852f2
**Applied fix:** Changed the Save Row button from `type="button"` with `onClick={handleSubmit(...)}` to `type="submit"` with no `onClick`. The form's `onSubmit={handleSubmit(...)}` is now the single submission path. The `disabled={isPending || !isFormValid}` guard prevents duplicate submissions during a pending mutation.

---

### WR-04: `priceSnapshot` cell applies `line-through` only for voided rows but `text-gray-400` always

**Files modified:** `packages/frontend/src/components/sales/SalesTable.tsx`
**Commit:** 36d30a7
**Applied fix:** Changed the ternary from `'line-through text-gray-400' : 'text-gray-400'` to `'line-through text-gray-400' : 'text-gray-900'`. Active sale rows now display the price in `text-gray-900` (matching other data columns), while voided rows retain `line-through text-gray-400`.

---

_Fixed: 2026-06-23T22:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
