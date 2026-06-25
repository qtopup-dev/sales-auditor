# Phase 3: Sales Core - Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 9 (8 new, 1 modified)
**Analogs found:** 8 / 9 (EditableCell has no direct analog — fully novel)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/backend/src/routes/sales.ts` | route/controller | CRUD + transactional | `packages/backend/src/routes/products.ts` | role-match (same Router/validator/serializer pattern; sales adds $transaction) |
| `packages/frontend/src/pages/SalesPage.tsx` | page/component | request-response | `packages/frontend/src/pages/ProductsPage.tsx` | role-match (same useQuery/useMutation/isLoading layout) |
| `packages/frontend/src/components/sales/SalesTable.tsx` | component | CRUD + event-driven | `packages/frontend/src/pages/ProductsPage.tsx` (table portion) | partial-match (same react-table v8 columns + flexRender; adds react-virtual) |
| `packages/frontend/src/components/sales/AddRowForm.tsx` | component | request-response | `packages/frontend/src/components/catalog/ProductModal.tsx` | partial-match (same react-hook-form + useMutation + pessimistic disable pattern; inline row vs modal) |
| `packages/frontend/src/components/sales/EditableCell.tsx` | component | event-driven | none | no analog — novel inline-edit state machine |
| `packages/frontend/src/components/sales/AuditDrawer.tsx` | component | request-response | `packages/frontend/src/components/Modal.tsx` | partial-match (same overlay + Escape pattern; drawer is slide-in panel variant) |
| `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` | component | request-response | `packages/frontend/src/components/catalog/ProductModal.tsx` | exact (wraps Modal.tsx with confirm/cancel footer, isPending disable) |
| `packages/frontend/src/stores/salesEditStore.ts` | store | event-driven | `packages/frontend/src/stores/authStore.ts` | exact (same Zustand v5 curried create pattern) |
| `packages/backend/prisma/schema.prisma` | config/schema | — | self (existing file, additive migration) | — |

---

## Pattern Assignments

### `packages/backend/src/routes/sales.ts` (route, CRUD + transactional)

**Analog:** `packages/backend/src/routes/products.ts`

**Imports pattern** (products.ts lines 1-6):
```typescript
import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/requireRole.js';

export const salesRouter = Router();
```
Note: salesRouter does NOT mount `requireRole` at the router level (unlike productsRouter) because GET and POST /api/sales are open to all authenticated users. `requireRole` is applied per-route only on void and audit endpoints.

**Serializer pattern** (products.ts lines 14-32):
```typescript
// CRITICAL: .toFixed(2) always — never .toNumber() or .toString() (drops trailing zeros)
function serializeSale(sale: { /* Sale shape from shared types */ }) {
  return {
    ...sale,
    priceSnapshot: sale.priceSnapshot.toFixed(2),  // Decimal → string
    createdAt: sale.createdAt.toISOString(),
    updatedAt: sale.updatedAt.toISOString(),
  };
}
```

**GET list pattern — override soft-delete $extends** (products.ts lines 39-48):
```typescript
salesRouter.get('/', async (req, res) => {
  const sales = await prisma.sale.findMany({
    where: {
      organizationId: 1,
      status: { in: ['active', 'void'] }, // override $extends default — show all (SALES-15)
    },
    orderBy: { createdAt: 'desc' },       // newest-first (SALES-01)
  });
  res.json(sales.map(serializeSale));
});
```

**Validation + 400 response pattern** (products.ts lines 55-78):
```typescript
const createSaleValidation = [
  body('productId').isInt({ min: 1 }).withMessage('Product is required'),
  body('mopId').isInt({ min: 1 }).withMessage('MOP is required'),
  body('receiver').trim().notEmpty().withMessage('Receiver is required'),
  body('notes').optional().isString(),
];

