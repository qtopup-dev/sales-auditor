# Phase 12: Moderator Void Requests - Pattern Map

**Mapped:** 2026-08-09
**Files analyzed:** 12
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/backend/prisma/schema.prisma` (VoidRequest model + VoidRequestStatus enum) | model | CRUD | `Sale`/`AuditLog` models (lines 152-214) | role-match |
| `packages/backend/src/routes/voidRequests.ts` (new router) | route | request-response/CRUD | `packages/backend/src/routes/sales.ts` (per-route `requireRole`, `/:id/void` transaction) | exact |
| `packages/backend/src/app.ts` (mount new router) | config | request-response | itself (existing mount block, lines 98-112) | exact |
| `packages/shared/src/types/voidRequest.ts` (new type) | model | CRUD | `packages/shared/src/types/shift.ts` | exact |
| `packages/shared/src/types/index.ts` (add export) | config | — | itself (lines 8-15) | exact |
| `packages/frontend/src/components/sales/VoidRequestDialog.tsx` (new, reason entry) | component | request-response | `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` + `packages/frontend/src/components/catalog/ProductModal.tsx` (textarea/form part) | role-match (composite) |
| `packages/frontend/src/components/sales/SalesTable.tsx` (add Void Request button) | component | request-response | itself (existing Void/Audit action buttons, lines 96-112) | exact |
| `packages/frontend/src/components/admin/VoidRequestsTable.tsx` (new) | component | CRUD | `packages/frontend/src/components/admin/AdminSalesTable.tsx` | exact |
| `packages/frontend/src/components/admin/ApproveVoidRequestDialog.tsx` (new) | component | request-response | `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` | exact |
| `packages/frontend/src/pages/VoidRequestsPage.tsx` (new) | component | CRUD | `packages/frontend/src/pages/SalesPage.tsx` / `packages/frontend/src/pages/ProductsPage.tsx` | role-match |
| `packages/frontend/src/layouts/AuthenticatedLayout.tsx` (add nav entry + badge) | component | request-response | itself (`ADMIN_NAV` array + `NavLink` render, lines 11-19, 76-89) | exact |
| `packages/frontend/src/router/index.tsx` (add `/void-requests` route) | route | — | itself (existing admin-only route block, lines 52-63) | exact |

## Pattern Assignments

### `packages/backend/prisma/schema.prisma` (model)

**Analog:** `Sale` + `AuditLog` models (`packages/backend/prisma/schema.prisma` lines 152-214)

Key conventions to copy:
- `organizationId Int` + `organization Organization @relation(...)` on every business table (CLAUDE.md Rule 5).
- Snapshot-style FK pattern: `saleId Int` + `sale Sale @relation(fields: [saleId], references: [id])` (mirrors `AuditLog.saleId`).
- `reason String @db.Text` — same column type as `Sale.notes`.
- New enum `VoidRequestStatus { pending approved rejected }` following the `SaleStatus`/`AuditAction` enum style (defined just above the model it's used in, PascalCase enum name, lowercase values).
- `requestedById Int` + `requestedBy User @relation(...)`, `requestedByUsername String @db.VarChar(100)` — mirrors `createdById`/`createdByUsername` on `Sale`.
- `reviewedById Int?` + `reviewedBy User? @relation(...)`, `reviewedAt DateTime?` — mirrors the nullable `lastEditedById`/`lastEditedByUsername` optional-reviewer pattern on `Sale`.
- `createdAt DateTime @default(now())` — no `updatedAt` needed unless useful; `AuditLog` has no `updatedAt` either (append/transition-only tables often skip it).
- Indexes: `@@index([organizationId, status])` (mirrors `Sale`'s status index — needed for the pending-count badge query and D-02's "one pending per sale" enforcement query), `@@index([organizationId, saleId])`.
- `@@map("void_requests")` — snake_case table name mapping, matching `@@map("sales")` / `@@map("audit_log")`.
- Relation naming: since `User` already has `"CreatedBy"`/`"LastEditedBy"` named relations on `Sale`, use distinct relation names (e.g. `"RequestedBy"`/`"ReviewedBy"`) to avoid Prisma relation ambiguity — copy the `@relation("CreatedBy", ...)` named-relation syntax from `Sale` lines 172, 175.

Note: D-02 (at most one pending request per sale) is **not** enforceable via a simple unique constraint (Prisma doesn't support partial/filtered unique indexes on MySQL cleanly for "one row where status=pending"). Enforce at the application layer inside the transaction (`findFirst` check + create), matching how `sales.ts`'s `/:id/void` handler does its own `findFirst` existence/status guard before mutating (lines 581-592).

---

### `packages/backend/src/routes/voidRequests.ts` (route, CRUD + request-response)

**Analog:** `packages/backend/src/routes/sales.ts`, especially the `/:id/void` endpoint (lines 562-624) and the router-level comment about per-route `requireRole` (lines 1-10).

**Imports pattern** (`sales.ts` lines 1-6):
```typescript
import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/requireRole.js';
import type { PrismaTransactionClient } from '../lib/prisma.js';

