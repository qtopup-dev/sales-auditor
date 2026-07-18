# Phase 7: Moderator Shift Clock In/Out - Pattern Map

**Mapped:** 2026-07-18
**Files analyzed:** 19 (new + modified)
**Analogs found:** 17 / 19

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `packages/backend/prisma/schema.prisma` | model | CRUD | `Receiver` model + `Sale.receiverId` FK (Phase 5, same file) | exact |
| `packages/backend/src/routes/shifts.ts` | route/controller | CRUD + request-response | `packages/backend/src/routes/sales.ts` (transactional create) + `receivers.ts` (toggle pattern) + `admin.ts` (UTC `$queryRaw`) | role-match (composite) |
| `packages/backend/src/routes/sales.ts` | route/controller | CRUD | itself — extend existing `receiverId` snapshot-lookup pattern (Phase 5) | exact |
| `packages/backend/src/app.ts` | config | wiring | itself — existing router-mount block | exact |
| `packages/shared/src/types/shift.ts` | model (shared type) | transform | `packages/shared/src/types/receiver.ts` | exact |
| `packages/frontend/src/stores/shiftStore.ts` | store | event-driven (UI overlay state) | `packages/frontend/src/stores/salesEditStore.ts` | exact |
| `packages/frontend/src/components/shift/ClockControl.tsx` | component | request-response (mutation) | `AuthenticatedLayout.tsx` username/logout block (shell) + `VoidConfirmDialog.tsx` (mutation/pessimistic pattern) | role-match (composite) |
| `packages/frontend/src/components/shift/ClockOutConfirmDialog.tsx` | component | request-response | `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` | exact |
| `packages/frontend/src/components/shift/ForceClockOutConfirmDialog.tsx` | component | request-response | `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` | exact |
| `packages/frontend/src/components/shift/ShiftTotalsBanner.tsx` | component | transform/presentational | `packages/frontend/src/components/admin/StatCard.tsx` | exact |
| `packages/frontend/src/components/shift/ShiftHistoryTable.tsx` | component | CRUD (read) / tabular | `packages/frontend/src/components/admin/AdminSalesTable.tsx` | role-match |
| `packages/frontend/src/components/shift/AdminShiftTabs.tsx` | component | UI state / transform | `AuthenticatedLayout.tsx` `NavLink` active/inactive class-switch pattern | partial-match (no direct tab-bar precedent) |
| `packages/frontend/src/pages/ShiftHistoryPage.tsx` | component (page) | request-response | `packages/frontend/src/pages/SalesPage.tsx` (header + table container shell) | role-match |
| `packages/frontend/src/pages/AdminShiftsPage.tsx` | component (page) | request-response + polling | `packages/frontend/src/pages/DashboardPage.tsx` (admin page + StatCard banner) + `SalesFilterBar.tsx` (native date input) + `AdminSalesTable.tsx` (table) | role-match (composite) |
| `packages/frontend/src/layouts/AuthenticatedLayout.tsx` | component (layout) | — | itself (modify) | exact |
| `packages/frontend/src/pages/SalesPage.tsx` | component (page) | request-response | itself (modify) | exact |
| `packages/frontend/src/router/index.tsx` | route config | — | itself (modify) | exact |
| `packages/backend/src/middleware/requireRole.ts` | middleware | — | itself (reference only, no modification) | exact |
| Polling behavior (`refetchInterval` on AdminShiftsPage) | — | pub-sub/polling | none in codebase | no analog |

---

## Pattern Assignments

### `packages/backend/prisma/schema.prisma` (model, CRUD)

**Analog:** `Receiver` model + `Sale.receiverId` FK addition (Phase 5 precedent — full file already read, lines 102-153 shown below)

**Receiver model to clone structure from** (lines 102-116):
```prisma
model Receiver {
  id             Int          @id @default(autoincrement())
  organizationId Int
  organization   Organization @relation(fields: [organizationId], references: [id])
  name           String       @db.VarChar(255)
  accountNumber  String?      @db.VarChar(100)
  isActive       Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  sales Sale[]

  @@index([organizationId, isActive])
  @@map("receivers")
}
```