salesRouter.post('/', createSaleValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }
  // ... $transaction body
});
```

**$transaction pattern** (auth.ts lines 151-178 — the codebase's existing $transaction use):
```typescript
// CRITICAL: tx client does NOT inherit $extends softDeleteFilter
// Every where clause inside transaction MUST include explicit status/isActive/organizationId
await prisma.$transaction(async (tx) => {
  // 1. Read current value (for audit log oldValue)
  const sale = await tx.sale.findFirst({
    where: {
      id: saleId,
      organizationId: 1,
      status: 'active',          // EXPLICIT — $extends NOT active inside tx
    },
    select: { [field]: true, createdById: true, /* snapshot fields */ },
  });
  if (!sale) {
    throw Object.assign(new Error('Not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  // 2. RBAC check
  const canMutate =
    (sale.createdById === req.session.userId && user.canEdit) ||
    req.session.role === 'admin';
  if (!canMutate) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403, code: 'FORBIDDEN' });
  }

  // 3. Write new value
  const updated = await tx.sale.update({
    where: { id: saleId },
    data: { [field]: newValue, lastEditedById: req.session.userId, lastEditedByUsername: username },
  });

  // 4. Write audit record in SAME transaction (AUDIT-02 — hard constraint)
  await tx.auditLog.create({
    data: {
      organizationId: 1,
      userId: req.session.userId!,
      userUsername: username,    // denormalized at write time — never join to users table
      saleId,
      tableName: 'sales',
      rowId: saleId,
      action: 'update',
      fieldName: field,
      oldValue: String(oldValue ?? ''),
      newValue: String(updated[field] ?? ''), // from Prisma return — NOT raw req.body
    },
  });
  return updated;
});
```

**param validation pattern** (products.ts lines 84-86):
```typescript
const patchSaleValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid sale ID'),
  body('field').isIn(['productId', 'mopId', 'receiver', 'notes']),
  body('value').exists(),
];
```

**requireRole per-route pattern** (products.ts line 9 — note sales uses it per-route, not router-level):
```typescript
// Void: admin only (ROLES-06)
salesRouter.post('/:id/void', requireRole('admin'), async (req, res) => { ... });

// Audit: admin only (D-14)
salesRouter.get('/:id/audit', requireRole('admin'), async (req, res) => { ... });
```

**Error throw pattern for RBAC violations** (consistent with codebase):
```typescript
throw Object.assign(new Error('Forbidden'), { statusCode: 403, code: 'FORBIDDEN' });
```

**Mounting location** — `packages/backend/src/app.ts` line 87:
```typescript
// ADD before app.use('/api', requireAuth, protectedRouter):
import { salesRouter } from './routes/sales.js';
// INSIDE createApp(), alongside existing protectedRouter.use() calls:
protectedRouter.use('/sales', salesRouter);
```

---

### `packages/frontend/src/pages/SalesPage.tsx` (page, request-response)

**Analog:** `packages/frontend/src/pages/ProductsPage.tsx`

**Imports pattern** (ProductsPage.tsx lines 1-13):
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { useSalesEditStore } from '../stores/salesEditStore';
import type { Sale } from '@alejinput/shared';
// Sub-components:
import { SalesTable } from '../components/sales/SalesTable';
import { AuditDrawer } from '../components/sales/AuditDrawer';
import { VoidConfirmDialog } from '../components/sales/VoidConfirmDialog';
```

**useQuery pattern** (ProductsPage.tsx lines 26-29):
```typescript
const { data: sales = [], isLoading, isError } = useQuery<Sale[]>({
  queryKey: ['sales'],
  queryFn: () => api.get<Sale[]>('/sales').then((r) => r.data),
});
```

**useMutation + invalidate pattern** (ProductsPage.tsx lines 31-41):
```typescript
const queryClient = useQueryClient();

const voidMutation = useMutation({
  mutationFn: (saleId: number) =>
    api.post<Sale>(`/sales/${saleId}/void`).then((r) => r.data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    closeVoidDialog();
  },
  onError: () => {
    // re-enable dialog buttons (isPending from mutation state)
  },
});
```

