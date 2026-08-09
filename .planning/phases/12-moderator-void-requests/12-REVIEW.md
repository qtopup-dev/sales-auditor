---
phase: 12-moderator-void-requests
reviewed: 2026-08-09T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - packages/backend/prisma/migrations/20260809102320_add-void-requests/migration.sql
  - packages/backend/prisma/schema.prisma
  - packages/backend/src/app.ts
  - packages/backend/src/routes/sales.ts
  - packages/backend/src/routes/voidRequests.ts
  - packages/frontend/src/components/admin/ApproveVoidRequestDialog.tsx
  - packages/frontend/src/components/admin/VoidRequestsTable.tsx
  - packages/frontend/src/components/sales/SalesTable.tsx
  - packages/frontend/src/components/sales/VoidRequestDialog.tsx
  - packages/frontend/src/layouts/AuthenticatedLayout.tsx
  - packages/frontend/src/pages/SalesPage.tsx
  - packages/frontend/src/pages/VoidRequestsPage.tsx
  - packages/frontend/src/router/index.tsx
  - packages/frontend/src/stores/salesEditStore.ts
  - packages/shared/src/types/index.ts
  - packages/shared/src/types/voidRequest.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-08-09
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the moderator Void Request workflow: migration, schema, the two backend routers
(`sales.ts` only gained an `export` on `serializeSale`; all new logic is in `voidRequests.ts`),
and the six new/touched frontend files. Cross-checked route handlers against the `git log`
for each file to confirm exactly what Phase 12 introduced vs. pre-existing code, so findings
below are scoped to genuinely new or newly-exposed behavior.

The transactional design (ownership guard, `pendingLock` DB-level race guard via generated
column + unique index, P2002 → 409 translation, in-same-transaction audit write on approve)
is well thought through and the code comments accurately explain most of the subtler
decisions. No critical/blocker-level defects were found — org-scoping, RBAC gating
(`requireRole`), and the soft-delete/status guards are all correctly applied on every new
endpoint. The issues below are concurrency-race and UX/validation-consistency gaps that
should be addressed but do not block on their own if the team accepts the documented risk.

## Warnings

### WR-01: Approve endpoint has no locking read — concurrent double-approve produces duplicate audit entries

**File:** `packages/backend/src/routes/voidRequests.ts:240-306`
**Issue:** The `PATCH /:id/approve` handler's own comment claims "Re-reads request as
status:'pending' and sale as status:'active' so a repeat approve is a 404, not a double-void
(T-12-09)." That guarantee holds only for *sequential* repeat calls (after the first
transaction has committed). It does not hold for two admins clicking Approve on the same
request at nearly the same instant: both transactions perform `tx.voidRequest.findFirst({
where: { status: 'pending' } })` and `tx.sale.findFirst({ where: { status: 'active' } })` as
non-locking snapshot reads under MySQL's default REPEATABLE READ isolation, so both can see
`pending`/`active` before either commits. Both then proceed to `tx.sale.update(...)` and
`tx.voidRequest.update(...)`, neither of which re-checks `status: 'pending'` in its `where`
clause. The result: two `AuditLog` "void" rows are written for a single sale event (violates
the audit-log integrity this app exists to provide), and `reviewedById`/`reviewedByUsername`
on the void request is silently overwritten by whichever transaction commits last — with no
error surfaced to either admin.
**Fix:** Add the `status: 'pending'` / `status: 'active'` guard directly into the `update`
`where` clauses (Prisma throws `P2025` if zero rows match, which the existing `NOT_FOUND`
error-shape convention already handles elsewhere in this file), instead of relying solely on
the earlier `findFirst`:
```ts
const updatedSale = await tx.sale.updateMany({
  where: { id: voidRequest.saleId, organizationId: req.session.organizationId!, status: 'active' },
  data: { status: 'void', lastEditedById: req.session.userId!, lastEditedByUsername: req.session.username! },
});
if (updatedSale.count === 0) {
  throw Object.assign(new Error('Sale not found'), { statusCode: 404, code: 'NOT_FOUND' });
}
// same pattern for tx.voidRequest.updateMany({ where: { id: requestId, status: 'pending' }, ... })
```
(or use a raw `SELECT ... FOR UPDATE` on the void request row before the checks). The same
gap exists in `PATCH /:id/reject` (`voidRequests.ts:330-360`), with lower impact since reject
never mutates the sale row — only `reviewedBy*`/`reviewedAt` can be double-written.

### WR-02: Frontend reason validation is weaker than backend, producing an unhelpful generic error on mismatch

**File:** `packages/frontend/src/components/sales/VoidRequestDialog.tsx:53-101`
**Issue:** The backend (`voidRequests.ts:73-79`) requires `reason` to be non-empty *after
trimming* and ≤2000 characters. The frontend only registers `{ required: 'Reason is
required' }` (`VoidRequestDialog.tsx:90`), which treats a whitespace-only string (e.g. a
single space) as valid, and has no `maxLength` guard at all. When either condition is
violated only server-side, the dialog's error branch only special-cases HTTP 409
(`isDuplicatePending`); any other failure — including the 400 `VALIDATION_ERROR` this
mismatch produces — falls through to the generic "Failed to submit void request. Please try
again." message, giving the moderator no indication that their input was rejected for being
empty/too long, so retrying with the exact same text will fail again in a loop.
**Fix:** Mirror the backend rule client-side (`validate: (v) => v.trim().length > 0 ||
'Reason is required'` and `maxLength: { value: 2000, message: 'Reason must be 2000
characters or fewer' }`), and/or branch the error message on `response?.status === 400` to
surface `error.details` from the API response.