export const voidRequestsRouter = Router();

// voidRequestsRouter does NOT mount requireRole at router level — POST / is open to any
// authenticated user creating a request on their own row. GET / (list-all), and the
// approve/reject endpoints are requireRole('admin') per-route — same pattern as salesRouter.
```

**Transactional approve pattern** — directly reuse `sales.ts` lines 579-620's shape:
```typescript
voidRequestsRouter.patch(
  '/:id/approve',
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const requestId = Number(req.params.id);

    const result = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const voidRequest = await tx.voidRequest.findFirst({
        where: { id: requestId, organizationId: req.session.organizationId!, status: 'pending' },
      });
      if (!voidRequest) {
        throw Object.assign(new Error('Void request not found'), { statusCode: 404, code: 'NOT_FOUND' });
      }

      const sale = await tx.sale.findFirst({
        where: { id: voidRequest.saleId, organizationId: req.session.organizationId!, status: 'active' },
      });
      if (!sale) {
        throw Object.assign(new Error('Sale not found or already voided'), { statusCode: 404, code: 'NOT_FOUND' });
      }

      const updatedSale = await tx.sale.update({
        where: { id: sale.id, organizationId: req.session.organizationId! },
        data: { status: 'void', lastEditedById: req.session.userId!, lastEditedByUsername: req.session.username! },
      });

      // AUDIT-02 equivalent (CLAUDE.md Rule 2): audit record in the SAME transaction
      await tx.auditLog.create({
        data: {
          organizationId: req.session.organizationId!,
          userId: req.session.userId!,
          userUsername: req.session.username!,
          saleId: sale.id,
          tableName: 'sales',
          rowId: sale.id,
          action: 'void',
          fieldName: null,
          oldValue: 'active',
          newValue: 'void',
        },
      });

      const updatedRequest = await tx.voidRequest.update({
        where: { id: requestId, organizationId: req.session.organizationId! },
        data: { status: 'approved', reviewedById: req.session.userId!, reviewedAt: new Date() },
      });

      return { updatedSale, updatedRequest };
    }, { timeout: 5000, maxWait: 3000 });

    res.json(serializeVoidRequest(result.updatedRequest));
  },
);
```

**Duplicate-pending guard for POST /** (D-02, per CONTEXT.md's suggested `409 { code: 'DUPLICATE_PENDING_REQUEST' }`):
```typescript
const existingPending = await tx.voidRequest.findFirst({
  where: { saleId, organizationId: req.session.organizationId!, status: 'pending' },
});
if (existingPending) {
  throw Object.assign(new Error('A pending void request already exists for this sale'), {
    statusCode: 409,
    code: 'DUPLICATE_PENDING_REQUEST',
  });
}
```
Ownership guard (D-01) mirrors the `createdById === session.userId` check already implied by `sales.ts`'s ownership-scoped mutations — verify `sale.createdById === req.session.userId!` before allowing the moderator to create a request, and `sale.status === 'active'`.

**Validation pattern** — reuse `body(...)`/`param(...)` + `validationResult(req)` exactly as `sales.ts` line 2 and its `voidSaleValidation` array (referenced at line 569) — same 400 `VALIDATION_ERROR` shape (lines 572-574).

**Serializer pattern** — mirror `serializeSale` (`sales.ts` lines 16-56): plain function converting Date fields via `.toISOString()`, returning a flat JSON-safe object; no Decimal fields here so no `.toFixed(2)` needed.

---

### `packages/backend/src/app.ts` (config)

**Analog:** itself, existing router mount block (lines 98-112)

```typescript
import { voidRequestsRouter } from './routes/voidRequests.js';
// ...
protectedRouter.use('/void-requests', voidRequestsRouter); // mixed access: moderators POST own, admins GET-all/approve/reject (role checks per-route)
```
Add the import next to `salesRouter`'s import (line 20) and the mount line next to `salesRouter`'s mount (line 109) — same comment style describing per-route role enforcement.

---

### `packages/shared/src/types/voidRequest.ts` (model)

**Analog:** `packages/shared/src/types/shift.ts` (full file, 19 lines)

```typescript
// API response shape for VoidRequest entity — Phase 12 moderator void-request workflow
export type VoidRequestStatus = 'pending' | 'approved' | 'rejected';