**isLoading branch pattern** (ProductsPage.tsx lines 123-125):
```typescript
{isLoading ? (
  <p className="text-sm text-gray-500">Loading sales...</p>
) : isError ? (
  <p className="text-sm text-gray-500">Failed to load sales. Please refresh the page.</p>
) : (
  <SalesTable sales={sales} />
)}
```

**Page header pattern** (ProductsPage.tsx lines 111-120):
```typescript
<div className="flex flex-col h-full">
  <div className="flex items-center justify-between mb-8">
    <h1 className="text-xl font-semibold text-gray-900">Sales Sheet</h1>
    <button
      type="button"
      disabled={isAddRowOpen}
      onClick={openAddRow}
      className="px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Add Row
    </button>
  </div>
  {/* Table fills remaining height — flex-1 min-h-0 critical for Firefox */}
  <div className="flex-1 min-h-0 border border-gray-200 rounded-md overflow-hidden">
    {/* sales table content */}
  </div>
</div>
```

---

### `packages/frontend/src/components/sales/SalesTable.tsx` (component, CRUD + event-driven)

**Analog:** `packages/frontend/src/pages/ProductsPage.tsx` (table section) + react-virtual (novel addition)

**react-table column definition pattern** (ProductsPage.tsx lines 44-100):
```typescript
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';

const columns: ColumnDef<Sale>[] = [
  {
    accessorKey: 'productNameSnapshot',
    header: 'Product',
    size: 200,
    cell: ({ row, getValue }) => (
      <EditableCell
        sale={row.original}
        field="productId"
        displayValue={getValue<string>()}
      />
    ),
  },
  {
    accessorKey: 'priceSnapshot',
    header: () => <span className="block text-right">Price</span>,
    size: 100,
    cell: ({ getValue }) => (
      <span className="block text-right text-sm text-gray-400">{getValue<string>()}</span>
    ),
  },
  // ... etc.
  {
    id: 'actions',
    header: 'Actions',
    size: 120,
    cell: ({ row }) => {
      const sale = row.original;
      // e.stopPropagation() pattern from ProductsPage.tsx line 161
      return <div onClick={(e) => e.stopPropagation()}>...</div>;
    },
  },
];

const table = useReactTable({
  data: rows,   // rows includes sentinel isNewRow item if isAddRowOpen
  columns,
  getCoreRowModel: getCoreRowModel(),
});
```

**Table header render pattern** (ProductsPage.tsx lines 134-146):
```typescript
<thead>
  {table.getHeaderGroups().map((headerGroup) => (
    <tr key={headerGroup.id} className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
      {headerGroup.headers.map((header) => (
        <th
          key={header.id}
          className="px-4 py-3 text-sm text-gray-500 font-normal text-left"
          style={{ width: header.column.getSize() }}
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
        </th>
      ))}
    </tr>
  ))}
</thead>
```

**react-virtual rows (novel — no codebase analog; from RESEARCH.md Pattern 2):**
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

const parentRef = useRef<HTMLDivElement>(null);
const { rows } = table.getRowModel();

const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 56,
  measureElement:
    typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
      ? (el) => el?.getBoundingClientRect().height
      : undefined,
  overscan: 3,
});

