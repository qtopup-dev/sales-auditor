# Phase 3: Sales Core - Research

**Researched:** 2026-06-18
**Domain:** Virtual-scroll inline-edit sales table / Prisma transactional audit log
**Confidence:** HIGH (all critical claims verified against registry, codebase, and official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

| Decision ID | Decision |
|-------------|----------|
| D-01 | True dynamic row heights via `@tanstack/react-virtual` v3 `measureElement` ref callback. Notes field expands row height. `virtualizer.measureElement(node)` called on each row DOM node. Heights update after edits without losing scroll position. |
| D-02 | "Add Row" button prepends new blank row as FIRST item in virtual list. Inline form row (not modal). Explicit **Save Row** button to POST. **Cancel/Escape** dismisses. Save disabled until Product + MOP + Receiver filled. Blur does NOT auto-save new rows. |
| D-03 | Only one add-row form open at a time. While open, clicking cells on existing rows is blocked. |
| D-04 | True cell-by-cell inline editing. Blur triggers `PATCH /api/sales/:id`. Cell disabled + save indicator during round-trip. One cell active at a time. |
| D-05 | Zustand `salesEditStore` shape: `{ activeCellSaleId, activeCellField, draftValue, isPending, isAddRowOpen, openAuditSaleId, isVoidDialogOpen, voidTargetSaleId }`. Isolated from React Query. |
| D-06 | Editable cells per role: moderator can edit Product, MOP, Receiver, Notes on own rows (canEdit=true). Admin edits any field any row. Price always read-only. Date Edited auto-timestamp. Voided rows: no cells editable. |
| D-07 | Sales routes at `/api/sales` on protectedRouter: GET (all), POST (create), PATCH /:id (edit field), POST /:id/void (admin), GET /:id/audit (admin). |
| D-08 | Snapshots written at creation; never re-query catalog for display. When productId PATCHed, refresh productNameSnapshot + priceSnapshot atomically. |
| D-09 | Field-level PATCH: `{ field, value }`. One Prisma transaction per PATCH: read old → write new + audit. No batched multi-field updates. |
| D-10 | Actions column rightmost. Admin: Void button + Audit button. Void confirmation dialog uses Modal.tsx. |
| D-11 | Voided rows: strikethrough styling (`line-through`), `bg-red-50` row background, "Void" badge in actions column. Not editable. |
| D-12 | Audit drawer: slide-in 400px panel right side. Shows AuditLog entries for that sale, newest-first. Triggered by Audit button. |
| D-13 | Audit drawer read-only. Admin only (GET /api/sales/:id/audit returns 403 for moderators). Moderators do NOT see the Audit button. |
| D-14 | RBAC server-side: POST /api/sales (any authed), PATCH /:id (own row + canEdit=true OR admin), POST /:id/void (admin only), GET /:id/audit (admin only). |
| D-15 | Voided rows visible to all authenticated users but not editable. |
| D-16 | `SalesPage.tsx` placeholder replaced with full virtual-scroll table. `react-select` v5 for Product and MOP combos. |
| D-17 | React Query key `['sales']`. Invalidated after every POST, PATCH, void mutation. Zustand for edit-mode, React Query for server state. |

### Claude's Discretion
- Exact Zustand store file name and structure (beyond D-05 shape)
- Save indicator visual treatment (spinner icon, dimmed cell, disabled border style)
- Exact column widths for the sales table
- Whether a skeleton loader or simple "Loading..." text shows while sales fetch
- Exact Tailwind classes for strikethrough styling on voided rows
- Audit drawer animation (slide vs fade)
- Whether void confirmation uses `window.confirm()` or inline modal UI (UI-SPEC resolved: use Modal.tsx)

### Deferred Ideas (OUT OF SCOPE)
- Keyboard tab-navigation across rows (v2)
- Global audit log feed across all rows (v2)
- Audit logging for admin actions on products/MOPs/users (v2)
- Bulk CSV import of sales rows (v2)
- Filter/search within the sales sheet (Phase 4)
- Server-sent events / live reload (v2)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SALES-01 | Sales sheet displays rows newest-first | GET /api/sales ORDER BY createdAt DESC; React Query ['sales'] pattern |
| SALES-02 | Table uses virtual scroll for large row counts | @tanstack/react-virtual v3 useVirtualizer with getVirtualItems |
| SALES-03 | Row heights expand dynamically for Notes content | measureElement ref callback with data-index attribute |
| SALES-04 | Moderator can click "Add Row" to prepend blank input row | Sentinel `isNewRow` item prepended to data array; measured by virtualizer |
| SALES-05 | Moderator can click any editable cell to edit inline | display span → input/textarea state machine; Zustand tracks active cell |
| SALES-06 | Cell saves on blur; disabled during round-trip | isPending in salesEditStore; PATCH on blur; react-select: change fires PATCH immediately |
| SALES-07 | Row contains: Product, Price, MOP, Receiver, Notes, Date Edited | All from Sale model; Price and Date Edited read-only |
| SALES-08 | Product column is searchable combo box (active only) | AsyncSelect with loadOptions → GET /api/products?active=true; menuPortalTarget |
| SALES-09 | Price auto-populates from product, read-only | priceSnapshot column; price derived from product selection in Add Row form |
| SALES-10 | MOP column is searchable combo box (active only) | AsyncSelect with loadOptions → GET /api/mops?active=true; menuPortalTarget |
| SALES-11 | Receiver is required free-text | input type="text" required; express-validator notEmpty |
| SALES-12 | Notes optional free-text; long content expands row | textarea with auto-height; measureElement re-called after blur |
| SALES-13 | Date Edited auto-updates on create/edit | updatedAt managed by Prisma @updatedAt; returned as ISO string |
| SALES-14 | Product + MOP + Receiver required for save | Save button disabled in Add Row form until all three filled |
| SALES-15 | Voided rows visible with strikethrough | status filter includes 'void' in GET /api/sales; row bg-red-50 + line-through |
| SALES-16 | Moderator edits only their own rows (canEdit=true) | PATCH 403 if userId !== sale.createdById OR canEdit=false; backend enforced |
| SALES-17 | Inactive products/MOPs hidden from combos on new rows | loadOptions: GET /api/products?active=true filters by isActive=true (default) |
| SALES-18 | Responsive / usable on mobile | overflow-x-auto on table container; fixed column widths |
| AUDIT-01 | Every create/edit/void logged with user, field, old, new, type, timestamp | AuditLog records written in same $transaction as data mutation |
| AUDIT-02 | Audit records written in same DB transaction as mutation | Prisma $transaction(async (tx) => { tx.sale.update + tx.auditLog.create }) |
| AUDIT-03 | Admin views per-row audit log via drawer | GET /api/sales/:id/audit; AuditDrawer component; admin-only |
| ROLES-03 | Moderator with canEdit=true can edit own rows | Backend PATCH check: userId === createdById AND canEdit=true |
| ROLES-04 | Moderator without canEdit can only create, not edit | Same PATCH check; canEdit=false → 403 |
| ROLES-05 | Admin can edit any row | Backend PATCH check: role==='admin' bypasses ownership check |
| ROLES-06 | Only admin can void | POST /api/sales/:id/void uses requireRole('admin') or inline check |
| PROD-05 | Inactive products hidden from Product combo | loadOptions hits /api/products → $extends default isActive=true filter |
| PAY-05 | Inactive MOPs hidden from MOP combo | loadOptions hits /api/mops → $extends default isActive=true filter |
</phase_requirements>

---

## Summary

Phase 3 delivers the core sales data entry workflow. The two hardest technical problems are: (1) the virtual-scroll table with dynamic row heights wired to inline-edit cells, and (2) the Prisma interactive transaction pattern that atomically writes audit records alongside every mutation.

The virtual scroll uses `@tanstack/react-virtual` v3's `measureElement` ref callback — each row's root DOM node carries `data-index` and `ref={virtualizer.measureElement}`, causing the virtualizer to re-measure actual heights via `ResizeObserver`. The inner container height is `virtualizer.getTotalSize()px` and rows are positioned `position:absolute; transform:translateY(${virtualItem.start}px)`. This is already the pattern used by this library's official dynamic example (confirmed from API docs and source).

The transaction constraint (AUDIT-02) is handled with Prisma's interactive transaction: `prisma.$transaction(async (tx) => { ... })`. A critical pitfall is that the `tx` client inside the callback does NOT apply the project's `$extends` soft-delete filter — every query inside a transaction must include explicit `where` conditions (e.g., `status: 'active'` or `isActive: true`) rather than relying on the extension. The `PrismaTransactionClient` type is already exported from `packages/backend/src/lib/prisma.ts` for Phase 3 use.

The schema needs a migration to add denormalized username snapshot fields (`createdByUsername`, `lastEditedByUsername` on `Sale`, `userUsername` on `AuditLog`) that exist in the shared TypeScript types but are absent from `schema.prisma`. This migration is a Phase 3 prerequisite before any sale routes can be implemented.

**Primary recommendation:** Treat the Prisma schema migration as Wave 0 (prerequisite task). Build the backend routes (with transactions) before the frontend. Wire the virtual table last, after cell editing state is verified with a simple non-virtualized table first if the virtualizer pattern is unfamiliar.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sales data persistence | API/Backend | — | Prisma writes, RBAC checks, audit log — all server-side |
| Audit log atomicity | API/Backend | Database | Transaction guarantees live at DB level, enforced in Prisma routes |
| Virtual scroll rendering | Browser/Client | — | DOM measurement, ResizeObserver, scroll position management |
| Inline cell edit state | Browser/Client (Zustand) | — | Isolated from server state to prevent focus-loss bugs |
| Server state caching | Browser/Client (React Query) | — | Query invalidation after mutations; single source of truth for sale data |
| Combo box options (products/MOPs) | Browser/Client (react-select) | API/Backend | Client fetches active-only items; backend $extends filters inactive by default |
| RBAC enforcement | API/Backend | — | ROLES-09: frontend UI checks are informational only |
| Price snapshot | API/Backend | — | Backend reads product.price and writes priceSnapshot at creation |
| Audit drawer data | API/Backend + Browser | — | GET /api/sales/:id/audit; React Query; rendered in AuditDrawer component |

---

## Standard Stack

### Core — Already Installed
[VERIFIED: npm registry + packages/frontend/package.json]

| Library | Version Installed | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| `@tanstack/react-virtual` | 3.14.3 | Virtual scroll with dynamic row measurement | Only library with ResizeObserver-based dynamic height; same ecosystem as react-table |
| `@tanstack/react-table` | 8.21.3 | Headless table — column definitions, row model | Already established in Phase 2 (ProductsPage.tsx pattern) |
| `@tanstack/react-query` | 5.101.0 | Server state + mutation management | Already established; `['sales']` key follows `['products']` pattern |
| `zustand` | 5.0.14 | Edit-mode state isolated from server state | Already established (authStore.ts pattern) |
| `react-select` | 5.10.2 | Async combo boxes (Product, MOP) | Already established; `menuPortalTarget` solves overflow clipping |
| `react-hook-form` | 7.79.0 | Add Row form validation | Already established; minimal re-renders |
| `axios` | 1.18.0 | HTTP client (api singleton) | Already established; 401 interceptor for session expiry |
| `express-validator` | 7.3.2 | Backend payload validation | Already established (products.ts, auth.ts patterns) |
| `prisma` (Prisma 7) | 7.8.0 | ORM + migrations + $transaction | Already established; `$extends` soft-delete filter already wired |

No new packages to install for Phase 3.

### No New Dependencies Required
[VERIFIED: packages/frontend/package.json, packages/backend/package.json]

All required libraries are already installed from Phases 1 and 2. Phase 3 is purely implementation — no `npm install` steps needed.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  └─ SalesPage.tsx
       ├─ salesEditStore (Zustand) ──────────── edit-mode state
       │    └─ { isAddRowOpen, activeCellSaleId, activeCellField,
       │         draftValue, isPending, openAuditSaleId,
       │         isVoidDialogOpen, voidTargetSaleId }
       │
       ├─ useQuery(['sales']) ──────────────── server state
       │    └─ GET /api/sales
       │
       ├─ SalesTable.tsx (react-table + react-virtual)
       │    ├─ parentRef → fixed-height div (overflow-auto)
       │    ├─ innerDiv height = virtualizer.getTotalSize()
       │    └─ virtualizer.getVirtualItems().map → rows
       │         ├─ position: absolute; transform: translateY(start)
       │         ├─ data-index={virtualItem.index}
       │         ├─ ref={virtualizer.measureElement}  ← ResizeObserver
       │         ├─ AddRowForm (when isNewRow sentinel)
       │         └─ EditableCell (per data cell)
       │
       ├─ AuditDrawer.tsx
       │    └─ useQuery(['sales', saleId, 'audit'])
       │         └─ GET /api/sales/:id/audit
       │
       └─ VoidConfirmDialog.tsx
            └─ wraps Modal.tsx

Express (protectedRouter + requireAuth)
  └─ salesRouter
       ├─ GET  /api/sales          → all rows, newest-first (status: in [active, void])
       ├─ POST /api/sales          → create + audit 'create' [same $transaction]
       ├─ PATCH /api/sales/:id     → edit field + audit 'update' [same $transaction]
       ├─ POST /api/sales/:id/void → void + audit 'void' [same $transaction] [admin only]
       └─ GET  /api/sales/:id/audit → audit entries for sale [admin only]

Prisma 7 → MySQL 8.4 (UTC)
  ├─ Sale (productNameSnapshot, priceSnapshot, mopNameSnapshot,
  │         createdByUsername*, lastEditedByUsername*)   *migration required
  └─ AuditLog (userUsername*)                            *migration required
```

### Recommended Project Structure

```
packages/backend/src/routes/
└─ sales.ts                   # salesRouter: all 5 endpoints

packages/frontend/src/
├─ pages/
│   └─ SalesPage.tsx          # Replace placeholder; host drawer + void dialog state
├─ components/sales/
│   ├─ SalesTable.tsx         # react-table + react-virtual; row virtualization
│   ├─ AddRowForm.tsx         # Sentinel row (isNewRow); react-hook-form; react-select
│   ├─ EditableCell.tsx       # display → input → saving state machine
│   ├─ AuditDrawer.tsx        # Slide-in panel; useQuery(['sales', id, 'audit'])
│   └─ VoidConfirmDialog.tsx  # Wraps Modal.tsx
└─ stores/
    └─ salesEditStore.ts      # Zustand v5 edit-mode store

packages/backend/prisma/
└─ migrations/
    └─ [timestamp]_add_username_snapshots/  # Prerequisite migration
```

### Pattern 1: Prisma Interactive Transaction (AUDIT-02 Hard Constraint)

**What:** Every sale mutation writes an AuditLog record in the same DB transaction.
**When to use:** POST /api/sales, PATCH /api/sales/:id, POST /api/sales/:id/void

```typescript
// Source: prisma.io/docs/orm/prisma-client/queries/transactions (verified)
// CRITICAL: tx client does NOT inherit $extends softDeleteFilter — use explicit where clauses

import { prisma, PrismaTransactionClient } from '../lib/prisma.js';

// PATCH /api/sales/:id — field-level update + audit
const result = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
  // Step 1: Fetch current value (for oldValue in audit log)
  // MUST include explicit where filters — tx does NOT apply $extends
  const sale = await tx.sale.findFirst({
    where: {
      id: saleId,
      organizationId: req.session.userId!, // org check
      status: 'active',                    // explicit! $extends NOT active in tx
    },
    select: { [field]: true, createdById: true },
  });
  if (!sale) throw Object.assign(new Error('Not found'), { statusCode: 404, code: 'NOT_FOUND' });

  // Step 2: RBAC ownership check (D-14) — inside transaction for atomicity
  const canMutate =
    (sale.createdById === req.session.userId && user.canEdit) ||
    req.session.role === 'admin';
  if (!canMutate) throw Object.assign(new Error('Forbidden'), { statusCode: 403, code: 'FORBIDDEN' });

  // Step 3: Write new value
  const updated = await tx.sale.update({
    where: { id: saleId },
    data: {
      [field]: newValue,
      lastEditedById: req.session.userId,
      lastEditedByUsername: user.username, // denormalized snapshot
    },
  });

  // Step 4: Write audit record in same transaction (AUDIT-02)
  await tx.auditLog.create({
    data: {
      organizationId: req.session.userId!, // use org from session
      userId: req.session.userId!,
      userUsername: user.username,         // denormalized at write time
      saleId: saleId,
      tableName: 'sales',
      rowId: saleId,
      action: 'update',
      fieldName: field,
      oldValue: String(oldValue ?? ''),
      newValue: String(newValue),
    },
  });

  return updated;
});
```

**Audit values must come from Prisma return values, not raw input** (STATE.md pitfall: prevents phantom records on numeric coercion).

### Pattern 2: useVirtualizer with Dynamic Row Heights (SALES-02, SALES-03)

**What:** React Virtual v3 with `measureElement` — ResizeObserver measures actual rendered height after mount/update.
**When to use:** SalesTable.tsx rendering the full sales list

```typescript
// Source: tanstack.com/virtual (API docs verified, dynamic example verified)
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

