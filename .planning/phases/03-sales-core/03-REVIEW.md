---
phase: 03-sales-core
reviewed: 2026-06-23T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - packages/backend/src/middleware/requireAuth.ts
  - packages/backend/src/routes/auth.ts
  - packages/backend/src/routes/sales.ts
  - packages/backend/src/app.ts
  - packages/backend/prisma/schema.prisma
  - packages/frontend/src/stores/salesEditStore.ts
  - packages/frontend/src/components/sales/VoidConfirmDialog.tsx
  - packages/frontend/src/components/sales/SalesTable.tsx
  - packages/frontend/src/components/sales/AddRowForm.tsx
  - packages/frontend/src/components/sales/AuditDrawer.tsx
  - packages/frontend/src/components/sales/EditableCell.tsx
  - packages/frontend/src/pages/SalesPage.tsx
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the full sales-core implementation: backend routes (auth, sales), middleware, Prisma schema, and the five frontend sales components plus their Zustand store. The overall structure is solid — audit records are correctly written inside transactions, the ALLOWED_PATCH_FIELDS allowlist is in place, pessimistic UI is implemented, and `DECIMAL(10,2)` is used throughout.

Three critical issues were found. The most severe is a data-integrity bug: patching `mopId` does not refresh `mopNameSnapshot`, breaking snapshot consistency (the same atomic snapshot-refresh logic that exists for `productId` is missing for `mopId`). The second critical issue is that `BigInt` audit log IDs are serialized with `Number()`, which silently truncates values above 2^53-1, corrupting the audit feed. The third is a hardcoded fallback session secret that is a live security risk in any deployment that omits the env var.

Four warnings cover: bcrypt inside a DB transaction (holds connection under CPU load), incomplete organizationId validation in `requireAuth`, a double-submit path in `AddRowForm`, and the `priceSnapshot` column rendering the same gray color for both active and voided rows (UX regression for the strikethrough visual).

---

## Critical Issues

### CR-01: `mopId` PATCH does not refresh `mopNameSnapshot`

**File:** `packages/backend/src/routes/sales.ts:341-383`

**Issue:** When a moderator patches `mopId`, the handler falls into the generic `else` branch and updates only the FK column. The `mopNameSnapshot` denormalized field is left pointing to the old MOP name. This means the displayed MOP name in the table and in historical exports will be wrong until the row is re-read — and since snapshots are intentionally never re-joined, the stale snapshot is permanent. The `productId` path (lines 269-339) correctly refreshes both FK and snapshot in the same update; `mopId` needs the same treatment.

**Fix:**

```typescript
} else if (field === 'mopId') {
  // Mirror the productId special-case: refresh mopNameSnapshot atomically
  const newMop = await tx.mop.findFirst({
    where: {
      id: Number(rawValue),
      organizationId: req.session.organizationId!,
      isActive: true,
    },
  });
  if (!newMop) {
    throw Object.assign(new Error('MOP not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  const oldMopId = String(sale.mopId);
  const oldMopName = sale.mopNameSnapshot;

  const updated = await tx.sale.update({
    where: { id: saleId },
    data: {
      mopId: newMop.id,
      mopNameSnapshot: newMop.name,
      lastEditedById: req.session.userId!,
      lastEditedByUsername: req.session.username!,
    },
  });

  await tx.auditLog.createMany({
    data: [
      {
        organizationId: req.session.organizationId!,
        userId: req.session.userId!,
        userUsername: req.session.username!,
        saleId,
        tableName: 'sales',
        rowId: saleId,
        action: 'update',
        fieldName: 'mopId',
        oldValue: oldMopId,
        newValue: String(updated.mopId),
      },
      {
        organizationId: req.session.organizationId!,
        userId: req.session.userId!,
        userUsername: req.session.username!,
        saleId,
        tableName: 'sales',
        rowId: saleId,
        action: 'update',
        fieldName: 'mopNameSnapshot',
        oldValue: oldMopName,
        newValue: updated.mopNameSnapshot,
      },
    ],
  });

  return updated;
```

The existing `else` branch then handles only `receiver` and `notes` (neither of which are FK fields).

---

### CR-02: `serializeAuditEntry` truncates BigInt IDs via `Number()`

**File:** `packages/backend/src/routes/sales.ts:70`