return (
  <div ref={parentRef} className="overflow-auto h-full">
    <table className="w-full" style={{ minWidth: '1160px' }}>
      <thead>{/* sticky header — see above */}</thead>
      <tbody>
        <tr style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const row = rows[virtualItem.index];
            return (
              <tr
                key={virtualItem.key}
                data-index={virtualItem.index}          // REQUIRED for measureElement
                ref={virtualizer.measureElement}        // REQUIRED — ResizeObserver hook
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className={
                  row.original.isNewRow
                    ? 'bg-gray-100 border-b border-blue-200'
                    : row.original.status === 'void'
                    ? 'bg-red-50 border-b border-gray-200 hover:bg-red-100'
                    : 'bg-white border-b border-gray-200 hover:bg-gray-50'
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-2 text-sm text-gray-900"
                    onClick={cell.column.id === 'actions' ? (e) => e.stopPropagation() : undefined}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tr>
      </tbody>
    </table>
  </div>
);
```

**stopPropagation pattern** (ProductsPage.tsx line 161):
```typescript
onClick={
  cell.column.id === 'actions' ? (e) => e.stopPropagation() : undefined
}
```

---

### `packages/frontend/src/components/sales/AddRowForm.tsx` (component, request-response)

**Analog:** `packages/frontend/src/components/catalog/ProductModal.tsx`

**react-hook-form setup pattern** (ProductModal.tsx lines 23-25):
```typescript
import { useForm, Controller } from 'react-hook-form';
import AsyncSelect from 'react-select/async';

type AddRowFormData = {
  productId: number | null;
  mopId: number | null;
  receiver: string;
  notes: string;
};

const { register, handleSubmit, control, watch, setValue, formState: { errors } } =
  useForm<AddRowFormData>({
    defaultValues: { productId: null, mopId: null, receiver: '', notes: '' },
  });
```

**useMutation + invalidate + pessimistic pattern** (ProductModal.tsx lines 32-48):
```typescript
const queryClient = useQueryClient();

const createMutation = useMutation({
  mutationFn: (data: AddRowFormData) =>
    api.post<Sale>('/sales', data).then((r) => r.data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    closeAddRow();
    virtualizer.scrollToIndex(0, { align: 'start' }); // new row is index 0
  },
});

const isPending = createMutation.isPending;
```

**Pessimistic disable all inputs pattern** (ProductModal.tsx lines 101-137):
```typescript
// All inputs receive disabled={isPending} (CLAUDE.md Rule 10)
// Save button:
<button
  type="submit"
  disabled={isPending || !isFormValid}
  className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
>
  {isPending ? 'Saving...' : 'Save Row'}
</button>
// Discard button:
<button
  type="button"
  onClick={closeAddRow}
  disabled={isPending}
  className="px-3 py-1.5 border border-gray-300 bg-white text-gray-600 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
>
  Discard
</button>
```

**react-select Controller pattern with menuPortalTarget** (novel; from RESEARCH.md Pattern 4):
```typescript
// For Product and MOP combo boxes inside the inline row form
<Controller
  name="productId"
  control={control}
  rules={{ required: 'Product is required' }}
  render={({ field }) => (
    <AsyncSelect
      {...field}
      loadOptions={async (inputValue) => {
        const res = await api.get<Product[]>('/products');
        return res.data
          .filter(p => p.name.toLowerCase().includes(inputValue.toLowerCase()))
          .map(p => ({ value: p.id, label: p.name, price: p.price }));
      }}
      defaultOptions
      cacheOptions
      menuPortalTarget={document.body}   // REQUIRED — prevents overflow clipping
      menuPosition="fixed"               // REQUIRED with menuPortalTarget
      isDisabled={isPending}
      placeholder="Select product..."
      styles={{
        control: (base) => ({ ...base, minHeight: '36px', fontSize: '14px' }),
        menu: (base) => ({ ...base, zIndex: 9999 }),
      }}
      onChange={(option) => {
        field.onChange(option?.value ?? null);
        if (option) setValue('priceDisplay', option.price); // populate Price read-only
      }}
    />
  )}
/>
```

**Input field pattern** (ProductModal.tsx lines 98-109):
```typescript
<input
  type="text"
  disabled={isPending}
  placeholder="Receiver name"
  {...register('receiver', { required: 'Receiver is required' })}
  className={`h-9 w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100 ${
    errors.receiver ? 'border-red-500' : 'border-gray-300 focus:border-blue-500'
  }`}
/>
{errors.receiver && <p className="text-xs text-red-600 mt-0.5">{errors.receiver.message}</p>}
```

**Escape key handler** (Modal.tsx lines 15-20 — adapt for inline row):
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isAddRowOpen) closeAddRow();
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [isAddRowOpen, closeAddRow]);
```

---

### `packages/frontend/src/components/sales/EditableCell.tsx` (component, event-driven)

**Analog:** none — fully novel inline-edit state machine. No existing codebase analog.

**Key patterns to compose (from multiple sources):**

**Zustand store access pattern** (authStore.ts lines 18-21):
```typescript
import { useSalesEditStore } from '../../stores/salesEditStore';
const { activeCellSaleId, activeCellField, draftValue, isPending, isAddRowOpen,
        setActiveCell, clearActiveCell, setDraftValue, setPending } = useSalesEditStore();
```

**useMutation for PATCH** (ProductsPage.tsx lines 31-41):
```typescript
const queryClient = useQueryClient();
const patchMutation = useMutation({
  mutationFn: ({ saleId, field, value }: { saleId: number; field: string; value: string }) =>
    api.patch<Sale>(`/sales/${saleId}`, { field, value }).then((r) => r.data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    clearActiveCell();
    setPending(false);
  },
  onError: () => {
    setPending(false);
    // Return to display mode with prior value (read from sale.field, not draftValue)
  },
});
```

**Pessimistic disable pattern for cell** (ProductModal.tsx — adapt for cell level):
```typescript
// When isPending: cell input disabled + bg-gray-100 opacity-60 + spinner
const isThisCellActive = activeCellSaleId === sale.id && activeCellField === field;
const isThisCellPending = isThisCellActive && isPending;

if (isThisCellPending) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 opacity-60 px-4 py-2 min-h-[48px]">
      <span className="text-sm text-gray-400">{displayValue}</span>
      <svg className="animate-spin h-4 w-4 text-gray-400" .../>
    </div>
  );
}
```

**Blur-save handler:**
```typescript
const handleBlur = () => {
  if (draftValue !== String(sale[field] ?? '')) {
    setPending(true);
    patchMutation.mutate({ saleId: sale.id, field, value: draftValue });
  } else {
    clearActiveCell();
  }
};
```

**react-select in cell edit mode (Product/MOP — change = immediate PATCH):**
```typescript
// For select fields: change fires PATCH immediately (no blur needed)
onChange={(option) => {
  if (option) {
    setPending(true);
    patchMutation.mutate({ saleId: sale.id, field, value: String(option.value) });
  }
}}
```

**Editable cell click guard (D-03: blocked while Add Row form is open):**
```typescript
const handleClick = () => {
  if (isAddRowOpen || isPending) return;    // blocked while form open or pending round-trip
  if (activeCellSaleId !== null && activeCellSaleId !== sale.id) return; // wait for blur of other cell
  setActiveCell(sale.id, field, String(sale[field] ?? ''));
};
```

**Idle editable cell hover style:**
```typescript
className={`cursor-pointer hover:bg-blue-50 px-4 py-2 min-h-[48px] ${
  isThisCellActive ? 'border border-blue-500 bg-white' : ''
}`}
```

---

### `packages/frontend/src/components/sales/AuditDrawer.tsx` (component, request-response)

**Analog:** `packages/frontend/src/components/Modal.tsx`

**useQuery pattern for audit data** (ProductsPage.tsx lines 26-29 — adapt key):
```typescript
const { data: entries = [], isLoading } = useQuery<AuditEntry[]>({
  queryKey: ['sales', saleId, 'audit'],
  queryFn: () => api.get<AuditEntry[]>(`/sales/${saleId}/audit`).then((r) => r.data),
  enabled: saleId !== null,   // only fetch when drawer is open
});
```

**Escape key + overlay close pattern** (Modal.tsx lines 15-34):
```typescript
useEffect(() => {
  if (!open) return;
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeAuditDrawer();
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [open, closeAuditDrawer]);

if (!open) return null;
```

**Drawer panel structure (novel layout vs Modal.tsx; same z-index/overlay concept):**
```typescript
return (
  <>
    {/* Overlay — same concept as Modal.tsx line 29, but 30% opacity */}
    <div
      className="fixed inset-0 bg-gray-900/30 z-40"
      onClick={closeAuditDrawer}
    />
    {/* Drawer panel */}
    <div
      className="fixed top-0 right-0 h-full w-[400px] bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-drawer-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-6 border-b border-gray-200">
        <h2 id="audit-drawer-title" className="text-xl font-semibold text-gray-900">Audit Log</h2>
        <button
          type="button"
          onClick={closeAuditDrawer}
          className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Close"
        >
          &#x2715;
        </button>
      </div>
      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-500">No audit entries found.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <div key={entry.id} className="py-3">
                <p className="text-xs text-gray-400">{entry.createdAt}</p>
                <p className="text-sm text-gray-900">
                  {entry.userUsername}
                  <span className="text-gray-500"> · {actionLabel(entry.action, entry.fieldName)}</span>
                </p>
                {entry.action === 'update' && (
                  <p className="text-sm">
                    <span className="text-gray-500">Field: </span>
                    <span className="text-gray-900">{entry.fieldName}</span>
                    {'  '}
                    <span className="text-gray-900">{entry.oldValue}</span>
                    <span className="text-gray-400"> → </span>
                    <span className="text-gray-900">{entry.newValue}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </>
);
```

---

### `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` (component, request-response)

**Analog:** `packages/frontend/src/components/catalog/ProductModal.tsx` (exact wrapping pattern)

**Modal wrapper pattern** (ProductModal.tsx lines 67-91):
```typescript
import { Modal } from '../Modal';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/axios';
import { useSalesEditStore } from '../../stores/salesEditStore';

export function VoidConfirmDialog() {
  const queryClient = useQueryClient();
  const { isVoidDialogOpen, voidTargetSaleId, closeVoidDialog } = useSalesEditStore();

  const voidMutation = useMutation({
    mutationFn: (saleId: number) =>
      api.post(`/sales/${saleId}/void`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      closeVoidDialog();
    },
  });

  const isPending = voidMutation.isPending;

  return (
    <Modal
      open={isVoidDialogOpen}
      onClose={isPending ? undefined : closeVoidDialog}   // blocked during round-trip (Rule 10)
      title="Void Row"
      footer={
        <>
          <button
            type="button"
            onClick={closeVoidDialog}
            disabled={isPending}
            className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Keep Row
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => voidTargetSaleId && voidMutation.mutate(voidTargetSaleId)}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Voiding...' : 'Void Row'}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-900">
        Are you sure you want to void this row? This action cannot be undone.
      </p>
      {voidMutation.isError && (
        <p className="text-sm text-red-600 mt-2">Failed to void row. Please try again.</p>
      )}
    </Modal>
  );
}
```

---

### `packages/frontend/src/stores/salesEditStore.ts` (store, event-driven)

**Analog:** `packages/frontend/src/stores/authStore.ts` (exact pattern)

**Zustand v5 curried create pattern** (authStore.ts lines 1-25 — complete file):
```typescript
import { create } from 'zustand';

// Zustand v5: curried create<State>()() — NOT create<State>() (see authStore.ts comment)
// Shape is LOCKED by D-05 — do not change field names
interface SalesEditState {
  isAddRowOpen: boolean;
  activeCellSaleId: number | null;
  activeCellField: string | null;
  draftValue: string;
  isPending: boolean;
  openAuditSaleId: number | null;
  isVoidDialogOpen: boolean;
  voidTargetSaleId: number | null;
  // Actions
  openAddRow: () => void;
  closeAddRow: () => void;
  setActiveCell: (saleId: number, field: string, initialValue: string) => void;
  clearActiveCell: () => void;
  setDraftValue: (value: string) => void;
  setPending: (pending: boolean) => void;
  openAuditDrawer: (saleId: number) => void;
  closeAuditDrawer: () => void;
  openVoidDialog: (saleId: number) => void;
  closeVoidDialog: () => void;
}

export const useSalesEditStore = create<SalesEditState>()((set) => ({
  // Initial state
  isAddRowOpen: false,
  activeCellSaleId: null,
  activeCellField: null,
  draftValue: '',
  isPending: false,
  openAuditSaleId: null,
  isVoidDialogOpen: false,
  voidTargetSaleId: null,
  // Actions
  openAddRow: () => set({ isAddRowOpen: true }),
  closeAddRow: () => set({ isAddRowOpen: false }),
  setActiveCell: (saleId, field, initialValue) =>
    set({ activeCellSaleId: saleId, activeCellField: field, draftValue: initialValue }),
  clearActiveCell: () =>
    set({ activeCellSaleId: null, activeCellField: null, draftValue: '' }),
  setDraftValue: (value) => set({ draftValue: value }),
  setPending: (pending) => set({ isPending: pending }),
  openAuditDrawer: (saleId) => set({ openAuditSaleId: saleId }),
  closeAuditDrawer: () => set({ openAuditSaleId: null }),
  openVoidDialog: (saleId) => set({ isVoidDialogOpen: true, voidTargetSaleId: saleId }),
  closeVoidDialog: () => set({ isVoidDialogOpen: false, voidTargetSaleId: null }),
}));
```

**Synchronous getter pattern** (authStore.ts lines 24-26 — optional, add if needed outside React):
```typescript
export const getSalesEditState = () => useSalesEditStore.getState();
```

---

### `packages/backend/prisma/schema.prisma` (schema, additive migration)

**Analog:** self — existing file. Additive only.

**Current Sale model missing fields** — compare schema.prisma lines 101-131 vs sale.ts lines 22-23:

Sale model currently has `createdById` and `lastEditedById` but is MISSING:
- `createdByUsername    String    @db.VarChar(100)`
- `lastEditedByUsername String?   @db.VarChar(100)`

AuditLog model (lines 133-154) is MISSING:
- `userUsername   String    @db.VarChar(100)`

**Existing field placement pattern** (schema.prisma lines 116-120):
```prisma
// PLACE createdByUsername directly after createdById:
createdById          Int
createdBy            User         @relation("CreatedBy", fields: [createdById], references: [id])
createdByUsername    String       @db.VarChar(100)   // ADD — denormalized at creation
lastEditedById       Int?
lastEditedBy         User?        @relation("LastEditedBy", fields: [lastEditedById], references: [id])
lastEditedByUsername String?      @db.VarChar(100)   // ADD — null until first edit
```

```prisma
// AuditLog — PLACE userUsername directly after userId:
userId         Int
user           User         @relation(fields: [userId], references: [id])
userUsername   String       @db.VarChar(100)   // ADD — denormalized at write time
```

**Session augmentation update needed** — `packages/backend/src/middleware/requireAuth.ts` lines 7-12. Add `username` and `organizationId` to SessionData (Option A from RESEARCH.md Open Questions):
```typescript
declare module 'express-session' {
  interface SessionData {
    userId: number;
    role: 'admin' | 'moderator';
    username: string;          // ADD — needed for audit log userUsername
    organizationId: number;    // ADD — needed for organizationId on all writes
  }
}
```
And update `packages/backend/src/routes/auth.ts` login handler (lines 64-65) to also save `username` and `organizationId` to session.

---

## Shared Patterns

### Authentication (applied to all sales endpoints via protectedRouter)

**Source:** `packages/backend/src/middleware/requireAuth.ts` (all 24 lines)
**Apply to:** salesRouter is mounted on protectedRouter; requireAuth is already inherited.
```typescript
// No per-route requireAuth needed — inherited from:
// app.use('/api', requireAuth, protectedRouter);  (app.ts line 87)
// protectedRouter.use('/sales', salesRouter);      (to be added)
```

### Role Enforcement per Endpoint

**Source:** `packages/backend/src/middleware/requireRole.ts` lines 9-17
**Apply to:** `POST /api/sales/:id/void` and `GET /api/sales/:id/audit`
```typescript
export function requireRole(role: 'admin' | 'moderator') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.session.role !== role) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }
    next();
  };
}
// Usage: salesRouter.post('/:id/void', requireRole('admin'), handler);
//        salesRouter.get('/:id/audit', requireRole('admin'), handler);
```

### Error Serialization (RBAC throw pattern)

**Source:** `packages/backend/src/routes/auth.ts` lines 155-158
**Apply to:** PATCH and void handlers for RBAC violations and not-found cases
```typescript
throw Object.assign(new Error('Not found'), { statusCode: 404, code: 'NOT_FOUND' });
throw Object.assign(new Error('Forbidden'), { statusCode: 403, code: 'FORBIDDEN' });
```

### Validation + 400 Response

**Source:** `packages/backend/src/routes/products.ts` lines 63-68
**Apply to:** All sales route handlers with validation middleware
```typescript
const errors = validationResult(req);
if (!errors.isEmpty()) {
  res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
  return;
}
```

### React Query invalidation after mutations

**Source:** `packages/frontend/src/pages/ProductsPage.tsx` lines 37-38
**Apply to:** All sales mutations (POST, PATCH, void)
```typescript
queryClient.invalidateQueries({ queryKey: ['sales'] });
```

### Pessimistic UI disable during round-trip

**Source:** `packages/frontend/src/components/catalog/ProductModal.tsx` lines 50, 69, 101
**Apply to:** AddRowForm, EditableCell, VoidConfirmDialog — all interactive elements
```typescript
const isPending = mutation.isPending;
// All inputs: disabled={isPending}
// Primary button: disabled={isPending} + label changes to "Saving..." / "Voiding..."
// Modal: onClose={isPending ? undefined : onClose}  // blocks Escape + backdrop close
```

### Void Badge (extend StatusBadge pattern)

**Source:** `packages/frontend/src/components/StatusBadge.tsx` lines 3-13
**Apply to:** Actions column on voided rows
```typescript
// Void badge — matches UI-SPEC.md §Actions Column
<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-normal bg-red-100 text-red-700">
  Void
</span>
```

### Decimal Serialization (CRITICAL)

**Source:** `packages/backend/src/routes/products.ts` lines 27
**Apply to:** `serializeSale` helper for `priceSnapshot` field
```typescript
priceSnapshot: sale.priceSnapshot.toFixed(2),  // NEVER .toString() or .toNumber()
// Decimal("1000").toString() = "1000" not "1000.00"
```

### $extends Override for Soft-Delete

**Source:** `packages/backend/src/routes/products.ts` lines 43
**Apply to:** `GET /api/sales` which must return both active AND void rows
```typescript
// Override $extends default by providing explicit status key in caller's where clause
status: { in: ['active', 'void'] }  // wins over default status: 'active' injection
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/frontend/src/components/sales/EditableCell.tsx` | component | event-driven | No inline-edit cell state machine exists in the codebase. Compose from: Zustand store access (authStore pattern), useMutation (ProductsPage pattern), react-select (RESEARCH.md Pattern 4), react-virtual measureElement callback (RESEARCH.md Pattern 2). |

---

## Metadata

**Analog search scope:** `packages/backend/src/routes/`, `packages/backend/src/middleware/`, `packages/backend/src/lib/`, `packages/frontend/src/pages/`, `packages/frontend/src/components/`, `packages/frontend/src/stores/`, `packages/backend/prisma/`, `packages/shared/src/types/`
**Files scanned:** 14 (products.ts, ProductsPage.tsx, authStore.ts, Modal.tsx, ProductModal.tsx, StatusBadge.tsx, app.ts, prisma.ts, requireRole.ts, requireAuth.ts, auth.ts, schema.prisma, sale.ts, audit.ts)
**Pattern extraction date:** 2026-06-18
