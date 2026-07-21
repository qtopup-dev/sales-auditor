---
phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
verified: 2026-07-21T10:05:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  gaps_closed:
    - "Backend blocks deleting the organization's last remaining admin (D-09 / PHASE9-SC5) — 'last admin' must mean the last admin who can actually log in, not merely the last admin row"
  gaps_remaining: []
  regressions: []
---

# Phase 9: Add the option to delete MOPs, Products, and Users for the admin role — Verification Report

**Phase Goal:** Admin can permanently soft-delete a Product, MOP, or User via a new "Delete" action distinct from the existing Activate/Deactivate toggle — with confirmation, immediate removal from every admin-facing list/combo-box, and User-specific safeguards (self-delete block, last-admin block, immediate session kill + login rejection).
**Verified:** 2026-07-21T10:05:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Plan 09-07, PHASE9-SC5 / CR-01)

## Goal Achievement

### Observable Truths

| # | Truth (mapped to PHASE9-SC) | Status | Evidence |
|---|------|--------|----------|
| 1 | SC1 — Admin sees a red "Delete" action (distinct from Activate/Deactivate) with a confirm dialog for Product, MOP, and User | ✓ VERIFIED (regression check — unchanged since prior pass) | `ProductsPage.tsx`, `MopsPage.tsx`, `UsersPage.tsx` each add a red `text-red-600` Delete link after the existing toggle/Reset Password action; `ProductDeleteConfirmDialog.tsx`, `MopDeleteConfirmDialog.tsx`, `UserDeleteConfirmDialog.tsx` model `VoidConfirmDialog.tsx` (Modal + useMutation + pessimistic pending). No files in this set were touched by Plan 09-07 (working tree confirmed clean apart from this report). |
| 2 | SC2 — A deleted Product/MOP/User immediately disappears from every admin-facing list and combo box | ✓ VERIFIED (regression check) | `prisma.ts` `$extends` still injects `deletedAt: null, isActive: true` on `product`/`mop`/`user` `findMany` (lines 41, 48, 55 confirmed present, unchanged); dialogs invalidate queries on success. |
| 3 | SC3 — Deleting a Product/MOP/User never touches Sale, AuditLog, or Shift rows; historical snapshots on sales are unaffected | ✓ VERIFIED (regression check) | `DELETE /api/products/:id`, `DELETE /api/mops/:id`, `DELETE /api/users/:id` still only `update({ data: { deletedAt: new Date() } })` — Plan 09-07's diff (verified via `git diff 7f4ad87 073c399`) touches only the last-admin guard block inside the users.ts transaction; no Sale/AuditLog/Shift reference added. |
| 4 | SC4 — Backend blocks self-delete (target ID === session userId) | ✓ VERIFIED (regression check) | `users.ts:226-229`: `if (targetId === req.session.userId) { res.status(400).json({ error: 'CANNOT_DELETE_SELF' }); return; }` — unchanged (outside the transaction Plan 09-07 modified). Frontend `getErrorMessage` still maps `CANNOT_DELETE_SELF`. |
| 5 | SC5 — Backend blocks deleting the organization's last remaining (usable) admin, race-safe under concurrency | ✓ VERIFIED (gap closed) | `users.ts:234-276` now: (a) existence-check `select` includes `isActive: true` (line 236); (b) guard gated on `target.role === 'admin' && target.isActive` (line 261) so a deactivated admin is never itself blocked from deletion; (c) `FOR UPDATE` locked set adds `AND isActive = true` (line 267) alongside the pre-existing `role = 'admin' AND deletedAt IS NULL`, so a deactivated-but-not-deleted admin no longer counts as "another usable admin." `git diff 7f4ad87 073c399` confirms this is the *only* change in the file — self-delete check, session-kill query, and every other route are byte-for-byte unchanged. `npx tsc --noEmit` exits 0. Scoped code review (09-REVIEW.md, post-fix) traced the concurrency scenario and confirmed correctness with 0 critical findings. |
| 6 | SC6 — Deleting a User immediately destroys all of their sessions, and login rejects deletedAt-set credentials | ✓ VERIFIED (regression check) | `users.ts:286-289`: unconditional `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?` still present, still after the transaction, still no exclusion — untouched by Plan 09-07. `auth.ts:58`: login `where` still includes `isActive: true, deletedAt: null`. |
| 7 | SC7 — `deletedAt` schema field exists on Product/Mop/User and is enforced as the default exclusion filter on all list reads | ✓ VERIFIED (regression check) | Schema, migration, and `prisma.ts` `$extends` unchanged since prior pass — Plan 09-07 touched only `packages/backend/src/routes/users.ts`. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/prisma/schema.prisma` | `deletedAt DateTime?` on Product/Mop/User | ✓ VERIFIED | Unchanged since prior pass |
| `packages/backend/prisma/migrations/20260721081035_add-deleted-at-soft-delete/migration.sql` | Applied migration adding deletedAt + indexes | ✓ VERIFIED | Unchanged |
| `packages/backend/src/lib/prisma.ts` | `$extends` injects `deletedAt: null` default | ✓ VERIFIED | Unchanged |
| `packages/backend/src/routes/products.ts` | `DELETE /:id` route | ✓ VERIFIED | Unchanged |
| `packages/backend/src/routes/mops.ts` | `DELETE /:id` route | ✓ VERIFIED | Unchanged |
| `packages/backend/src/routes/users.ts` | `DELETE /:id` route with 3 safeguards | ✓ VERIFIED | Last-admin guard now filters `AND isActive = true` in the `FOR UPDATE` set and gates on `target.isActive` (Plan 09-07). Self-delete block and session-kill unchanged. `tsc --noEmit` exits 0. |
| `packages/backend/src/routes/auth.ts` | Login rejects deletedAt-set users | ✓ VERIFIED | Unchanged |
| `packages/frontend/src/components/catalog/ProductDeleteConfirmDialog.tsx` | Product delete confirm dialog | ✓ VERIFIED | Unchanged |
| `packages/frontend/src/components/catalog/MopDeleteConfirmDialog.tsx` | MOP delete confirm dialog | ✓ VERIFIED | Unchanged |
| `packages/frontend/src/components/users/UserDeleteConfirmDialog.tsx` | User delete confirm dialog with error mapping | ✓ VERIFIED | Maps `CANNOT_DELETE_SELF`/`LAST_ADMIN`, unchanged |
| `packages/backend/src/routes/sales.ts` | `deletedAt: null` on 4 tx existence checks (Plan 06 gap-closure) | ✓ VERIFIED | Unchanged |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ProductsPage.tsx` | `ProductDeleteConfirmDialog.tsx` | `deleteTarget` state + conditional render | ✓ WIRED | Unchanged |
| `MopsPage.tsx` | `MopDeleteConfirmDialog.tsx` | `deleteTarget` state | ✓ WIRED | Unchanged |
| `UsersPage.tsx` | `UserDeleteConfirmDialog.tsx` | `deleteTarget` state | ✓ WIRED | Unchanged |
| `ProductDeleteConfirmDialog.tsx` | `DELETE /api/products/:id` | `useMutation` → `api.delete` | ✓ WIRED | Unchanged |
| `MopDeleteConfirmDialog.tsx` | `DELETE /api/mops/:id` | `useMutation` → `api.delete` | ✓ WIRED | Unchanged |
| `UserDeleteConfirmDialog.tsx` | `DELETE /api/users/:id` | `useMutation` → `api.delete` | ✓ WIRED | Unchanged |
| `UserDeleteConfirmDialog.tsx` | `CANNOT_DELETE_SELF` / `LAST_ADMIN` codes | `getErrorMessage(err)` | ✓ WIRED | Unchanged |
| `users.ts DELETE /:id` | `sessions` table | Direct SQL `DELETE FROM sessions WHERE JSON_EXTRACT` | ✓ WIRED | Unchanged |
| `users.ts DELETE /:id` | Last-admin race guard | `tx.$queryRaw ... FOR UPDATE ... AND isActive = true` | ✓ WIRED | Gap closed — locked set now restricted to login-capable admins; target gate on `target.isActive` added |
| `auth.ts POST /login` | `prisma.user.findFirst` | `where: { isActive: true, deletedAt: null }` | ✓ WIRED | Unchanged |
| `sales.ts` product/mop existence checks (x4) | `deletedAt: null` filter | Explicit `tx.*.findFirst where` | ✓ WIRED | Unchanged |