**Issue:** `AuditLog.id` is defined as `BigInt` in the schema (`@id @default(autoincrement())`). The serializer calls `Number(entry.id)`, which is safe only while the row count stays below 2^53 (9,007,199,254,740,991). For an audit log that accumulates multiple entries per sale mutation this limit is far out, but `Number(bigint)` is categorically wrong — it silently loses precision rather than throwing. The correct serialization for JSON transport is `String()`.

**Fix:**

```typescript
// line 70 in serializeAuditEntry
id: String(entry.id),   // was: Number(entry.id)
```

Update the `AuditEntry` shared type accordingly so the frontend treats `id` as `string`. The `key={entry.id}` prop in `AuditDrawer.tsx:74` accepts a string without change.

---

### CR-03: Hardcoded fallback session secret

**File:** `packages/backend/src/app.ts:65`

**Issue:** The session is initialized with:

```typescript
secret: process.env.SESSION_SECRET ?? 'change-me-in-production',
```

If `SESSION_SECRET` is absent from the environment (misconfigured deploy, missing `.env` file, CI environment), the application starts normally with a well-known secret. An attacker who knows the fallback string can forge valid session cookies. Express-session uses the secret for HMAC signing of `connect.sid`.

**Fix:** Fail fast at startup if the secret is missing rather than silently falling back:

```typescript
// In createApp() or in the entry point before createApp() is called:
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error('SESSION_SECRET environment variable is required');
}

// Then in session():
secret: sessionSecret,
```

---

## Warnings

### WR-01: `bcrypt.hash` runs inside a Prisma `$transaction`

**File:** `packages/backend/src/routes/auth.ts:153-182`

**Issue:** The `POST /api/auth/invite/:token` handler calls `bcrypt.hash(password, 12)` at line 170 inside a `$transaction` block. Bcrypt with cost 12 takes ~100–300ms of CPU time. Prisma transactions hold a database connection open for their entire duration, and many MySQL connection pool implementations will time out the transaction after a configurable idle timeout. Under load, slow bcrypt inside a transaction can exhaust the connection pool. Additionally, if bcrypt throws (e.g., OOM), the error propagates inside the transaction scope unnecessarily.

**Fix:** Move `bcrypt.hash` before the `$transaction` call:

```typescript
authRouter.post('/invite/:token', registerValidation, async (req, res) => {
  // ...validation...
  const { username, password } = req.body as { username: string; password: string };
  // Hash BEFORE opening the transaction — keeps transaction as short as possible
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const invite = await tx.inviteToken.findUnique({ where: { tokenHash } });
    if (!invite || invite.usedAt !== null || invite.expiresAt < new Date()) {
      throw Object.assign(new Error('Invite link is invalid or has expired'), {
        statusCode: 400, code: 'INVITE_INVALID',
      });
    }
    await tx.inviteToken.update({ where: { tokenHash }, data: { usedAt: new Date() } });
    await tx.user.create({ data: { username, passwordHash, role: invite.role, organizationId: invite.organizationId } });
  });

  res.status(201).json({ ok: true });
});
```

---

### WR-02: `requireAuth` does not validate `organizationId`; routes use non-null assertion

**File:** `packages/backend/src/middleware/requireAuth.ts:19-24` / `packages/backend/src/routes/sales.ts` (multiple lines)

**Issue:** `requireAuth` checks only `req.session.userId`. All protected route handlers then reference `req.session.organizationId!` with a non-null assertion. If a session exists with a valid `userId` but without an `organizationId` (e.g., a session written by an older version of the code, a corrupted store entry, or a manually crafted session), every query that filters by `organizationId` will silently use `undefined`. In MySQL, `WHERE organization_id = undefined` compiles to `WHERE organization_id = NULL` which matches zero rows — this is data-invisible rather than exploitable, but it is a silent failure mode.

**Fix:** Extend `requireAuth` to also assert `organizationId`:

```typescript
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId || !req.session.organizationId) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  next();
}
```

---

### WR-03: `AddRowForm` has two submit paths that can both fire on keyboard Enter

**File:** `packages/frontend/src/components/sales/AddRowForm.tsx:76,196`

