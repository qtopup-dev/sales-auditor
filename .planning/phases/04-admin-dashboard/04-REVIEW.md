---
phase: 04-admin-dashboard
reviewed: 2026-06-26T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - packages/backend/src/app.ts
  - packages/backend/src/routes/admin.ts
  - packages/backend/src/routes/users.ts
  - packages/frontend/src/components/admin/AdminSalesTable.tsx
  - packages/frontend/src/components/admin/SalesCharts.tsx
  - packages/frontend/src/components/admin/SalesFilterBar.tsx
  - packages/frontend/src/components/admin/StatCard.tsx
  - packages/frontend/src/components/sales/VoidConfirmDialog.tsx
  - packages/frontend/src/components/users/InviteModal.tsx
  - packages/frontend/src/components/users/ResetPasswordModal.tsx
  - packages/frontend/src/components/users/UserModal.tsx
  - packages/frontend/src/pages/DashboardPage.tsx
  - packages/frontend/src/pages/UsersPage.tsx
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-26
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 4 delivered the admin dashboard (`DashboardPage`, `UsersPage`) and supporting routes (`admin.ts`, `users.ts`). The overall structure is solid — `app.ts` is clean, the admin summary route correctly handles BigInt serialization and DECIMAL money strings, and the frontend components follow the project's pessimistic-UI and no-float-money rules faithfully.

One critical bug stands out: `users.ts` hardcodes `organizationId: 1` in three of its four endpoints, while the fourth (`PATCH /:id/username`) correctly reads from `req.session`. This inconsistency is a multi-tenant data isolation failure and the only blocker. The remaining findings are logic inconsistencies and missing UI feedback paths that should be addressed before shipping.

---

## Critical Issues

### CR-01: Hardcoded `organizationId: 1` breaks multi-tenant isolation in users.ts

**Files:**
- `packages/backend/src/routes/users.ts:22` (GET /api/users)
- `packages/backend/src/routes/users.ts:117` (PATCH /:id — canEdit toggle)
- `packages/backend/src/routes/users.ts:154` (POST /:id/reset-password — existence check)
- `packages/backend/src/routes/users.ts:168` (POST /:id/reset-password — update)

**Issue:** Three of the four endpoints in `users.ts` scope their Prisma queries to `organizationId: 1` (a literal). The fourth — `PATCH /:id/username` (line 65) — correctly reads from `req.session.organizationId!`. This means an admin authenticated into any organization other than org 1 will:
- See the full user list of org 1 (GET /api/users)
- Toggle `canEdit` on any user in org 1 (PATCH /:id)
- Reset passwords for any user in org 1 (POST /:id/reset-password)

This violates CLAUDE.md Rule 5 (organization_id on every business table for multi-tenant isolation) and is a cross-org privilege escalation path.

**Fix:** Replace the three literal `1` values with the session-sourced variable, matching the pattern already used in `PATCH /:id/username`:

```typescript
// GET /api/users — line 20
usersRouter.get('/', async (req, res) => {
  const organizationId = req.session.organizationId!;   // add this
  const users = await prisma.user.findMany({
    where: {
      organizationId,   // was: organizationId: 1
      isActive: undefined,
    },
    ...
  });
  ...
});

// PATCH /:id (canEdit) — line 115
const targetId = Number(req.params.id);
const organizationId = req.session.organizationId!;   // add this
const user = await prisma.user.update({
  where: { id: targetId, organizationId },   // was: organizationId: 1
  ...
});

// POST /:id/reset-password — line 150
const targetId = Number(req.params.id);
const organizationId = req.session.organizationId!;   // add this
const target = await prisma.user.findFirst({
  where: { id: targetId, organizationId, isActive: undefined },  // was: organizationId: 1
  ...
});
...
await prisma.user.update({
  where: { id: targetId, organizationId },   // was: organizationId: 1
  data: { passwordHash },
});
```

---

## Warnings

### WR-01: Product breakdown revenue includes voided sales — inconsistent with totalRevenue