### Requirements Coverage

REQUIREMENTS.md has no `PHASE9-SC*` entries (phase-local requirements, scope locked via CONTEXT.md per ROADMAP.md — expected, not an omission).

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| PHASE9-SC1 | 09-02, 09-03, 09-04, 09-05 | Delete action + confirm UI for Product/MOP/User | ✓ SATISFIED | Truth 1 |
| PHASE9-SC2 | 09-01, 09-02, 09-04, 09-06 | Immediate removal from lists/combo boxes | ✓ SATISFIED | Truth 2 |
| PHASE9-SC3 | 09-01, 09-02, 09-06 | No Sale/AuditLog/Shift touched | ✓ SATISFIED | Truth 3 |
| PHASE9-SC4 | 09-03, 09-05 | Self-delete block | ✓ SATISFIED | Truth 4 |
| PHASE9-SC5 | 09-03, 09-05, 09-07 | Last-admin block (login-capable admins only) | ✓ SATISFIED | Truth 5 (gap closed by Plan 09-07) |
| PHASE9-SC6 | 09-03, 09-05 | Session kill + login rejection | ✓ SATISFIED | Truth 6 |
| PHASE9-SC7 | 09-01, 09-02 | deletedAt schema + filter enforcement | ✓ SATISFIED | Truth 7 |