const parentRef = useRef<HTMLDivElement>(null);

const virtualizer = useVirtualizer({
  count: rows.length,                      // total rows (including sentinel if open)
  getScrollElement: () => parentRef.current,
  estimateSize: () => 56,                  // 48px min-height + 8px padding — good default
  measureElement:
    typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
      ? (el) => el?.getBoundingClientRect().height
      : undefined,                         // Firefox exclusion: getBoundingClientRect unreliable
  overscan: 3,
});

// Scroll to top after Add Row save (new row is index 0)
// virtualizer.scrollToIndex(0, { align: 'start' });

return (
  // Fixed-height outer container — virtualizer must know scroll element height
  <div
    ref={parentRef}
    className="overflow-auto"
    style={{ height: 'calc(100vh - 120px)' }}  // fill available space
  >
    {/* Inner container sized to full virtual height */}
    <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const row = rows[virtualItem.index];
        return (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}   // REQUIRED: virtualizer looks up by this
            ref={virtualizer.measureElement} // REQUIRED: triggers measurement
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {row.isNewRow ? <AddRowForm /> : <SalesRow row={row} />}
          </div>
        );
      })}
    </div>
  </div>
);
```

**After Notes textarea blur:** call `virtualizer.measure()` to force recalculation of the row's height after text expand. The `measureElement` ref callback handles initial measurement; explicit `measure()` is needed when content changes without a remount.

### Pattern 3: Zustand v5 salesEditStore

**What:** Isolated edit-mode state, never in React Query cache. Prevents focus-loss bugs during virtual scroll redraws.
**When to use:** SalesTable, EditableCell, AddRowForm, VoidConfirmDialog, AuditDrawer

```typescript
// Source: zustand.docs.pmnd.rs/learn/guides/beginner-typescript (verified)
// Zustand v5: curried create<State>()() — already in authStore.ts
import { create } from 'zustand';