export interface VoidRequest {
  id: number;
  organizationId: number;
  saleId: number;
  reason: string;
  status: VoidRequestStatus;
  requestedById: number;
  requestedByUsername: string;
  reviewedById: number | null;
  reviewedByUsername: string | null;
  reviewedAt: string | null; // ISO 8601 UTC string
  createdAt: string;         // ISO 8601 UTC string
}
```
Then add to `packages/shared/src/types/index.ts` (mirrors line 12's `Shift` export):
```typescript
export type { VoidRequestStatus, VoidRequest } from './voidRequest.js';
```

---

### `packages/frontend/src/components/sales/VoidRequestDialog.tsx` (component, request-response)

**Analogs:** `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` (full file — Modal wrapper + useMutation + pessimistic disable) and `packages/frontend/src/components/catalog/ProductModal.tsx` (form field pattern with `react-hook-form`, lines 92-136)

**Structural pattern (Modal + mutation)** — copy `VoidConfirmDialog.tsx` lines 1-27 almost verbatim, swapping the store/target for a sale-id prop instead of Zustand store fields (since this is a per-row action triggered from `SalesTable.tsx`, not a global dialog store slot — but check whether `useSalesEditStore` should be extended with `voidRequestTargetSaleId`/`isVoidRequestDialogOpen` for consistency; either approach is acceptable, follow whichever the planner scopes).

**Form field pattern** — copy `ProductModal.tsx`'s `useForm` + `register` + inline error rendering (lines 23-25, 92-110), but render a `<textarea>` instead of `<input>`, per UI-SPEC.md's `rows={3}`, `resize-none` styling:
```typescript
const { register, handleSubmit, formState: { errors }, reset } = useForm<{ reason: string }>({ defaultValues: { reason: '' } });
// ...
<textarea
  id="void-request-reason"
  rows={3}
  disabled={isPending}
  placeholder="Explain why this row should be voided..."
  {...register('reason', { required: 'Reason is required' })}
  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