**File:** `packages/backend/src/routes/admin.ts:42-46`

**Issue:** `totalRevenue` (line 37) filters `status: 'active'` to exclude voided amounts. But the `productBreakdown` groupBy (line 42) uses `status: { in: ['active', 'void'] }`, so `_sum.priceSnapshot` per product includes voided sale amounts. If a user mentally sums the per-product revenues displayed in the chart, the total will exceed `totalRevenue`. This is a data accuracy problem on the dashboard.

**Fix:** Apply the same `status: 'active'` filter to the `_sum` projection in productBreakdown. The count can remain over all statuses if showing "all sales by product" is intended:

```typescript
prisma.sale.groupBy({
  by: ['productNameSnapshot'],
  _count: { _all: true },
  _sum: { priceSnapshot: true },
  where: { organizationId, status: 'active' },   // was: { in: ['active', 'void'] }
  orderBy: { _count: { productNameSnapshot: 'desc' } },
}),
```

If keeping a count of all statuses per product is also desired, use two separate queries or add a separate `_count` with a `where` override via a raw query.

---

### WR-02: `navigator.clipboard.writeText()` not awaited — false "Copied!" feedback on failure

**Files:**
- `packages/frontend/src/components/users/InviteModal.tsx:20`
- `packages/frontend/src/components/users/ResetPasswordModal.tsx:19`

**Issue:** `navigator.clipboard.writeText()` is async and returns a Promise. Both handlers call it without `await`, so a clipboard permission denial or context error is silently swallowed. The handler immediately calls `setCopied(true)` regardless, showing "Copied!" to the user even though nothing was copied. This is particularly harmful in `ResetPasswordModal` — if the admin sees "Copied!" and closes the modal, the temp password is lost and a second reset is required.

**Fix:** Make the handler async and await the write, with a fallback error indication:

```typescript
// InviteModal.tsx (same pattern applies to ResetPasswordModal.tsx)
const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // clipboard unavailable or permission denied — do not show "Copied!"
    alert('Copy failed. Please select and copy the link manually.');
  }
};
```

---

### WR-03: UserModal silently swallows all non-409 backend errors

**File:** `packages/frontend/src/components/users/UserModal.tsx:45-50`

**Issue:** The `onError` handler only intercepts HTTP 409 (USERNAME_TAKEN) and surfaces it inline. All other failures — 400 validation errors (e.g., trimmed username is too short), 404 (user not found), 500 server errors — cause the mutation to fail with no visible feedback. The button re-enables, the form resets to `isPending = false`, and the user has no idea what went wrong.

**Fix:** Add a fallback error state and display it when the error is not a 409:

```typescript
const [genericError, setGenericError] = useState<string | null>(null);

const updateMutation = useMutation({
  mutationFn: ...,
  onSuccess: () => {
    setGenericError(null);
    queryClient.invalidateQueries({ queryKey: ['users'] });
    onClose();
  },
  onError: (err: unknown) => {
    if (axios.isAxiosError(err) && err.response?.status === 409) {
      setError('username', { message: 'Username already taken.' });
    } else {
      setGenericError('Failed to save username. Please try again.');
    }
  },
});

// In JSX, below the form:
{genericError && (
  <p className="text-sm text-red-600 mt-2">{genericError}</p>
)}
```

---

### WR-04: `PATCH /api/users/:id` does not verify target is a moderator before writing canEdit

**File:** `packages/backend/src/routes/users.ts:105-132`

**Issue:** CLAUDE.md Rule 9 states the backend must enforce RBAC. The comment on the route says "ROLES-02: toggle canEdit on/off for a moderator" but there is no check that the target user is a moderator. Any authenticated admin can send `PATCH /api/users/<admin_id>` with `{ canEdit: true }` and the field will be updated for the admin user. While `canEdit` on an admin may be ignored by other routes, it is unintended state that violates the stated invariant and RBAC rule.