**Issue:** The `<form>` element has `onSubmit={handleSubmit(...)}` (line 76), and the "Save Row" button has a separate `onClick={handleSubmit(...)}` (line 196) with `type="button"`. Pressing Enter inside the `receiver` input triggers the form's `onSubmit`. Clicking "Save Row" triggers the button's `onClick`. Because both paths call `createMutation.mutate`, and `useMutation` does not deduplicate concurrent calls, a fast Enter key followed by a mouse click before the mutation resolves could submit the same row twice.

**Fix:** Remove the `onClick` from the Save Row button and change it to `type="submit"`. The form's `onSubmit` handler is sufficient. The `disabled={isPending}` guard then handles the in-flight case:

```tsx
<button
  type="submit"          // was: type="button" + onClick
  disabled={isPending || !isFormValid}
  className="..."
>
  {isPending ? 'Saving...' : 'Save Row'}
</button>
```

---

### WR-04: `priceSnapshot` cell applies `line-through` only for voided rows but `text-gray-400` always

**File:** `packages/frontend/src/components/sales/SalesTable.tsx:37-38`

**Issue:** The price cell class expression is:

```tsx
`block text-right text-sm font-normal ${sale.status === 'void' ? 'line-through text-gray-400' : 'text-gray-400'}`
```

Both branches produce `text-gray-400`, so the price appears dimmed even for active rows. The intent is presumably to use a darker color (e.g., `text-gray-900`) for active rows so only voided rows appear faded with strikethrough. This is visually inconsistent with the other columns where idle active cells display in `text-gray-900`.

**Fix:**

```tsx
`block text-right text-sm font-normal ${sale.status === 'void' ? 'line-through text-gray-400' : 'text-gray-900'}`
```

---

## Info

### IN-01: Hardcoded `organizationId: 1` in login and invite creation

**File:** `packages/backend/src/routes/auth.ts:47,115`

**Issue:** The login query includes `organizationId: 1` (line 47) and the invite creation hardcodes `organizationId: 1` (line 115). These are acknowledged v1 shortcuts (single-tenant), but they are not flagged with a `// TODO(multi-tenant)` comment, making them easy to overlook when adding organization support later. The invite route in particular hardcodes into the `inviteToken` record itself, so tokens created in v1 would need data migration.

**Fix:** Add explicit TODO comments:

```typescript
// TODO(multi-tenant): replace hardcoded organizationId: 1 with org resolution from subdomain/header
where: { username, isActive: true, organizationId: 1 },
```

---

### IN-02: `AuditDrawer` may briefly flash stale data from a previously viewed sale

**File:** `packages/frontend/src/components/sales/AuditDrawer.tsx:27-32`

**Issue:** React Query caches audit results by `['sales', openAuditSaleId, 'audit']`. When an admin closes the drawer for sale A and opens it for sale B, React Query may serve the stale cache for B (if B was previously opened) while re-fetching in the background. The user briefly sees old audit entries. For an audit trail this is misleading — even for a moment.

**Fix:** Pass `staleTime: 0` to force a fresh fetch on every open, or call `queryClient.removeQueries` on drawer close:

```typescript
const { data: entries = [], isLoading } = useQuery<AuditEntry[]>({
  queryKey: ['sales', openAuditSaleId, 'audit'],
  queryFn: () => api.get<AuditEntry[]>(`/sales/${openAuditSaleId}/audit`).then((r) => r.data),
  enabled: openAuditSaleId !== null,
  staleTime: 0,   // always re-fetch on open
});
```

---

### IN-03: `EditableCell` passes `String(sale[field])` as initial draft for `productId`/`mopId` select fields

**File:** `packages/frontend/src/components/sales/EditableCell.tsx:86`

**Issue:** `setActiveCell(sale.id, field, String(sale[field as keyof Sale] ?? ''))` sets `draftValue` to `"42"` (the numeric ID) when activating a `productId` or `mopId` cell. The `AsyncSelect` renders with `defaultInputValue={displayValue}` (the human-readable name), so the display is correct. However, `draftValue` holds the raw ID string for the lifetime of the select interaction. If `handleBlur` were ever called on a select cell (it currently is not, because selects fire `handleSelectChange` immediately), it would compare the ID string against itself and silently skip saving. This is not a current bug but is a latent trap if the select `onMenuClose` path is extended. Add a comment documenting why `draftValue` is unused for select fields, or set it to `displayValue` instead of the raw ID.

---

_Reviewed: 2026-06-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