/>
{errors.reason && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.reason.message}</p>}
```

**Mutation + 409 duplicate-pending error handling** — mirrors `VoidConfirmDialog.tsx`'s `useMutation` (lines 10-20) + `isError` rendering (lines 53-57), but must branch on `err.response?.status === 409` to show the duplicate-pending copy from UI-SPEC.md ("A void request for this row is already pending.") vs. the generic submit-failure copy.

---

### `packages/frontend/src/components/sales/SalesTable.tsx` (add button)

**Analog:** itself — existing Void/Audit action buttons (lines 96-112)

```typescript
const { openVoidDialog, openAuditDrawer } = useSalesEditStore.getState();
// existing:
<button type="button" onClick={() => openVoidDialog(sale.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-normal min-h-[44px] px-1">Void</button>
```
Add the new "Void Request" button in the same Actions cell, same className convention (`text-red-600 ... min-h-[44px]`), gated on `sale.status === 'active' && sale.createdById === currentUser.id` (D-01) and disabled when a pending request already exists for that row (D-02 — requires the sales list or a per-row lookup to know pending-request state; confirm data source with planner). Native `title=` attribute for the tooltip per UI-SPEC.md copy rows, matching the existing disabled-Add-Row-button `title=` convention cited in UI-SPEC.md.

---

### `packages/frontend/src/components/admin/VoidRequestsTable.tsx` (component, CRUD)

**Analog:** `packages/frontend/src/components/admin/AdminSalesTable.tsx` (full file, 325 lines) — direct structural clone

Copy wholesale:
- `useReactTable` + `getCoreRowModel`/`getPaginationRowModel` setup (lines 243-255).
- The 8 base `ColumnDef` entries for Product/Price/MOP/Receiver/Notes/Created By/Created At (lines 100-166) — same accessor/cell style, same `formatDateTime` import (`../../lib/dateTime`, line 18).
- Empty-state panel pattern (lines 261-268) — swap copy per UI-SPEC.md ("No void requests yet" / "Void requests submitted by moderators will appear here.").
- Loading-text pattern (line 257-259) — swap to "Loading void requests...".
- Row striping (`isVoided` ternary, lines 291-299) — replace with a `status`-based ternary (pending/approved/rejected) per UI-SPEC.md's status-pill colors.
- `PaginationFooter` usage (lines 312-321) — reuse unchanged.

**New columns to add** (per D-05/UI-SPEC.md Component Inventory):
- Reason column — identical `line-clamp-2` + `title` treatment as the existing Notes column (lines 136-150), just swap `accessorKey: 'notes'` → `'reason'`.
- Status column (pending/approved/rejected pill) — same `inline-flex items-center px-3 py-1 rounded-full text-xs font-normal` shell as the existing Status column (lines 191-207), with a 3-way ternary: amber `bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200` (pending, per UI-SPEC.md Color table), green (approved, reuses existing Active-badge palette), gray (rejected, reuses existing Inactive-badge palette — check `ProductsPage`/`UsersPage` for the exact inactive-gray classes).
- Actions column — Approve/Reject buttons, rendered only when `row.status === 'pending'` (mirrors the existing `sale.status === 'active'` conditional at lines 216-227), same `flex items-center justify-center gap-1` + `|` separator shell.

---

### `packages/frontend/src/components/admin/ApproveVoidRequestDialog.tsx` (component, request-response)

**Analog:** `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` — direct clone

Copy the entire structure (Modal + `useMutation` + pessimistic Cancel/primary disable, lines 1-60), swapping:
- Mutation endpoint: `api.patch('/void-requests/${id}/approve')` instead of `api.post('/sales/${id}/void')`.
- Title: "Approve Void Request" instead of "Void Row".
- Body copy: "Approving will void this sale row immediately. This cannot be undone." (UI-SPEC.md).
- Primary button label: "Approve & Void Row" / pending "Approving..." (vs. "Void Row"/"Voiding...").
- `onSuccess`: invalidate `['void-requests']` (and `['void-requests-pending-count']` for the badge) instead of `['sales']`/`['admin-summary']`.

---

### Reject action (inline in `VoidRequestsTable.tsx`, no dialog)

**Analog:** `packages/frontend/src/pages/ProductsPage.tsx` Deactivate-toggle pattern (`toggleMutation`, line 34; gray text-link classes, lines 86-99)

```typescript
const rejectMutation = useMutation({
  mutationFn: (requestId: number) => api.patch(`/void-requests/${requestId}/reject`).then((r) => r.data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['void-requests'] });
    queryClient.invalidateQueries({ queryKey: ['void-requests-pending-count'] });
  },
});
```
Button className mirrors `ProductsPage.tsx`'s toggle link: `text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 text-sm min-h-[44px]`, disabled-during-round-trip variant `text-gray-400 cursor-not-allowed`, tracked per-row via a local `pendingRejectId` state (no dedicated confirm dialog per UI-SPEC.md's Interaction Weight decision).

---

### `packages/frontend/src/pages/VoidRequestsPage.tsx` (component, CRUD)

**Analog:** `packages/frontend/src/pages/ProductsPage.tsx` / `SalesPage.tsx` page-shell pattern — `useQuery` fetch + `<h1>` heading + table component + `isError` fallback

```typescript
const { data, isLoading, isError } = useQuery({
  queryKey: ['void-requests'],
  queryFn: () => api.get<VoidRequest[]>('/void-requests').then((r) => r.data),
});
```
`isError` fallback copy per UI-SPEC.md: "Failed to load void requests. Please refresh the page." (matches `SalesPage.tsx`'s exact existing `isError` fallback pattern verbatim, per UI-SPEC.md Copywriting Contract).

---

### `packages/frontend/src/layouts/AuthenticatedLayout.tsx` (add nav entry + badge)

**Analog:** itself — `ADMIN_NAV` array (lines 11-19) and `NavLink` render (lines 76-89)

```typescript
const ADMIN_NAV = [
  // ...existing entries...
  { to: '/void-requests', label: 'Void Requests' },
];
```
Badge fetch — new `useQuery` in `SidebarContent` (no existing nav-badge precedent, per CONTEXT.md D-08):
```typescript
const { data: pendingCount } = useQuery({
  queryKey: ['void-requests-pending-count'],
  queryFn: () => api.get<{ count: number }>('/void-requests/pending-count').then((r) => r.data.count),
  enabled: user?.role === 'admin',
});
```
Render only for the "Void Requests" nav item, converting its layout to `flex items-center justify-between` (per UI-SPEC.md Component Inventory), badge omitted when `pendingCount` is `0`/`undefined` (D-09 + loading-state backstop):
```typescript
{item.to === '/void-requests' && !!pendingCount && (
  <span className="min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-xs font-semibold leading-none flex items-center justify-center">
    {pendingCount > 99 ? '99+' : pendingCount}
  </span>
)}
```

---

### `packages/frontend/src/router/index.tsx` (add route)

**Analog:** itself — existing admin-only route block (lines 52-63)

```typescript
import { VoidRequestsPage } from '../pages/VoidRequestsPage';
// ...
{
  element: <ProtectedRoute requiredRole="admin" />,
  children: [
    // ...existing entries...
    { path: '/void-requests', element: <VoidRequestsPage /> },
  ],
},
```

## Shared Patterns

### Transactional audit write (CLAUDE.md Rule 2)
**Source:** `packages/backend/src/routes/sales.ts` lines 579-620 (`prisma.$transaction(async (tx) => {...}, { timeout: 5000, maxWait: 3000 })`)
**Apply to:** the Approve endpoint in `voidRequests.ts` — sale status update, AuditLog `void` entry, and VoidRequest status update must all be inside the same `tx`.

### Per-route RBAC on a non-fully-gated router
**Source:** `packages/backend/src/routes/sales.ts` lines 1-10, 562-568 (`requireRole('admin')` applied per-route, not at router level)
**Apply to:** `voidRequestsRouter` — POST / open to any authenticated user (with in-handler ownership + status checks), GET / and PATCH approve/reject require `requireRole('admin')`.

### Error object shape for custom status codes
**Source:** `packages/backend/src/middleware/errorHandler.ts` (reads `err.statusCode` and `err.code`), used via `Object.assign(new Error(...), { statusCode, code })` in `sales.ts` line 591
**Apply to:** all new error throws in `voidRequests.ts` (404 NOT_FOUND, 409 DUPLICATE_PENDING_REQUEST, 403 for ownership violations).

### Pessimistic UI mutation dialog
**Source:** `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` (full file)
**Apply to:** `VoidRequestDialog.tsx` and `ApproveVoidRequestDialog.tsx` — Modal `onClose={isPending ? undefined : onClose}`, both footer buttons `disabled={isPending}`, primary label swaps to a "-ing..." verb during the round-trip.

### Read-only admin table with pagination
**Source:** `packages/frontend/src/components/admin/AdminSalesTable.tsx` (full file)
**Apply to:** `VoidRequestsTable.tsx` — react-table columns array, `PaginationFooter`, empty/loading states, row striping by status.

### Shared date formatting
**Source:** `packages/frontend/src/lib/dateTime.ts` (`formatDateTime`)
**Apply to:** every date/time cell in `VoidRequestsTable.tsx` (Created At; Reviewed At if displayed).

### Shared TypeScript type re-export
**Source:** `packages/shared/src/types/index.ts` lines 8-15
**Apply to:** adding `VoidRequestStatus`/`VoidRequest` exports.

## No Analog Found

None — every planned file has a close structural or role-based analog in the existing codebase.

## Metadata

**Analog search scope:** `packages/backend/src/routes/`, `packages/backend/prisma/schema.prisma`, `packages/backend/src/app.ts`, `packages/backend/src/middleware/errorHandler.ts`, `packages/frontend/src/components/sales/`, `packages/frontend/src/components/admin/`, `packages/frontend/src/components/catalog/`, `packages/frontend/src/pages/`, `packages/frontend/src/layouts/`, `packages/frontend/src/router/`, `packages/shared/src/types/`
**Files scanned:** 12 read/grepped directly, plus directory listings of `packages/shared/src/types/`
**Pattern extraction date:** 2026-08-09