**Fix:** Fetch the target user before updating, and reject if it is not a moderator:

```typescript
const targetId = Number(req.params.id);
const organizationId = req.session.organizationId!;

// RBAC: canEdit toggle is only valid for moderators (ROLES-02)
const target = await prisma.user.findFirst({
  where: { id: targetId, organizationId },
  select: { role: true },
});
if (!target) {
  res.status(404).json({ error: 'USER_NOT_FOUND' });
  return;
}
if (target.role !== 'moderator') {
  res.status(400).json({ error: 'INVALID_OPERATION', details: 'canEdit only applies to moderators' });
  return;
}
```

---

### WR-05: canEdit toggle failure in UsersPage has no user-visible error feedback

**File:** `packages/frontend/src/pages/UsersPage.tsx:71`

**Issue:** The `canEditMutation.onError` handler only calls `setPendingCanEditId(null)`. When the PATCH call fails (network error, 500, etc.), the toggle button silently re-enables with no indication to the user that the change did not take effect. The user may toggle again, unaware the first attempt failed.

**Fix:** Show an error alert or inline error state on mutation failure:

```typescript
onError: () => {
  setPendingCanEditId(null);
  alert('Failed to update edit rights. Please try again.');
},
```

If an inline toast or notification system exists, prefer that over `alert`.

---

## Info

### IN-01: setState call inside mutationFn — should be in onMutate

**File:** `packages/frontend/src/pages/UsersPage.tsx:63-65`

**Issue:** `setPendingCanEditId(userId)` is called inside `mutationFn` rather than `onMutate`. React Query's `mutationFn` is intended to be a pure async function. Side effects that update component state while the mutation is in-flight belong in `onMutate` (which runs synchronously before the fn). This works today but is non-idiomatic and could cause ordering surprises if the mutation is retried.

**Fix:**
```typescript
const canEditMutation = useMutation({
  onMutate: ({ userId }) => {
    setPendingCanEditId(userId);
  },
  mutationFn: ({ userId, canEdit }: { userId: number; canEdit: boolean }) =>
    api.patch<User>(`/users/${userId}`, { canEdit }).then((r) => r.data),
  ...
});
```

---

### IN-02: `csvExporting` state never triggers a re-render — "Exporting..." text is dead code

**File:** `packages/frontend/src/pages/DashboardPage.tsx:71-78`

**Issue:** `downloadCSV` is synchronous. In React 18, all state updates inside a single event handler are batched into one render. `setCsvExporting(true)` and `setCsvExporting(false)` both run before React flushes the batch, so the component always re-renders with `csvExporting = false`. The "Exporting..." button label is never shown.

**Fix:** Either remove the `csvExporting` state entirely (it adds no value for a synchronous operation), or if a visual indicator is desired, move the download into a `setTimeout` so the first render with `true` can flush first:

```typescript
// Option A: remove the dead state
const handleExportCSV = () => {
  downloadCSV(filteredRows);
};

// Option B: if the indicator is wanted for very large CSV generation
const handleExportCSV = () => {
  setCsvExporting(true);
  setTimeout(() => {
    try { downloadCSV(filteredRows); }
    finally { setCsvExporting(false); }
  }, 0);
};
```

---

### IN-03: VoidConfirmDialog text says "cannot be undone" — inaccurate for soft-delete architecture

**File:** `packages/frontend/src/components/sales/VoidConfirmDialog.tsx:51`

**Issue:** The dialog body reads "This action cannot be undone." However, the architecture uses soft-delete: voiding a sale sets `status = 'void'` but does not delete the row. An admin with DB access (or a future un-void endpoint) can reverse it. The phrasing is misleading and could cause user anxiety over recoverable mistakes.

**Fix:** Change the copy to reflect the actual outcome:

```typescript
<p className="text-sm font-normal text-gray-900">
  Are you sure you want to void this row? It will be marked as void and
  excluded from revenue totals, but the record will be kept.
</p>
```

---

_Reviewed: 2026-06-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