### WR-03: `serializeSale`'s ownership/edit-rights model is documented inconsistently — flagged for clarity, not introduced by this phase

**File:** `packages/backend/src/routes/sales.ts:320-324`
**Issue:** Not a Phase 12 regression (confirmed via `git log`: this file's only Phase 12
change is exporting `serializeSale` for reuse by `voidRequestsRouter`) — noted here because
this file was in the review scope and the contradiction is directly adjacent to code the new
Void Request feature depends on. The route comment block above `PATCH /:id` says "ROLES-03/04/05:
owner-with-canEdit OR admin can edit" (implying row ownership matters), but the actual guard
two lines later is `const canMutate = requestingUser.canEdit || req.session.role ===
'admin';` with its own inline comment "Any user with canEdit=true (or admin) may edit any
active row" — i.e., ownership is *not* checked at all; any moderator with `canEdit=true` can
edit any other moderator's row. This is presumably intentional (per the `2e81f49 refactor:
open row editing to all canEdit users` commit), but the stale outer comment actively
misleads a reader into believing an ownership check exists, which matters here because the
new Void Request feature deliberately *does* enforce ownership (`voidRequests.ts:121`,
"D-01: ownership guard") — a reader comparing the two features side-by-side would reasonably
expect the same invariant on both.
**Fix:** Update the `PATCH /:id` comment header to say "any canEdit user (no ownership
check) OR admin can edit" so the two features' differing authorization models are not
conflated by a future maintainer.

### WR-04: VoidRequestsTable pagination does not reset when the current page empties out after Approve/Reject

**File:** `packages/frontend/src/components/admin/VoidRequestsTable.tsx:29-37, 227-233`
**Issue:** `pageIndex` is only ever reset to `0` from `handlePageSizeChange`. When an admin
is on the last page of a paginated Void Requests list and approves/rejects the only pending
request visible on that page, `rows` (driven by `['void-requests']` query invalidation)
shrinks, but `pageIndex` is never reset. If `pageIndex` now exceeds the new last-page index,
`getPaginationRowModel()` returns zero rows for that stale index and the table silently
renders with no visible rows — with `canPrev`/`canNext` still computed against the empty
page — until the admin manually clicks "Previous." This is confusing since nothing in the UI
explains why the table is empty (the `rows.length === 0` full-empty-state branch at
`VoidRequestsTable.tsx:239-246` only triggers when `rows` itself is empty, not when the
*current page* is empty).
**Fix:** Clamp `pageIndex` after data changes, e.g. via a `useEffect` that resets to the last
valid page: `useEffect(() => { const maxPage = Math.max(0, Math.ceil(rows.length /
effectivePageSize) - 1); if (pageIndex > maxPage) setPageIndex(maxPage); }, [rows.length]);`

## Info

### IN-01: Magic number `150` used to infer "unsized" columns

**File:** `packages/frontend/src/components/admin/VoidRequestsTable.tsx:259`
**Issue:** `style={{ width: header.column.getSize() !== 150 ? header.column.getSize() :
undefined }}` relies on knowing that TanStack Table's internal default column size is `150`
to detect the `notes`/`reason` columns (which only declare `minSize`, not `size`) and let
them flex instead of being pinned to a fixed pixel width. This works today but is a
non-obvious coupling to a third-party library's internal default that isn't named anywhere,
so a future TanStack Table major version bump (or someone adding an explicit `size: 150` to a
real column) would silently break the flex layout for that column with no compile-time or
runtime signal.
**Fix:** Extract the value to a named constant with a comment, e.g. `const
TANSTACK_DEFAULT_COLUMN_SIZE = 150; // @tanstack/react-table v8 internal default — see
column.getSize() docs`, or explicitly mark unsized columns via a lookup set (`['notes',
'reason'].includes(header.column.id)`) instead of inferring it from the size value.

### IN-02: `AuthenticatedLayout`'s pending-count badge silently treats fetch errors identically to zero

**File:** `packages/frontend/src/layouts/AuthenticatedLayout.tsx:42-46`
**Issue:** The comment explicitly documents this as intentional ("Error state is left
unhandled so a failed fetch leaves pendingCount undefined, which the render guard below
treats identically to zero"), so this is not a defect, but it is worth surfacing: an admin
whose `/void-requests/pending-count` request fails (network blip, 5xx) gets no visual signal
that the badge may be stale/wrong, and — because React Query does not retry indefinitely by
default and there's no `refetchInterval` — the badge can stay silently absent for the rest of
the session (until next full navigation/mount) even if pending requests do exist.
**Fix (optional):** Consider a subtle fallback (e.g., render a `?` badge on `isError`) if
false negatives on this indicator are considered a workflow risk; otherwise no action needed.

---

_Reviewed: 2026-08-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