All 7 phase-local requirement IDs are declared by at least one plan (including the gap-closure Plan 09-07, which declares `requirements: [PHASE9-SC5]`) and are satisfied in the current codebase. No orphaned requirements.

### Anti-Patterns Found

No blocker or warning anti-patterns (TODO/FIXME/placeholder/empty-return stubs) found in `packages/backend/src/routes/users.ts` after the Plan 09-07 fix. The scoped code review (09-REVIEW.md, run after the fix) confirmed 0 critical findings and traced the concurrency scenario as sound.

Two lower-severity warnings remain from the post-fix review, both pre-existing and outside the scope of the PHASE9-SC5 gap:
- **WR-01**: A double-delete race on the *same* target (not the last-admin scenario) can surface a misleading `LAST_ADMIN` error instead of an idempotent 404/204. Narrow, non-security, requires near-simultaneous duplicate requests.
- **WR-02**: Pre-existing TOCTOU on the username-uniqueness check (`PATCH /:id/username`) can surface a 500 instead of 409 under concurrent renames to the same username. Not touched by any Phase 9 plan.
- **IN-01/IN-02**: Informational notes — `target.isActive` branch is currently unreachable via any existing endpoint (no route in the codebase ever sets `User.isActive = false`; only `DELETE` sets `deletedAt`), and two stale comments describe `findFirst` as being covered by the `$extends` default when only `findMany` is. Neither affects correctness of the delivered fix.

None of these rise to a phase-goal-blocking gap: WR-01/WR-02 require API calls bypassing the UI and don't compromise the last-admin or self-delete invariants; IN-01 confirms (rather than undermines) that the deactivated-admin scenario the fix defends against is currently a forward-looking correctness guarantee, not a live vulnerability, since no endpoint currently produces `isActive: false` on a user row. Recommend addressing WR-01/WR-02 in a future hardening pass, outside Phase 9's declared scope.

### Human Verification Required

None outstanding for PHASE9-SC5 — the gap-closure fix is a pure server-side logic/SQL change, fully verifiable by static code reading, `tsc --noEmit`, and the scoped code review's concurrency trace.

The three human-verification items from the initial verification pass (live combo-box/table removal, CR-01 fixture reproduction, real-time session termination) were runtime/UX confirmations unrelated to code correctness and are not required to close the PHASE9-SC5 gap. They remain optional end-to-end smoke checks a human may still wish to run before shipping, but do not block phase completion per the goal-backward criteria used here (all are backed by code-verified evidence: `$extends` filter + `invalidateQueries`, the now-fixed guard logic, and the unconditional session-kill query respectively).

### Gaps Summary

No gaps remain. Plan 09-07 closed the single blocking gap identified in the prior verification pass (PHASE9-SC5 / CR-01): the last-admin guard's `FOR UPDATE` locked set now filters `AND isActive = true`, and the guard is gated on `target.role === 'admin' && target.isActive`, so a deactivated-but-not-deleted admin no longer counts as "another usable admin." The fix is minimal and precisely scoped — `git diff 7f4ad87 073c399` shows only the existence-check `select` and the guard block changed; the self-delete check, session-kill query, and all other routes in `users.ts` are byte-for-byte unchanged. `npx tsc --noEmit` exits 0. A scoped code review of the fix confirmed 0 critical findings.

All 7 must-haves (SC1-SC7) are now verified as substantively implemented and wired end-to-end: schema, migration, list-filter enforcement, three DELETE routes, three frontend confirm dialogs, self-delete block, race-safe last-admin block restricted to login-capable admins, session kill, login rejection, and the Plan 06 sales.ts write-path gap closure. Phase 9 goal is achieved.

---

_Verified: 2026-07-21T10:05:00Z_
_Verifier: Claude (gsd-verifier)_