**New `Shift` model — follow this exact style** (organizationId + userId FK, nullable clockOutAt, no `isActive` since Shift has no soft-delete concept per D-01/CONTEXT.md, timestamps):
```prisma
model Shift {
  id             Int          @id @default(autoincrement())
  organizationId Int
  organization   Organization @relation(fields: [organizationId], references: [id])
  userId         Int
  user           User         @relation(fields: [userId], references: [id])
  clockInAt      DateTime     @default(now())
  clockOutAt     DateTime?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  sales Sale[]

  @@index([organizationId, userId])
  @@index([organizationId, clockInAt])
  @@map("shifts")
}
```
Add `shifts Shift[]` relation array to `Organization` (mirrors `receivers Receiver[]` on line 45) and to `User` (mirrors `salesCreated`/`salesEdited` arrays on lines 62-63, needs a named relation e.g. `Shift[]` with no ambiguity since `User` has only one shift relation, unlike Sale's dual `createdBy`/`lastEditedBy`).

**`Sale.shiftId` FK addition — mirror the `receiverId` FK pattern** (schema.prisma lines 130-132):
```prisma
receiverId           Int
receiver             Receiver     @relation(fields: [receiverId], references: [id])
receiverNameSnapshot String       @db.VarChar(255)
```
New nullable equivalent on `Sale` (D-02: nullable because pre-Phase-7 rows have no shift context — no snapshot fields needed since `Shift` is not renamed/mutated like Product/Mop/Receiver):
```prisma
shiftId Int?
shift   Shift? @relation(fields: [shiftId], references: [id])
```
Add index: `@@index([organizationId, shiftId])` alongside the existing `@@index([organizationId, receiverId])` (line 150).

**Critical:** `Shift` has NO `isActive` boolean and is NOT added to the `softDeleteFilter` `$extends` block in `packages/backend/src/lib/prisma.ts` — shifts are never soft-deleted, `clockOutAt: null` already represents "still open" (CLAUDE.md Rule 3 note: no delete concept applies here, per CONTEXT.md D-01).

---

### `packages/backend/src/routes/shifts.ts` (route/controller, CRUD + request-response)

**Analogs:** `packages/backend/src/routes/sales.ts` (transactional create + FK validation), `packages/backend/src/routes/receivers.ts` (toggle-style single-field update for clock-out), `packages/backend/src/routes/admin.ts` (UTC `$queryRaw` date-window pattern for admin shifts-by-date)

**Imports pattern** (sales.ts lines 1-6):
```typescript
import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/requireRole.js';
import type { PrismaTransactionClient } from '../lib/prisma.js';
```

**Router mounting style — NOT role-gated at router level, mixed per-route like `sales.ts`** (sales.ts lines 7-10):
```typescript
export const salesRouter = Router();
// salesRouter does NOT mount requireRole at router level — GET / and POST / are open
// to all authenticated users. requireRole('admin') is applied per-route on void and audit.
```
`shiftsRouter` should follow the same mixed pattern: clock-in/clock-out/current/history are open to any authenticated user (moderator-only in practice per D-05, but not enforced by `requireRole` since admins simply never call them); `requireRole('admin')` applied per-route to the admin shifts-by-date and force-clock-out endpoints (sales.ts lines 515-518 shows the exact per-route gating syntax):
```typescript
salesRouter.post(
  '/:id/void',
  requireRole('admin'),
  voidSaleValidation,
  async (req: Request, res: Response) => { ... },
);
```

**One-open-shift-per-moderator enforcement — clone the transactional lookup+create pattern from sales.ts POST** (sales.ts lines 153-226, condensed):
```typescript
const sale = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
  // tx does NOT inherit $extends softDeleteFilter — explicit where clauses required
  const product = await tx.product.findFirst({
    where: { id: Number(productId), organizationId: req.session.organizationId!, isActive: true },
  });
  if (!product) {
    throw Object.assign(new Error('Product not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  // ... create with all denormalized/session fields
}, { timeout: 5000, maxWait: 3000 });
```
Clock-in equivalent (D-01: reject/no-op into returning existing open shift instead of throwing):
```typescript
shiftsRouter.post('/clock-in', async (req: Request, res: Response) => {
  const existing = await prisma.shift.findFirst({
    where: { organizationId: req.session.organizationId!, userId: req.session.userId!, clockOutAt: null },
  });
  if (existing) {
    res.status(200).json(serializeShift(existing)); // no-op — return existing open shift, not an error
    return;
  }
  const shift = await prisma.shift.create({
    data: { organizationId: req.session.organizationId!, userId: req.session.userId! },
  });
  res.status(201).json(serializeShift(shift));
});
```

**Clock-out / force-clock-out — mirror the `receivers.ts` toggle-by-id pattern** (receivers.ts lines 118-143, single-field flip after existence check):
```typescript
receiversRouter.patch(
  '/:id/toggle',
  [param('id').isInt({ min: 1 }).withMessage('Invalid receiver ID')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }
    const id = Number(req.params.id);
    const current = await prisma.receiver.findFirst({
      where: { id, organizationId: req.session.organizationId!, isActive: undefined },
      select: { isActive: true },
    });
    if (!current) {
      res.status(404).json({ error: 'RECEIVER_NOT_FOUND' });
      return;
    }
    const receiver = await prisma.receiver.update({
      where: { id, organizationId: req.session.organizationId! },
      data: { isActive: !current.isActive },
    });
    res.json(serializeReceiver(receiver));
  },
);
```
Clock-out (moderator, own shift — no `requireRole`, must additionally verify `userId` ownership) and force-clock-out (admin, `requireRole('admin')`, no ownership check — any moderator's shift) both follow this shape: existence check → `update({ data: { clockOutAt: new Date() } })` → serialize.

**Admin shifts-by-date — clone the UTC `$queryRaw` date-window pattern from `admin.ts`** (admin.ts lines 76-82, 112-120):
```typescript
prisma.$queryRaw<[{ count: bigint }]>`
  SELECT COUNT(*) AS count
  FROM sales
  WHERE organizationId = ${organizationId}
    AND status = 'active'
    AND DATE(createdAt) = CURDATE()
`
```
For "shifts starting on `selectedDate`" use `DATE(clockInAt) = ${selectedDate}` (parameterized, not `CURDATE()`, since the admin picks an arbitrary date) via `prisma.$queryRaw` or `prisma.shift.findMany` + in-memory date filtering (Prisma cannot filter by `DATE()` expression directly — same limitation noted in admin.ts line 22: "Prisma groupBy cannot group by a DATE() expression"). Recommend `$queryRaw` for the moderator-tab-list query, mirroring admin.ts's comment convention:
```typescript
// NOTE: $queryRaw is required — Prisma cannot filter by DATE(clockInAt) expression directly.
// organizationId comes from req.session (server-controlled), not user input.
```
Per-moderator merge (D-15: multiple clock sessions same day → one tab) requires grouping shift records by `userId` after the date-window query — no direct precedent in codebase; plan a `GROUP BY userId` or in-memory `Map<userId, Shift[]>` reduction after the raw query returns rows.

**Validation array pattern** (sales.ts lines 97-116):
```typescript
const createSaleValidation = [
  body('productId').isInt({ min: 1 }).withMessage('Product is required'),
  ...
];
const voidSaleValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid sale ID'),
];
```
Apply the same `express-validator` array + `validationResult(req)` check at the top of every route handler (every analog route in `sales.ts` and `receivers.ts` repeats this exact 5-line block).

**Serializer pattern** (sales.ts lines 16-54, receivers.ts lines 12-30) — `.toISOString()` for all `DateTime` fields, explicit shape (never spread the raw Prisma object):
```typescript
function serializeShift(s: { id: number; organizationId: number; userId: number; clockInAt: Date; clockOutAt: Date | null }) {
  return {
    id: s.id,
    organizationId: s.organizationId,
    userId: s.userId,
    clockInAt: s.clockInAt.toISOString(),
    clockOutAt: s.clockOutAt ? s.clockOutAt.toISOString() : null,
  };
}
```

---

### `packages/backend/src/routes/sales.ts` (route/controller, CRUD — MODIFY)

**Analog:** itself — the existing `receiverId` FK-lookup-at-creation pattern (Phase 5) is the direct precedent for adding `shiftId` lookup

**POST `/` handler — extend the transaction to look up the moderator's active shift** (sales.ts lines 153-226, `receiverId` block at lines 177-186 is the exact shape to replicate for `shiftId`):
```typescript
const receiver = await tx.receiver.findFirst({
  where: {
    id: Number(receiverId),
    organizationId: req.session.organizationId!,
    isActive: true, // explicit — $extends NOT active in tx
  },
});
if (!receiver) {
  throw Object.assign(new Error('Receiver not found'), { statusCode: 404, code: 'NOT_FOUND' });
}
```
Shift equivalent (D-03: Add Row requires an active shift — reject with 4xx if none open, do NOT auto-create):
```typescript
const activeShift = await tx.shift.findFirst({
  where: { organizationId: req.session.organizationId!, userId: req.session.userId!, clockOutAt: null },
});
if (!activeShift) {
  throw Object.assign(new Error('No active shift'), { statusCode: 400, code: 'NO_ACTIVE_SHIFT' });
}
```
Then include `shiftId: activeShift.id` in the `tx.sale.create({ data: { ... } })` call (sales.ts line 189-204), alongside the existing `receiverId`/`receiverNameSnapshot` fields. No snapshot column needed for shift (unlike product/mop/receiver) since `Shift` is never renamed.

**GET `/` — add optional shift-scoping query param** (sales.ts lines 122-131 is the base to extend):
```typescript
salesRouter.get('/', async (req, res) => {
  const sales = await prisma.sale.findMany({
    where: {
      organizationId: req.session.organizationId!,
      status: { in: ['active', 'void'] }, // override $extends default — include voided rows (SALES-15)
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(sales.map(serializeSale));
});
```
D-11 shift-scoped variant adds `shiftId: Number(req.query.shiftId)` to the `where` clause when a `shiftId` (or `current`) query param is present — follow the same `where` object-spread convention already used for `status`.

**`serializeSale` — add `shiftId`** to the returned shape (sales.ts lines 16-54) alongside `receiverId` (same nullable-passthrough, no `.toFixed()`/`.toISOString()` needed since it's a plain nullable int).

---

### `packages/backend/src/app.ts` (config, wiring — MODIFY)

**Analog:** itself — existing router-mount block

**Mounting pattern** (app.ts, protected-router section):
```typescript
protectedRouter.use('/receivers', receiversRouter); // admin-only (receiversRouter mounts requireRole internally)
protectedRouter.use('/sales', salesRouter); // all authenticated users (role checks per-route)
protectedRouter.use('/admin', adminRouter); // admin-only (adminRouter mounts requireRole internally)
```
Add `protectedRouter.use('/shifts', shiftsRouter); // mixed — moderator clock endpoints open, admin endpoints role-gated per-route` in the same block, plus the corresponding `import { shiftsRouter } from './routes/shifts.js';` at the top (mirrors the existing import list exactly, `.js` extension required per ESM convention already used for every other router import).

---

### `packages/shared/src/types/shift.ts` (shared type — NEW)

**Analog:** `packages/shared/src/types/receiver.ts` (exact structural match — simple entity type, ISO string dates)

**Full analog file to clone the shape of**:
```typescript
export interface Receiver {
  id: number;
  organizationId: number;
  name: string;
  accountNumber: string | null;
  isActive: boolean;
  createdAt: string;  // ISO 8601 UTC string
  updatedAt: string;
}
```
`Shift` equivalent:
```typescript
export interface Shift {
  id: number;
  organizationId: number;
  userId: number;
  clockInAt: string;   // ISO 8601 UTC string
  clockOutAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```
Also extend `packages/shared/src/types/sale.ts`'s `Sale` interface with `shiftId: number | null;` (mirrors the existing `receiverId: number;` field addition precedent from Phase 5 — same file, same convention). Register the new type in `packages/shared/src/types/index.ts` barrel export (follow whatever export style the barrel already uses for `receiver.ts`).

---

### `packages/frontend/src/stores/shiftStore.ts` (store — NEW)

**Analog:** `packages/frontend/src/stores/salesEditStore.ts` (exact match — Zustand overlay-state pattern)

**Full pattern to clone** (salesEditStore.ts entire file, 56 lines):
```typescript
import { create } from 'zustand';

interface SalesEditState {
  isVoidDialogOpen: boolean;
  voidTargetSaleId: number | null;
  // ...
  openVoidDialog: (saleId: number) => void;
  closeVoidDialog: () => void;
}

export const useSalesEditStore = create<SalesEditState>()((set) => ({
  isVoidDialogOpen: false,
  voidTargetSaleId: null,
  openVoidDialog: (saleId) => set({ isVoidDialogOpen: true, voidTargetSaleId: saleId }),
  closeVoidDialog: () => set({ isVoidDialogOpen: false, voidTargetSaleId: null }),
}));
```
`shiftStore.ts` shape per UI-SPEC.md §Component File Map:
```typescript
import { create } from 'zustand';

interface ShiftState {
  isClockOutDialogOpen: boolean;
  isForceClockOutDialogOpen: boolean;
  forceClockOutTarget: { shiftId: number; username: string } | null;
  openClockOutDialog: () => void;
  closeClockOutDialog: () => void;
  openForceClockOutDialog: (target: { shiftId: number; username: string }) => void;
  closeForceClockOutDialog: () => void;
}

export const useShiftStore = create<ShiftState>()((set) => ({
  isClockOutDialogOpen: false,
  isForceClockOutDialogOpen: false,
  forceClockOutTarget: null,
  openClockOutDialog: () => set({ isClockOutDialogOpen: true }),
  closeClockOutDialog: () => set({ isClockOutDialogOpen: false }),
  openForceClockOutDialog: (target) => set({ isForceClockOutDialogOpen: true, forceClockOutTarget: target }),
  closeForceClockOutDialog: () => set({ isForceClockOutDialogOpen: false, forceClockOutTarget: null }),
}));
```
Note salesEditStore.ts's trailing synchronous getter export (line 54-55) is NOT required unless a non-React consumer needs it — no current Phase 7 usage calls for it, but the pattern exists if needed: `export const getShiftState = () => useShiftStore.getState();`

---

### `packages/frontend/src/components/shift/ClockControl.tsx` (component — NEW)

**Analogs:** `AuthenticatedLayout.tsx` username/logout block (structural shell + insertion point) and `VoidConfirmDialog.tsx` (pessimistic mutation + query invalidation pattern for the Clock In button specifically, which has no confirm dialog per D-09)

**Shell to mirror** (AuthenticatedLayout.tsx lines 59-69):
```tsx
<div className="px-4 py-4 border-t border-gray-200">
  <p className="text-sm text-gray-500 mb-2 truncate">{user?.username}</p>
  <button
    type="button"
    onClick={handleLogout}
    className="text-sm text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
  >
    Log Out
  </button>
</div>
```

**Mutation + pessimistic disable + invalidate pattern** (VoidConfirmDialog.tsx lines 1-20, adapted for a direct button instead of a dialog):
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/axios';

const clockInMutation = useMutation({
  mutationFn: () => api.post('/shifts/clock-in').then((r) => r.data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['current-shift'] });
  },
});
```
Button disables via `disabled={clockInMutation.isPending}` (same as VoidConfirmDialog's `disabled={isPending}` on its confirm button), label swaps `'Clock In'` / `'Clocking In...'` — same ternary shape as VoidConfirmDialog line 45: `{isPending ? 'Voiding...' : 'Void Row'}`.

**Data source** — `useQuery<CurrentShift | null>({ queryKey: ['current-shift'], queryFn: ... })`, same `useQuery` call shape already used in `SalesPage.tsx` lines 14-17.

**Role gating** — mirrors the existing `user?.role === 'admin' && <AuditDrawer />` conditional-render pattern in `SalesPage.tsx` line 74: render `<ClockControl />` only `{user?.role === 'moderator' && <ClockControl />}`.

---

### `packages/frontend/src/components/shift/ClockOutConfirmDialog.tsx` (component — NEW)

**Analog:** `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` — full file is the direct clone basis (60 lines, already read in full above)

**Entire structure to clone**, changing: title `"Void Row"` → `"Clock Out"`, mutation endpoint `/sales/${id}/void` → `/shifts/clock-out`, confirm button color `bg-red-600` → `bg-blue-600` (D-09/Color clarification: moderator's own clock-out is NOT destructive), invalidated query keys `['sales']`/`['admin-summary']` → `['current-shift']`/`['sales', 'current-shift']`:
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';
import { useShiftStore } from '../../stores/shiftStore';

export function ClockOutConfirmDialog() {
  const queryClient = useQueryClient();
  const { isClockOutDialogOpen, closeClockOutDialog } = useShiftStore();

  const clockOutMutation = useMutation({
    mutationFn: () => api.post('/shifts/clock-out').then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-shift'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'current-shift'] });
      closeClockOutDialog();
    },
  });

  const isPending = clockOutMutation.isPending;

  return (
    <Modal
      open={isClockOutDialogOpen}
      onClose={isPending ? undefined : closeClockOutDialog}
      title="Clock Out"
      footer={
        <>
          <button type="button" onClick={closeClockOutDialog} disabled={isPending}
            className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-md text-sm font-normal hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
            Stay Clocked In
          </button>
          <button type="button" disabled={isPending} onClick={() => clockOutMutation.mutate()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {isPending ? 'Clocking Out...' : 'Clock Out'}
          </button>
        </>
      }
    >
      <p className="text-sm font-normal text-gray-900">
        Are you sure you want to clock out? Your shift will end and your Sales Sheet will reset until you clock in again.
      </p>
      {clockOutMutation.isError && (
        <p className="text-sm font-normal text-red-600 mt-2">Failed to clock out. Please try again.</p>
      )}
    </Modal>
  );
}
```

---

### `packages/frontend/src/components/shift/ForceClockOutConfirmDialog.tsx` (component — NEW)

**Analog:** `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` — same clone basis as `ClockOutConfirmDialog`, but keeps the destructive-red confirm button (D-16: admin overriding another user's session = same class as Void)

**Diff from VoidConfirmDialog**: mutation target `/admin/shifts/${shiftId}/force-clock-out`, store field `forceClockOutTarget: { shiftId, username }` interpolated into body copy, invalidates the admin shifts query for the currently selected date (not `['sales']`):
```typescript
const forceClockOutMutation = useMutation({
  mutationFn: (shiftId: number) => api.post(`/admin/shifts/${shiftId}/force-clock-out`).then((r) => r.data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-shifts'] }); // broad invalidate covers all selectedDate keys
    closeForceClockOutDialog();
  },
});
```
Confirm button retains VoidConfirmDialog's exact `bg-red-600 hover:bg-red-700` styling (lines 39-46 of VoidConfirmDialog) unchanged — this is the one dialog in Phase 7 that keeps the destructive-red treatment.

---

### `packages/frontend/src/components/shift/ShiftTotalsBanner.tsx` (component — NEW)

**Analog:** `packages/frontend/src/components/admin/StatCard.tsx` (full file, 22 lines — exact structural clone) + `DashboardPage.tsx` grid usage (lines 151-162) for the two-card grid wrapper

**StatCard.tsx to clone**:
```tsx
interface StatCardProps {
  label: string;
  value: string;
  loading?: boolean;
}

export function StatCard({ label, value, loading = false }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-6">
      <p className="text-sm font-normal text-gray-500 mb-1">{label}</p>
      {loading ? (
        <div className="animate-pulse bg-gray-200 h-8 rounded w-24" />
      ) : (
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
      )}
    </div>
  );
}
```
`ShiftTotalsBanner` wraps two of these inline (per UI-SPEC.md, not by importing `StatCard` itself — it composes its own two divs to keep `count`/`revenue` typed distinctly), using the exact grid wrapper from DashboardPage.tsx:
```tsx
<div className="grid grid-cols-2 gap-6 mb-12">
  <StatCard label="Total Sales" value={totalSalesValue} loading={summaryLoading} />
  <StatCard label="Total Revenue" value={revenueValue} loading={summaryLoading} />
</div>
```
Per UI-SPEC.md, Phase 7's grid uses `gap-6` (not `mb-12`, since it's `mb-6` per the spec's own spacing table). Revenue formatting: pure string concat `"₱" + revenue`, never `parseFloat`/`Number()` — same convention already enforced by `AdminSalesTable.tsx` line 119 comment: `// Display string as-is — NEVER parseFloat (CLAUDE.md Rule 6)`.

---

### `packages/frontend/src/components/shift/ShiftHistoryTable.tsx` (component — NEW)

**Analog:** `packages/frontend/src/components/admin/AdminSalesTable.tsx` (full file, 328 lines — react-table v8 + PaginationFooter shell; reuse table/header/row/pagination structure, drop the CSV export and Actions column since this table is read-only per D-14)

**Table shell to clone** (AdminSalesTable.tsx lines 246-326 — `useReactTable` setup, pagination state, render):
```typescript
const [pageSizeOption, setPageSizeOption] = useState<PageSizeOption>(25);
const [pageIndex, setPageIndex] = useState(0);
const effectivePageSize = pageSizeOption === 'all' ? Math.max(rows.length, 1) : pageSizeOption;
const effectivePageIndex = pageSizeOption === 'all' ? 0 : pageIndex;

const table = useReactTable({
  data: rows,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  state: { pagination: { pageIndex: effectivePageIndex, pageSize: effectivePageSize } },
  onPaginationChange: (updater) => { /* ... */ },
});
```

**Header/row markup to clone exactly** (AdminSalesTable.tsx lines 274-314 — `bg-gray-100` header, `hover:bg-gray-50` rows, `PaginationFooter` at the bottom):
```tsx
<div className="border border-gray-200 rounded-md overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id} className="bg-gray-100 border-b border-gray-200">
            {/* ... */}
          </tr>
        ))}
      </thead>
      <tbody>{/* bg-white border-b hover:bg-gray-50 rows */}</tbody>
    </table>
  </div>
  <PaginationFooter ... />
</div>
```

**Column definitions** — per UI-SPEC.md: Date, Clock In, Clock Out ("Still open" if null), Duration ("In progress" if null), Sales (count), Revenue (`"₱" + value`). Use the `ColumnDef<Shift>[]` shape from AdminSalesTable.tsx lines 103-244 as the template (accessorKey + header + cell render function per column), but with NO `actions` column (no Void/Audit buttons — read-only, mirrors D-15's read-only mandate for the admin table too).

**Empty/loading/error states** — clone AdminSalesTable.tsx lines 260-271 pattern (`if (loading) return <p>...</p>`, `if (rows.length === 0) return <div className="border ... p-8 text-center">...</div>`), with copy from UI-SPEC.md Copywriting Contract ("No shifts yet" / "Loading shift history..." / "Failed to load shift history...").

**Duration computation** — no existing precedent in codebase; new logic: `"{h}h {m}m"` from `(clockOutAt - clockInAt)` in milliseconds, guarded by `clockOutAt === null` → `"In progress"`.

---

### `packages/frontend/src/components/shift/AdminShiftTabs.tsx` (component — NEW)

**Analog (partial-match only — no exact Excel-tab precedent in codebase):** `AuthenticatedLayout.tsx` `NavLink` active/inactive class-switch pattern (lines 44-56) is the closest structural precedent for "same element, two className branches based on active state"

**Pattern to adapt** (AuthenticatedLayout.tsx):
```tsx
<NavLink
  key={item.to}
  to={item.to}
  className={({ isActive }) =>
    isActive
      ? 'flex items-center px-4 py-2 text-sm text-blue-700 bg-blue-50 border-l-2 border-blue-600 min-h-[44px]'
      : 'flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 hover:text-gray-900 min-h-[44px]'
  }
>
  {item.label}
</NavLink>
```
`AdminShiftTabs` uses the same ternary-className-by-active-state idea but with plain `<button>` elements (not `NavLink`, since tabs are in-page state not routes) and the exact class strings specified in 07-UI-SPEC.md's Color section (`ACTIVE_TAB_CLASSES`/`INACTIVE_TAB_CLASSES`, ~lines 106-110 of the UI spec). No other codebase file has a tab-bar pattern — this is genuinely new UI, built from the UI-SPEC.md contract directly rather than a code analog.

---

### `packages/frontend/src/pages/ShiftHistoryPage.tsx` (component/page — NEW)

**Analog:** `packages/frontend/src/pages/SalesPage.tsx` (header + container shell; SalesPage's `flex flex-col h-full` + header row + content pattern), simplified — no Add Row button, no overlays besides the table

**Shell to clone** (SalesPage.tsx lines 32-47, adapted — drop the button since ShiftHistoryPage has no CTA per UI-SPEC.md):
```tsx
<div className="flex flex-col h-full">
  <div className="flex items-center justify-between mb-8">
    <h1 className="text-xl font-semibold text-gray-900">Shift History</h1>
  </div>
  <ShiftHistoryTable />
</div>
```
Data fetching follows the same `useQuery` shape as SalesPage.tsx lines 14-17:
```typescript
const { data: shifts = [], isLoading, isError } = useQuery<Shift[]>({
  queryKey: ['shift-history'],
  queryFn: () => api.get<Shift[]>('/shifts/history').then((r) => r.data),
});
```

---

### `packages/frontend/src/pages/AdminShiftsPage.tsx` (component/page — NEW)

**Analogs:** `packages/frontend/src/pages/DashboardPage.tsx` (admin page shell + StatCard banner usage), `packages/frontend/src/components/admin/SalesFilterBar.tsx` (native `<input type="date">` styling — lines 78-88), `packages/frontend/src/components/admin/AdminSalesTable.tsx` (per-tab read-only sales table, reduced columns per D-15)

**Date input to clone verbatim** (SalesFilterBar.tsx lines 78-88 — this is the explicit precedent cited in 07-UI-SPEC.md's own Date Selector section):
```tsx
<div className="flex flex-col gap-1">
  <label className="text-sm font-normal text-gray-500">Date</label>
  <input
    type="date"
    value={selectedDate}
    onChange={(e) => setSelectedDate(e.target.value)}
    className="h-10 border border-gray-300 rounded-md px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
</div>
```

**Page shell + StatCard banner grid** (DashboardPage.tsx lines 151-162, reused per selected tab):
```tsx
<div className="grid grid-cols-2 gap-6 mb-6">
  <ShiftTotalsBanner count={selectedTabCount} revenue={selectedTabRevenue} loading={tabLoading} />
</div>
```

**Per-tab reduced-column table** — clone `AdminSalesTable.tsx`'s column/row rendering (lines 103-244 for columns, 273-326 for table shell) but DROP the `createdByUsername` column (lines 154-161, redundant per D-15 — the tab identifies the moderator) and the `actions` column (lines 211-241, no Void/Audit on this read-only page). Keep: Product, Price, MOP, Receiver, Notes, `updatedAt`("Date Edited"), Status — exactly the 7 columns AdminSalesTable already defines minus those two.

**Polling** — `refetchInterval: isToday ? 45000 : false` on the `useQuery` call for the admin-shifts-by-date query. **No existing codebase precedent for `refetchInterval`** — this is new to Phase 7 (D-17); implement per React Query v5 docs, no internal analog to copy from.

**requireRole('admin') enforcement** — this page is reached only via the `ProtectedRoute requiredRole="admin"` wrapper already used for `DashboardPage`/`ProductsPage`/etc. in `router/index.tsx` (see below) — frontend gating is UI-only; backend force-clock-out and admin-shifts-by-date routes independently enforce `requireRole('admin')` per `requireRole.ts`.

---

### `packages/frontend/src/layouts/AuthenticatedLayout.tsx` (MODIFY)

**Analog:** itself — full file already read above (79 lines)

**`MODERATOR_NAV`/`ADMIN_NAV` extension** (current lines 7-17):
```typescript
const ADMIN_NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/sales', label: 'Sales' },
  { to: '/products', label: 'Products' },
  { to: '/mops', label: 'MOPs' },
  { to: '/receivers', label: 'Receivers' },
  { to: '/users', label: 'Users' },
];
const MODERATOR_NAV = [{ to: '/sales', label: 'Sales Sheet' }];
```
Add `{ to: '/shifts', label: 'Shifts' }` to `ADMIN_NAV` and change `MODERATOR_NAV` to a 2-item array adding `{ to: '/shift-history', label: 'Shift History' }` — per UI-SPEC.md exact target arrays.

**ClockControl insertion point** — between the closing `</nav>` (line 57) and the existing username/logout `<div className="px-4 py-4 border-t border-gray-200">` (line 60), gated `{user?.role === 'moderator' && <ClockControl />}` (same conditional-render convention as `{user?.role === 'admin' && <AuditDrawer />}` in SalesPage.tsx).

---

### `packages/frontend/src/pages/SalesPage.tsx` (MODIFY)

**Analog:** itself — full file already read above (79 lines)

**Add Row gating** (current lines 39-47, unconditional `disabled={isAddRowOpen}`):
```tsx
<button
  type="button"
  disabled={isAddRowOpen}
  onClick={openAddRow}
  className="px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
>
  Add Row
</button>
```
Becomes (D-03): `disabled={!hasActiveShift || isAddRowOpen}` + `title={!hasActiveShift ? 'Clock in to add a new sale.' : undefined}`, where `hasActiveShift` derives from a new `useQuery(['current-shift'])` call added alongside the existing `useQuery(['sales'])` (lines 14-17).

**Query scoping** (current lines 14-17, unconditional):
```typescript
const { data: sales = [], isLoading, isError } = useQuery<Sale[]>({
  queryKey: ['sales'],
  queryFn: () => api.get<Sale[]>('/sales').then((r) => r.data),
});
```
Becomes conditional on `currentShift` (D-11/D-12: query only runs while clocked in — use `enabled: !!currentShift` React Query option, new to this codebase but standard React Query API) with a new query key `['sales', 'current-shift']`.

**Three-state empty-state block** — current single empty-state ternary at lines 61-67 (`sales.length === 0 && !isAddRowOpen`) expands into a 3-way branch (State A: not clocked in → prompt; State B: clocked in + 0 rows → existing-style empty state reworded; State C: clocked in + rows → existing `<SalesTable>`), reusing the exact `flex flex-col items-center justify-center h-full gap-2` wrapper already at lines 62-67 for both new prompt variants.

**Render `ClockOutConfirmDialog`** alongside the existing `<VoidConfirmDialog />` at line 75 (both are unconditionally rendered, controlled by their respective Zustand stores — same pattern).

---

### `packages/frontend/src/router/index.tsx` (MODIFY)

**Analog:** itself — full file already read above (67 lines)

**Moderator-accessible route addition** (current line 47, peer of `/sales`):
```tsx
{ path: '/sales', element: <SalesPage /> },
```
Add `{ path: '/shift-history', element: <ShiftHistoryPage /> }` as a sibling inside the same `children` array (outside the `requiredRole="admin"` nested route, same level as `/sales` — accessible to both roles per the `ProtectedRoute` with no `requiredRole` at that level).

**Admin-only route addition** (current lines 50-59):
```tsx
{
  element: <ProtectedRoute requiredRole="admin" />,
  children: [
    { path: '/dashboard', element: <DashboardPage /> },
    { path: '/products', element: <ProductsPage /> },
    { path: '/mops', element: <MopsPage /> },
    { path: '/receivers', element: <ReceiversPage /> },
    { path: '/users', element: <UsersPage /> },
  ],
},
```
Add `{ path: '/shifts', element: <AdminShiftsPage /> }` to this array, plus the corresponding `import { AdminShiftsPage } from '../pages/AdminShiftsPage';` and `import { ShiftHistoryPage } from '../pages/ShiftHistoryPage';` at the top (mirrors the existing import block exactly).

---

## Shared Patterns

### Pessimistic mutation + query invalidation (CLAUDE.md Rule 10)
**Source:** `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` lines 10-20
**Apply to:** `ClockControl.tsx`, `ClockOutConfirmDialog.tsx`, `ForceClockOutConfirmDialog.tsx`
```typescript
const mutation = useMutation({
  mutationFn: (arg) => api.post('/endpoint', arg).then((r) => r.data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['relevant-key'] });
    closeDialog();
  },
});
const isPending = mutation.isPending;
// disabled={isPending}, label ternary: {isPending ? 'In-flight label...' : 'Idle label'}
```

### RBAC — backend enforcement via `requireRole` (CLAUDE.md Rule 9)
**Source:** `packages/backend/src/middleware/requireRole.ts` (full file, 17 lines) + usage in `sales.ts` line 517 (`salesRouter.post('/:id/void', requireRole('admin'), ...)`) and `receivers.ts` line 9 (`receiversRouter.use(requireRole('admin'))`)
**Apply to:** `shifts.ts` — force-clock-out route and admin-shifts-by-date route both need `requireRole('admin')` applied per-route (NOT at router level, since clock-in/out/current/history on the same router are open to any authenticated user per D-05).
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
```

### organizationId scoping on every query (CLAUDE.md Rule 5)
**Source:** every `where` clause across `sales.ts`/`receivers.ts`/`admin.ts` includes `organizationId: req.session.organizationId!` — never hardcoded, never omitted.
**Apply to:** every new `Shift` query in `shifts.ts` (clock-in existence check, clock-out lookup, admin date-window query) and the new `Shift.organizationId` FK in schema.prisma.

### Money as string, never float (CLAUDE.md Rule 6)
**Source:** `sales.ts` line 40 (`priceSnapshot: sale.priceSnapshot.toFixed(2)`), `admin.ts` lines 155-161 (`toMoneyStr` helper), `AdminSalesTable.tsx` line 119 comment
**Apply to:** `ShiftTotalsBanner.tsx` revenue prop (string, `"₱" + revenue`, no `parseFloat`), and the backend shift-totals aggregation in `shifts.ts` / admin shifts query (use `.toFixed(2)` or the `toMoneyStr` duck-type helper from `admin.ts` lines 155-161 if using `$queryRaw` SUM).

### Transactional create with FK validation (CLAUDE.md Rule 2 adjacent — no audit log needed here per D-06)
**Source:** `sales.ts` POST `/` handler, lines 153-226 (`prisma.$transaction(async (tx) => { ...findFirst checks...; ...create...; return result; }, { timeout: 5000, maxWait: 3000 })`)
**Apply to:** `shifts.ts` clock-in (existence check + create, no audit log per D-06) and `sales.ts` POST modification (add active-shift lookup inside the existing transaction).

### UTC date-window queries via `$queryRaw`
**Source:** `admin.ts` lines 64-149 (`DATE(createdAt) = CURDATE()` pattern, `DATE_SUB(CURDATE(), INTERVAL 1 DAY)`, etc.) — comment at line 22 explains why: "Prisma groupBy cannot group by a DATE() expression."
**Apply to:** the admin shifts-by-date query in `shifts.ts` — use `DATE(clockInAt) = ${selectedDateParam}` instead of `CURDATE()` since the admin selects an arbitrary date, not always today.

### React Query key + invalidation convention
**Source:** `VoidConfirmDialog.tsx` line 14 (`['sales']`), `SalesPage.tsx` line 15 (`['sales']`), `AuditDrawer`/`salesEditStore` overlay pattern
**Apply to:** new query keys `['current-shift']`, `['sales', 'current-shift']`, `['shift-history']`, `['admin-shifts', selectedDate]` — each mutation's `onSuccess` invalidates exactly the keys documented in 07-UI-SPEC.md's Interaction Contracts section.

### Soft-delete / no-hard-delete (CLAUDE.md Rule 3) — explicitly N/A for Shift
**Source:** `packages/backend/src/lib/prisma.ts` `softDeleteFilter` `$extends` block (sale/user/product/mop/receiver all get automatic `isActive`/`status` injection)
**Apply to:** `Shift` model deliberately does NOT participate in this `$extends` block — it has no `isActive` field and no soft-delete concept; `clockOutAt: null` is the only "open/closed" signal needed (per CONTEXT.md D-01, this is not a soft-delete pattern at all).

---

## No Analog Found

| File/Behavior | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/frontend/src/components/shift/AdminShiftTabs.tsx` | component | UI state | No Excel-style tab bar exists anywhere in the codebase — closest precedent is `NavLink` active/inactive class switching in `AuthenticatedLayout.tsx`, but that's route-based, not in-page state. Build directly from 07-UI-SPEC.md's Color/Visual Anatomy sections. |
| `refetchInterval` polling (AdminShiftsPage) | — | pub-sub/polling | No `useQuery` call anywhere in the frontend currently uses `refetchInterval`. This is new to Phase 7 (D-17) — implement per React Query v5 API directly, no internal precedent to copy conventions from (e.g. no existing "how do we toggle polling on/off based on a condition" pattern to reference). |
| Duration computation (`"{h}h {m}m"` / "In progress") | utility | transform | No existing time-duration-formatting utility in the codebase (only `formatDateTime` for absolute timestamps in `AdminSalesTable.tsx` line 20-22). New pure function needed. |
| Per-moderator date-grouping merge (D-15: multiple shifts same day → one tab) | transform | batch | No existing "group by X then merge" backend query pattern — `admin.ts` groupBy usage groups by a single dimension for chart breakdowns, not for merging multiple child records per parent into one view. New logic needed, informed by the `$queryRaw` UTC pattern for the date filter itself. |

---

## Metadata

**Analog search scope:** `packages/backend/src/routes/`, `packages/backend/src/middleware/`, `packages/backend/prisma/schema.prisma`, `packages/backend/src/lib/prisma.ts`, `packages/backend/src/app.ts`, `packages/frontend/src/components/` (admin, sales, root), `packages/frontend/src/pages/`, `packages/frontend/src/layouts/`, `packages/frontend/src/stores/`, `packages/frontend/src/router/`, `packages/shared/src/types/`
**Files scanned:** schema.prisma, receivers.ts, sales.ts, admin.ts, requireRole.ts, app.ts, lib/prisma.ts, VoidConfirmDialog.tsx, StatCard.tsx, AdminSalesTable.tsx, AuthenticatedLayout.tsx, SalesPage.tsx, salesEditStore.ts, router/index.tsx, Modal.tsx, PaginationFooter.tsx, StatusBadge.tsx, DashboardPage.tsx, SalesFilterBar.tsx, ProductsPage.tsx (columns only), sale.ts, receiver.ts (shared types)
**Pattern extraction date:** 2026-07-18