interface SalesEditState {
  // D-05 locked shape — do not change
  isAddRowOpen: boolean;
  activeCellSaleId: number | null;
  activeCellField: string | null;
  draftValue: string;
  isPending: boolean;
  openAuditSaleId: number | null;
  isVoidDialogOpen: boolean;
  voidTargetSaleId: number | null;
  // Actions — implementation discretion
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
  isAddRowOpen: false,
  activeCellSaleId: null,
  activeCellField: null,
  draftValue: '',
  isPending: false,
  openAuditSaleId: null,
  isVoidDialogOpen: false,
  voidTargetSaleId: null,
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

### Pattern 4: react-select AsyncSelect with menuPortalTarget (SALES-08, SALES-10)

**What:** Combo boxes for Product and MOP. `menuPortalTarget={document.body}` prevents dropdown clipping inside the virtual scroll overflow container.
**When to use:** AddRowForm (product + MOP fields), EditableCell (product/MOP cell in edit mode)

```typescript
// Source: react-select.com/props (verified — menuPortalTarget documented)
import AsyncSelect from 'react-select/async';

// Load active products only (PROD-05: inactive hidden from combo)
const loadProducts = async (inputValue: string) => {
  const res = await api.get<Product[]>('/products'); // $extends default: isActive=true
  return res.data
    .filter(p => p.name.toLowerCase().includes(inputValue.toLowerCase()))
    .map(p => ({ value: p.id, label: p.name, price: p.price }));
};

<AsyncSelect
  loadOptions={loadProducts}
  defaultOptions      // load all on open (small catalog — no min-char needed)
  cacheOptions         // cache results per input value
  menuPortalTarget={document.body}   // REQUIRED: prevents clipping in overflow container
  menuPosition="fixed"               // REQUIRED with menuPortalTarget
  styles={{
    control: (base) => ({ ...base, minHeight: '40px', fontSize: '14px' }),
    menu: (base) => ({ ...base, zIndex: 9999 }),   // above table, below drawer overlay
  }}
  placeholder="Select product..."
  onChange={(option) => {
    // For AddRowForm: populate Price display from option.price
    // For EditableCell: fire PATCH immediately (change = commit for selects)
    if (option) handleProductChange(option);
  }}
/>
```

**Known issue with menuPortalTarget + scroll:** The menu stays in a fixed position relative to `document.body`. When the user scrolls the table while a select menu is open, the menu stays in place visually but this is acceptable for a short-lived select interaction.

### Pattern 5: express-validator Field Allowlist for PATCH (D-09)

**What:** Validate that `{ field, value }` body only contains allowed field names.
**When to use:** `PATCH /api/sales/:id` route

```typescript
// Source: express-validator.github.io/docs/api/validation-chain/ (verified)
import { body, param, validationResult } from 'express-validator';

const ALLOWED_PATCH_FIELDS = ['productId', 'mopId', 'receiver', 'notes'] as const;

const patchSaleValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid sale ID'),
  body('field')
    .isIn(ALLOWED_PATCH_FIELDS)
    .withMessage(`Field must be one of: ${ALLOWED_PATCH_FIELDS.join(', ')}`),
  body('value')
    .exists()
    .withMessage('Value is required'),
  // Conditional: if field is 'productId' or 'mopId', value must be a positive integer string
  body('value')
    .if(body('field').isIn(['productId', 'mopId']))
    .isInt({ min: 1 })
    .withMessage('productId and mopId must be positive integers'),
  // Conditional: if field is 'receiver', value must be non-empty
  body('value')
    .if(body('field').equals('receiver'))
    .trim()
    .notEmpty()
    .withMessage('Receiver cannot be empty'),
];
```

### Pattern 6: productId PATCH — Atomic Snapshot Refresh

**What:** When productId is PATCHed, atomically refresh `productNameSnapshot` and `priceSnapshot` in the same transaction. Log separate audit entries for each changed field (or one combined entry — Claude's discretion, but the SPECIFICS note allows either).
**When to use:** PATCH /api/sales/:id when `field === 'productId'`

```typescript
// Inside $transaction callback (tx client — explicit where required)
if (field === 'productId') {
  const newProduct = await tx.product.findFirst({
    where: { id: Number(value), organizationId: req.session.organizationId!, isActive: true },
    select: { name: true, price: true },
  });
  if (!newProduct) throw Object.assign(new Error('Product not found'), { statusCode: 404 });

  await tx.sale.update({
    where: { id: saleId },
    data: {
      productId: Number(value),
      productNameSnapshot: newProduct.name,
      priceSnapshot: newProduct.price,   // Prisma Decimal — returns as Decimal object
      lastEditedById: userId,
      lastEditedByUsername: username,
    },
  });

  // Log audit entries for all three changed fields
  await tx.auditLog.createMany({
    data: [
      { ...auditBase, fieldName: 'productId', oldValue: String(oldProductId), newValue: String(value) },
      { ...auditBase, fieldName: 'productNameSnapshot', oldValue: oldProductName, newValue: newProduct.name },
      { ...auditBase, fieldName: 'priceSnapshot', oldValue: oldPrice.toFixed(2), newValue: newProduct.price.toFixed(2) },
    ],
  });
}
```

### Anti-Patterns to Avoid

- **Joining products/mops for display price:** Never join `product` table to get display price on a Sale row. Always use `priceSnapshot`. (CLAUDE.md Rule 4)
- **Using `tx.sale.findMany()` without explicit `status` filter inside transaction:** The `$extends` soft-delete filter does NOT apply inside `$transaction` callbacks. Always add `status: 'active'` (or `status: { in: [...] }`) explicitly. [VERIFIED: github.com/prisma/prisma/issues/17948 — known issue, confirmed behavior]
- **Calling `virtualizer.measureElement` on re-renders without `data-index`:** Without `data-index`, the virtualizer cannot map the element to a virtual item index. Both attributes are required.
- **Optimistic UI updates:** CLAUDE.md Rule 10 explicitly prohibits these. Always disable the cell first, then fire the mutation.
- **Storing draft values in React Query cache:** Zustand is for draft/edit state; React Query is for server-confirmed data. Mixing them causes focus loss during virtual scroll redraws (STATE.md pitfall).
- **`priceSnapshot.toNumber()` or `.toString()` for API response:** Use `.toFixed(2)` on Prisma Decimal to preserve trailing zeros. `Decimal("1000").toString()` = `"1000"` not `"1000.00"`. [VERIFIED: packages/backend/src/routes/products.ts line 14]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtual scroll / windowing | Custom scroll + DOM manipulation | `@tanstack/react-virtual` v3 | ResizeObserver integration, scroll position preservation, dynamic height measurement — edge cases are enormous |
| Dropdown clipping in overflow | Custom Portal + position calculation | `react-select` v5 `menuPortalTarget` | Handles scroll events, positioning, z-index stacking context |
| Debounced save on blur | Custom timeout/debounce logic | Blur event directly | Blur fires once; no debounce needed for blur-save. Debouncing creates partial-write race conditions |
| Manual async state machine | Custom loading/error/pending flags per cell | React Query `isPending` + Zustand `isPending` | Two clear state stores with known semantics; custom state machines duplicate their purpose |
| Raw SQL for atomic write | Manual BEGIN/COMMIT in mysql2 | Prisma `$transaction` | Prisma handles connection borrowing, rollback on throw, timeout configuration |
| Table column definitions | Custom table structure | `@tanstack/react-table` v8 | Column sizing, flexRender, cell render functions — all established in Phase 2 |

**Key insight:** The virtual scroll + inline edit combination is the most error-prone part of this phase. The cell edit state (active cell, draft value, pending) MUST live in Zustand, isolated from the React Query cache that the virtualizer reads. Conflating them causes the active input to lose focus whenever the server returns fresh data during a scroll event.

---

## Schema Migration Requirement (Wave 0 Prerequisite)

[VERIFIED: packages/backend/prisma/schema.prisma vs packages/shared/src/types/sale.ts and audit.ts]

The current `schema.prisma` is missing denormalized username snapshot fields that the shared TypeScript types already declare. Phase 3 CANNOT proceed without a migration.

### Missing Fields — `Sale` model

```prisma
// ADD to Sale model:
createdByUsername    String       @db.VarChar(100)   // denormalized at creation
lastEditedByUsername String?      @db.VarChar(100)   // null until first edit
```

### Missing Fields — `AuditLog` model

```prisma
// ADD to AuditLog model:
userUsername   String       @db.VarChar(100)   // denormalized at write time
```

### Session Extension Required

The session currently stores only `userId` and `role` (see `requireAuth.ts` SessionData). Audit log writes need `username` and `organizationId`. Two options:

**Option A (recommended):** Store `username` and `organizationId` in the session at login time. Update `auth.ts` login handler and `SessionData` augmentation.

**Option B:** Fetch user from DB at the start of each mutating sales route (`prisma.user.findFirst({ where: { id: req.session.userId } })`).

Option A is more efficient (no extra DB read per request). Option B is simpler and avoids touching auth. Both are correct. The planner should choose.

---

## Common Pitfalls

### Pitfall 1: `$extends` Soft-Delete Filter NOT Applied Inside `$transaction`

**What goes wrong:** Developer uses `tx.sale.findFirst(...)` inside a transaction expecting the soft-delete filter to inject `status: 'active'`. The filter is NOT applied because the `tx` client is the base Prisma client, not the extended client. Voided rows may be returned and mutated inadvertently.
**Why it happens:** Prisma's interactive transaction callback receives the base `PrismaClient`, not the `$extends`-wrapped client. This is a known and confirmed Prisma limitation (see github.com/prisma/prisma/issues/17948, closed in 4.16.0 for `this` binding but the query extension injection behavior differs).
**How to avoid:** Every query inside `$transaction(async (tx) => { ... })` MUST include explicit `where` conditions: `status: 'active'`, `isActive: true`, `organizationId: X`. Do not rely on the extension.
**Warning signs:** Voided sales appearing in PATCH responses; Prisma TypeScript errors if using the extended client type inside transactions.

### Pitfall 2: Missing `data-index` Attribute Breaks `measureElement`

**What goes wrong:** Rows render but the virtualizer does not update heights dynamically. All rows may appear to collapse to 0 or use `estimateSize` permanently.
**Why it happens:** `virtualizer.measureElement` uses the `data-index` attribute to map a DOM element to its virtual item index. Without `data-index`, the ResizeObserver callback cannot identify which item to update.
**How to avoid:** Every virtualized row element MUST have both `data-index={virtualItem.index}` AND `ref={virtualizer.measureElement}`. [VERIFIED: TanStack Virtual API docs]
**Warning signs:** Rows have correct content but heights are all equal; scroll jumps unexpectedly.

### Pitfall 3: React-Select Menu Clipped by Virtual Scroll Container Overflow

**What goes wrong:** Product/MOP dropdown menus are cut off or invisible when opened inside the virtual scroll container with `overflow: auto`.
**Why it happens:** The overflow container clips anything that extends beyond its bounds, including positioned menus. CSS `position: fixed` or `absolute` still gets clipped by `overflow: hidden/auto` ancestors.
**How to avoid:** Use `menuPortalTarget={document.body}` and `menuPosition="fixed"` on all `AsyncSelect` instances inside the table. This renders the menu via React Portal into `<body>`, escaping the overflow clipping context. [VERIFIED: react-select.com/props]
**Warning signs:** Dropdown menus appear truncated, partially rendered, or not visible at all.

### Pitfall 4: Draft Value in React Query Cache Causes Focus Loss

**What goes wrong:** User is actively typing in a cell. Background refetch (triggered by mutation on another cell) updates the React Query cache. The component re-renders with the server value, replacing the draft. Input loses focus or shows stale text.
**Why it happens:** React Query's `invalidateQueries` triggers a refetch, which replaces data in the cache and re-renders cells that derive their value from `queryData`.
**How to avoid:** Never derive input value from React Query cache. Store `draftValue` in Zustand `salesEditStore`. The cell input reads from `draftValue` (Zustand), not from the sale data (React Query). [VERIFIED: STATE.md §Critical Pitfalls, 03-CONTEXT.md D-05]
**Warning signs:** Active input flickers or resets while typing.

### Pitfall 5: `priceSnapshot` Display — `.toString()` Drops Trailing Zeros

**What goes wrong:** `Decimal("1000.00").toString()` returns `"1000"` not `"1000.00"`. This looks wrong in the UI and breaks price format consistency.
**Why it happens:** JavaScript Decimal's `toString()` trims trailing zeros.
**How to avoid:** Always use `.toFixed(2)` when serializing a Prisma `Decimal` field for API response. [VERIFIED: packages/backend/src/routes/products.ts `serializeProduct` pattern]
**Warning signs:** Prices like `"10"` or `"10.5"` instead of `"10.00"` or `"10.50"` in API responses.

### Pitfall 6: Audit Log Written Outside Transaction

**What goes wrong:** Sale row is updated but audit log creation fails (network timeout, constraint error). Or vice versa: audit log is written but sale update fails.
**Why it happens:** Calling `await prisma.auditLog.create(...)` outside the `$transaction` callback, after the sale update has already committed.
**How to avoid:** ALL writes in a sale mutation (update + audit create) MUST be inside the same `prisma.$transaction(async (tx) => { ... })` callback. AUDIT-02 is a hard constraint with no exceptions. [VERIFIED: CLAUDE.md Rule 2]
**Warning signs:** Audit log has entries with no corresponding sale mutation; or sale mutations with no audit entries.

### Pitfall 7: `salesRouter` Added Outside `protectedRouter`

**What goes wrong:** `app.use('/api/sales', salesRouter)` added directly to `app` instead of `protectedRouter`. Bypasses `requireAuth` middleware.
**Why it happens:** Incorrect placement in `app.ts`.
**How to avoid:** Sales routes MUST be mounted on `protectedRouter`: `protectedRouter.use('/sales', salesRouter)`. Check `packages/backend/src/app.ts` line 87. [VERIFIED: packages/backend/src/app.ts]
**Warning signs:** Sales endpoints accessible without authentication.

### Pitfall 8: Inner Cell Click Propagates to Row onClick

**What goes wrong:** Clicking a button (Void, Audit) inside a row triggers the row's `onClick` in addition to the button's handler. The void dialog opens AND the cell enters edit mode simultaneously.
**Why it happens:** Browser event bubbling propagates from button → td → tr.
**How to avoid:** Use `e.stopPropagation()` on the actions cell's `onClick` (same pattern as ProductsPage.tsx line 161). Alternatively, attach no row-level `onClick` and use explicit cell-level handlers only.
**Warning signs:** Two dialogs appear simultaneously; cell unexpectedly enters edit mode after clicking Void.

---

## Code Examples

### serializeSale Helper (backend)

```typescript
// Source: pattern from packages/backend/src/routes/products.ts serializeProduct (verified)
function serializeSale(sale: {
  id: number;
  organizationId: number;
  productId: number;
  productNameSnapshot: string;
  priceSnapshot: { toFixed: (n: number) => string };
  mopId: number;
  mopNameSnapshot: string;
  receiver: string;
  notes: string | null;
  status: 'active' | 'void';
  createdById: number;
  createdByUsername: string;
  lastEditedById: number | null;
  lastEditedByUsername: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...sale,
    priceSnapshot: sale.priceSnapshot.toFixed(2), // MUST use toFixed(2) — not toString()
    createdAt: sale.createdAt.toISOString(),
    updatedAt: sale.updatedAt.toISOString(),
  };
}
```

### serializeAuditEntry Helper (backend)

```typescript
// Source: pattern from audit.ts shared type (verified)
function serializeAuditEntry(entry: {
  id: bigint;
  organizationId: number;
  userId: number;
  userUsername: string;
  saleId: number | null;
  tableName: string;
  rowId: number;
  action: 'create' | 'update' | 'void';
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
}) {
  return {
    ...entry,
    id: Number(entry.id),   // BigInt → number (safe for JS up to 2^53 per audit.ts comment)
    createdAt: entry.createdAt.toISOString(),
  };
}
```

### GET /api/sales — Override Soft-Delete to Include Voided Rows

```typescript
// Source: established pattern from packages/backend/src/routes/products.ts (verified)
// Override $extends default by providing explicit status array
salesRouter.get('/', async (req, res) => {
  const sales = await prisma.sale.findMany({
    where: {
      organizationId: 1,
      status: { in: ['active', 'void'] }, // override $extends default — show all
    },
    orderBy: { createdAt: 'desc' },       // newest-first (SALES-01)
  });
  res.json(sales.map(serializeSale));
});
```

### React Query mutation invalidation (frontend)

```typescript
// Source: packages/frontend/src/pages/ProductsPage.tsx pattern (verified)
const queryClient = useQueryClient();

const patchMutation = useMutation({
  mutationFn: ({ saleId, field, value }: { saleId: number; field: string; value: string }) =>
    api.patch<Sale>(`/sales/${saleId}`, { field, value }).then(r => r.data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    salesEditStore.clearActiveCell();
    salesEditStore.setPending(false);
  },
  onError: () => {
    salesEditStore.setPending(false);
    // Return cell to previous value — read from React Query cache (not draft)
  },
});
```

### Virtual Scroll Table Container Height

```typescript
// Source: 03-UI-SPEC.md §Layout: SalesPage — "flex-1 min-h-0 on outer wrapper" (verified)
// AuthenticatedLayout main content is "overflow-auto p-8"
// Table container must fill remaining height without triggering outer overflow scroll

// In SalesPage.tsx:
<div className="flex flex-col h-full">
  {/* Page header */}
  <div className="flex items-center justify-between mb-8">
    <h1 className="text-xl font-semibold text-gray-900">Sales Sheet</h1>
    <button ...>Add Row</button>
  </div>

  {/* Table fills remaining height — flex-1 min-h-0 is critical for Firefox */}
  <div className="flex-1 min-h-0 border border-gray-200 rounded-md overflow-hidden">
    <SalesTable />
  </div>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `prisma.$use()` middleware | `prisma.$extends()` query extensions | Prisma 7 (removed $use) | Already handled in codebase — `lib/prisma.ts` uses $extends |
| `create<State>()(...)` (v4) | Same syntax in v5 | Zustand v5 | No change — same curried syntax (verified in authStore.ts) |
| `react-virtual` v2 `useVirtual` | `@tanstack/react-virtual` v3 `useVirtualizer` | v3.0 (2023) | `useVirtual` removed; `useVirtualizer` is the correct hook |
| Optional `measureElement` | `measureElement` + `data-index` required for dynamic heights | v3.x | Both attributes MUST be present for ResizeObserver measurement |

**Deprecated/outdated in this stack:**
- `prisma.$use()`: Removed in Prisma 7. Use `$extends` — already done.
- `useVirtual` hook: Removed in v3. Use `useVirtualizer`.
- JWT auth: Explicitly excluded per CLAUDE.md Rule 1.

---

## Open Questions

1. **Session data for username in audit logs**
   - What we know: Session stores `userId` and `role` only. Audit log writes require `username`.
   - What's unclear: Option A (store username in session at login) vs Option B (fetch user from DB per request).
   - Recommendation: Add `username` and `organizationId` to session at login (Option A). Modify `SessionData` augmentation in `requireAuth.ts`. Single extra field at login time; avoids extra DB query on every mutating route. The planner should decide and add this to the appropriate task wave.

2. **productId PATCH — audit entry count**
   - What we know: When productId changes, three fields change atomically: productId, productNameSnapshot, priceSnapshot. SPECIFICS says "log old/new values for each snapshot field in separate audit entries (or one combined entry — planner decides)."
   - Recommendation: Write 3 separate `auditLog` entries (one per changed field) using `tx.auditLog.createMany`. Keeps audit trail granular and consistent with single-field audit entry pattern.

3. **`directDomUpdates` option in useVirtualizer**
   - What we know: Newer TanStack Virtual docs mention `directDomUpdates: true` for performance (direct DOM transform instead of React state). Not confirmed whether this is stable in v3.14.3.
   - Recommendation: Use the standard `transform: translateY(${virtualItem.start}px)` approach (style prop on row div) rather than `directDomUpdates: true`. Stable, well-documented, works correctly with dynamic heights.

---

## Environment Availability

Phase 3 is purely code implementation. All external dependencies (MySQL, Node.js, npm, Prisma CLI) were verified in Phase 1. No new external dependencies are introduced.

| Dependency | Required By | Available | Version | Notes |
|------------|------------|-----------|---------|-------|
| @tanstack/react-virtual | SALES-02/03 | ✓ | 3.14.3 | Already in package.json |
| @tanstack/react-table | SALES-01 | ✓ | 8.21.3 | Already in package.json |
| zustand | D-05 | ✓ | 5.0.14 | Already in package.json |
| react-select | SALES-08/10 | ✓ | 5.10.2 | Already in package.json |
| react-hook-form | SALES-14 | ✓ | 7.79.0 | Already in package.json |
| express-validator | All backend routes | ✓ | 7.3.2 | Already in package.json |
| prisma | All backend writes | ✓ | 7.8.0 | Already installed |

No missing dependencies. No npm installs required for Phase 3.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Inherited | express-session already wired from Phase 2 |
| V3 Session Management | Inherited | requireAuth middleware on protectedRouter |
| V4 Access Control | YES | requireRole('admin') for void + audit; ownership check in PATCH |
| V5 Input Validation | YES | express-validator on all sales route bodies; field allowlist for PATCH |
| V6 Cryptography | No | No new cryptographic operations |

### Known Threat Patterns for Phase 3 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized void (moderator voids own row) | Elevation of Privilege | `requireRole('admin')` on `POST /:id/void`; server-side, not frontend-only |
| Unauthorized edit (moderator edits another's row) | Tampering | `sale.createdById === userId AND canEdit=true` check inside transaction before write |
| Field injection via PATCH body (sending `status: 'active'`) | Tampering | `ALLOWED_PATCH_FIELDS` allowlist; `body('field').isIn([...])` rejects unlisted fields |
| Integer overflow on saleId | Tampering | `param('id').isInt({ min: 1 })` rejects non-integer IDs |
| RBAC bypass via direct URL | Elevation of Privilege | All sales routes under `protectedRouter` which has `requireAuth` + individual RBAC checks |
| Audit log forgery (modifying oldValue input) | Repudiation | Audit record reads old value from DB (`tx.sale.findFirst` before update), not from request body |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `directDomUpdates: true` mode in @tanstack/react-virtual v3.14.3 is optional and not required for measureElement to work | Open Questions #3 | If required, rows may not position correctly — but the style-based transform approach is confirmed by multiple sources |
| A2 | `tx.auditLog.createMany` is available inside `$transaction` callback with Prisma 7 | Pattern 1 | Would need to call `tx.auditLog.create` multiple times instead — functionally equivalent |

---

## Sources

### Primary (HIGH confidence)
- `packages/backend/prisma/schema.prisma` — Schema fields verified directly
- `packages/frontend/package.json` — All installed versions verified
- `packages/backend/src/lib/prisma.ts` — `$extends` pattern, `PrismaTransactionClient` type export
- `packages/backend/src/routes/auth.ts` — `$transaction` usage pattern (line 151), session fields
- `packages/backend/src/routes/products.ts` — `serializeProduct`, `isActive: { in: [true, false] }` override pattern
- `packages/frontend/src/stores/authStore.ts` — Zustand v5 curried pattern
- `packages/frontend/src/components/Modal.tsx` — Modal API (onClose: undefined = locked)
- `packages/frontend/src/pages/ProductsPage.tsx` — react-table v8 patterns, useMutation, pessimistic UI
- `packages/shared/src/types/sale.ts` — Sale interface with snapshot fields
- `packages/shared/src/types/audit.ts` — AuditEntry interface with userUsername
- `packages/backend/src/middleware/requireAuth.ts` — SessionData shape (userId, role only)
- npm registry — @tanstack/react-virtual@3.14.3, @tanstack/react-table@8.21.3, zustand@5.0.14, react-select@5.10.2

### Secondary (MEDIUM confidence)
- TanStack Virtual API docs (tanstack.com/virtual/latest/docs/api/virtualizer) — measureElement, scrollToIndex signatures
- TanStack Virtual dynamic example (github.com/TanStack/virtual) — measureElement + data-index + translateY positioning pattern
- Prisma transactions docs (prisma.io/docs/orm/prisma-client/queries/transactions) — $transaction async callback pattern
- express-validator docs (express-validator.github.io/docs/api/validation-chain/) — isIn, body, param
- zustand TypeScript guide (zustand.docs.pmnd.rs/learn/guides/beginner-typescript) — create<State>()() curried pattern
- react-select props (react-select.com/props) — menuPortalTarget, menuPosition

### Tertiary (LOW confidence — flagged)
- github.com/prisma/prisma/issues/17948 (closed) — tx client $extends inheritance issue; marked LOW because resolution in 4.16.0 may or may not cover the query extension injection case in Prisma 7
- github.com/olivierwilkinson/prisma-extension-soft-delete/issues/24 — confirms extension not applied in tx; LOW because this is a third-party extension

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified from registry + package.json
- Schema migration requirement: HIGH — verified by comparing schema.prisma against shared TypeScript types
- Transaction pattern: HIGH — existing codebase uses $transaction in auth.ts; pattern confirmed
- Virtual scroll (measureElement): HIGH — confirmed from TanStack Virtual API docs; dynamic example verified
- react-select menuPortalTarget: HIGH — verified from react-select official props docs
- $extends in tx pitfall: MEDIUM — confirmed from multiple GitHub issues but exact Prisma 7 behavior for query extensions (not method extensions) not fully confirmed; safe to apply explicit where regardless

**Research date:** 2026-06-18
**Valid until:** 2026-08-18 (stable libraries; 60-day window)
