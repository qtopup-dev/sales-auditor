# Phase 13: Moderator Sales Sheet Tip Column - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** 12
**Analogs found:** 12 / 12 (all are edits to files that already contain the closest analog — the `notes`/`priceSnapshot` field pattern within the same file)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/backend/prisma/schema.prisma` | model | CRUD | `Sale.notes`/`priceSnapshot` fields (same file) | exact |
| `packages/backend/src/routes/sales.ts` (`serializeSale`, `ALLOWED_PATCH_FIELDS`, create, PATCH `notes` branch) | controller/route | CRUD | self (`notes` nullable-field branch) | exact |
| `packages/backend/src/routes/shifts.ts` (revenue aggregates) | route | CRUD (aggregate) | self (`activeSalesRevenue` via `_sum.priceSnapshot`) | exact |
| `packages/backend/src/routes/admin.ts` (dashboard summary, shifts tabs, KPI raw SQL) | route | CRUD (aggregate) | self (`_sum.priceSnapshot`, `$queryRaw SUM CASE`) | exact |
| `packages/shared` Sale type / frontend `Sale` type | model (type) | transform | existing `notes: string \| null` field | exact |
| `packages/frontend/src/components/sales/AddRowForm.tsx` | component (form) | request-response | existing Notes `<textarea>` field block | exact |
| `packages/frontend/src/components/sales/EditableCell.tsx` | component | request-response | existing `notes` text-input branch | exact |
| `packages/frontend/src/components/sales/SalesTable.tsx` | component (table) | transform | existing `priceSnapshot` (right-aligned) + `notes` column defs | exact |
| `packages/frontend/src/components/shift/ShiftTotalsBanner.tsx` | component | transform | self (`addThousandsSep`, revenue prop) | exact |
| `packages/frontend/src/components/admin/AdminSalesTable.tsx` | component (table + CSV) | transform | self (`priceSnapshot` column + `sanitizeCell` CSV row) | exact |
| `packages/frontend/src/pages/AdminShiftsPage.tsx` | component | transform | uses `ShiftTotalsBanner` — no separate pattern needed | role-match |
| `packages/frontend/src/pages/DashboardPage.tsx` | component | transform | existing Total Revenue card + `addThousandsSep`-style regex | exact |
| `packages/frontend/src/components/admin/VoidRequestsTable.tsx` | component (table) | transform | existing Price column in same table | exact |

## Pattern Assignments

### `packages/backend/prisma/schema.prisma`

**Analog:** existing `Sale.priceSnapshot Decimal @db.Decimal(10, 2)` and `notes String?` fields in the same model.

Add:
```prisma
tip Decimal? @db.Decimal(10, 2)
```
Placed near `priceSnapshot`/`notes`. Nullable per D-16. After editing, follow this project's established migration mechanics (check `.planning` history — Claude's Discretion item: verify whether the manual `db execute` + `migrate resolve` workaround is still needed for this environment).

---

### `packages/backend/src/routes/sales.ts` (controller, CRUD)

**Analog:** same file — `notes` field end-to-end (serializer → allowlist → validation → create → PATCH branch → audit).

**Serializer** (`serializeSale`, lines 16-56): add `tip` alongside `notes`:
```typescript
priceSnapshot: sale.priceSnapshot.toFixed(2), // pattern to copy for tip
...
notes: sale.notes,
```
New: `tip: sale.tip ? sale.tip.toFixed(2) : null,` — same `.toFixed(2)` rule as `priceSnapshot` (CLAUDE.md Rule 6), never `.toString()`.

**Allowlist + validation** (lines 94-104):
```typescript
const ALLOWED_PATCH_FIELDS = ['productId', 'mopId', 'receiverId', 'notes'] as const;
...
body('notes').optional().isString(),
```
Add `'tip'` to `ALLOWED_PATCH_FIELDS`. Add validation per D-13/D-14/D-15 (custom validator — no existing decimal-money field validator to copy since `priceSnapshot` is server-computed, not user-input; use `express-validator`'s `.matches(/^\d{1,8}(\.\d{1,2})?$/)` + range check, rejecting negatives/garbage per D-15, and normalize `0`/`0.00` → `null` per D-12).

**Create route** (lines 170-274): `notes` destructure/trim pattern (lines 177-182, 247):
```typescript
const { productId, mopId, receiverId, notes } = req.body as { ...; notes?: string };
...
notes: notes ? (notes as string).trim() : null,
```
Copy this shape for `tip` — parse/normalize (string → Decimal or null, `0` → null) before `tx.sale.create`.

**PATCH branch — nullable field** (lines 519-556): this is the exact analog for `tip`'s PATCH handling:
```typescript
const coercedValue: string | null =
  field === 'notes' && rawValue === '' ? null : String(rawValue);
const oldValue = String(sale[field as keyof typeof sale] ?? '');
const updated = await tx.sale.update({
  where: { id: saleId },
  data: { [field]: coercedValue, lastEditedById: ..., lastEditedByUsername: ... },
});
const newValue = String(updated[field as keyof typeof updated] ?? '');
await tx.auditLog.create({ data: { ..., fieldName: field, oldValue, newValue } });
```
For `tip` this needs: blank → `null` (like `notes`), `'0'`/`'0.00'` → `null` (D-12, new normalization not present in the `notes` branch), and audit values formatted as `.toFixed(2)` or `'(empty)'`-equivalent per D-08/D-09 rather than raw `String()` (money must never lose trailing zeros — reuse `priceSnapshot.toFixed(2)` convention, not the generic `String(sale[field])` used for `notes`).

**AuditLog create pattern** (lines 254-268, 540-553): same transaction, `tableName: 'sales'`, `action: 'update'|'create'` — no change needed, just add a `tip` audit entry through the same nullable-field branch.

---

### `packages/backend/src/routes/shifts.ts` (route, CRUD aggregate)

**Analog:** `activeSalesRevenue` computation (lines ~119, 153):
```typescript
const agg = await prisma.sale.aggregate({
  where: { ... , status: 'active' },
  _count: { _all: true },
  _sum: { priceSnapshot: true },
});
activeSalesRevenue: (agg._sum.priceSnapshot ?? 0).toFixed(2),
```
Per D-01/D-04, add `_sum: { priceSnapshot: true, tip: true }` and return both a combined total (`Decimal(priceSnapshot).add(Decimal(tip ?? 0))` — Prisma `Decimal` arithmetic, never JS float, CLAUDE.md Rule 6) and a separate tips-only sum field (discretion: name it e.g. `activeSalesTips`) for the banner's "incl. ₱X tips" line.

---

### `packages/backend/src/routes/admin.ts` (route, CRUD aggregate + raw SQL)

**Analog — Prisma aggregate** (lines 51-61, 315):
```typescript
_sum: { priceSnapshot: true },
...
totalRevenue: (revenueResult._sum.priceSnapshot ?? 0).toFixed(2),
```
Dashboard summary (D-05): add `_sum: { tip: true }`, combine via Decimal add, and return `totalTips` string alongside `totalRevenue`.

**Analog — raw SQL KPI queries** (lines 128-161, `toMoneyStr` at line 12):
```sql
SUM(CASE WHEN status = 'active' THEN priceSnapshot ELSE 0 END) AS profitSum,
SUM(CASE WHEN status = 'active' THEN priceSnapshot ELSE 0 END) AS turnoverSum
```
Per D-01/D-06: change to `SUM(CASE WHEN status = 'active' THEN priceSnapshot + COALESCE(tip, 0) ELSE 0 END)`. `toMoneyStr` (line 12 comment) already handles Decimal/string coercion from `$queryRaw` — reuse unchanged for the combined sum.

**Per-product breakdown groupBy** (near line 184, `revenue: (r._sum.priceSnapshot ?? 0).toFixed(2)`): **do not touch** — D-02 explicitly keeps this price-only.

**Shifts tabs/history** (lines ~315-342): same `_sum: { priceSnapshot: true }` aggregate pattern — add `tip` sum identically to the `shifts.ts` analog above; Shift History revenue column shows combined only (D-06), no separate tips return needed there beyond what the banner already consumes.

---

### `packages/shared` / frontend `Sale` type

**Analog:** existing `notes: string | null;` field declaration (`sales.ts` line 27 mirrors the shared/frontend type).

Add `tip: string | null;` next to `notes`/`priceSnapshot` in the shared `Sale` interface. This single type is imported by `SalesTable.tsx`, `AdminSalesTable.tsx`, `EditableCell.tsx`, `VoidRequestsTable.tsx`, `AdminShiftsPage.tsx`, `SalesCharts.tsx` — no per-file type duplication needed (all import from `@alejinput/shared`).

---

### `packages/frontend/src/components/sales/AddRowForm.tsx` (component/form, request-response)

**Analog:** the read-only Price display block (lines 172-180) for positioning/right-alignment style, and the Notes `<textarea>` block (lines 234-243) for the "optional input registered via react-hook-form" pattern.

**Price display** (lines 172-180):
```tsx
<div style={{ width: priceW, padding: '0 16px', flexShrink: 0 }} className="flex items-center justify-end">
  <span className="block text-right text-sm font-normal text-gray-400 dark:text-gray-500 pt-2">
    {priceDisplay}
  </span>
</div>
```

**Notes textarea registration** (lines 234-243):
```tsx
<div style={{ width: notesW, padding: '0 16px', flexShrink: 0 }}>
  <textarea
    disabled={isPending}
    placeholder="Notes (optional)"
    rows={1}
    {...register('notes')}
    className="w-full border border-gray-300 ... resize-none"
  />
</div>
```
New Tip field (D-07/D-11): insert a new column between Price and MOP. Per D-11 it's right-aligned like Price, so use `<input type="text" inputMode="decimal">` (not textarea) styled like the Notes input but `text-right`. Restrict keystrokes to digits/`.` (D-15) — no existing numeric-input pattern in this codebase to copy; write minimal onChange filter. Update `DEFAULT_COLUMN_WIDTHS` array and the destructured width variables (line 18, 28) to add a `tipW` slot, and update `AddRowFormData` type (lines 20-25) with `tip: string`. `createMutation` (line 124-135) posts the whole form object — no change needed beyond including `tip` in `defaultValues`.

---

### `packages/frontend/src/components/sales/EditableCell.tsx` (component, request-response)

**Analog:** the `notes` text-field branch — active state (lines 215-235), idle/display state (lines 260-288), and `handleBlur`/`patchMutation` (lines 76-125) are field-agnostic and require no change; only branch conditions need `tip` added.

**Field prop type** (line 12): add `'tip'` to the union:
```typescript
field: 'productId' | 'mopId' | 'receiverId' | 'notes';
```

**Active-state input branch** (lines 214-235, notes textarea) is the pattern for `tip`'s edit input, but per D-15 use `type="text"` with a digit/`.`-only onChange filter (mirroring the plain text-fields branch at lines 238-257) rather than a free-text textarea. Right-align per D-11 (`text-right` class addition, no existing right-aligned editable cell to copy — `priceSnapshot` in `SalesTable.tsx` is display-only, not editable).

**handleBlur / patchMutation** (lines 76-125): unchanged generic PATCH flow — `tip` flows through the same `field`/`value` PATCH body as `notes`. Backend normalization (blank/0 → null) means the frontend does not need special-case logic here beyond input filtering.

---

### `packages/frontend/src/components/sales/SalesTable.tsx` (component/table, transform)

**Analog — right-aligned Price column** (lines 21-33):
```tsx
{
  accessorKey: 'priceSnapshot',
  header: () => <span className="block text-right">Price</span>,
  size: 100,
  cell: ({ row }) => {
    const sale = row.original;
    return (
      <span className={`block text-right text-sm font-normal ${sale.status === 'void' ? 'line-through ...' : '...'}`}>
        {sale.priceSnapshot}
      </span>
    );
  },
},
```

**Analog — editable Notes column** (lines 52-60):
```tsx
{
  accessorKey: 'notes',
  header: 'Notes',
  size: 160,
  cell: ({ row }) => {
    const sale = row.original;
    return <EditableCell sale={sale} field="notes" displayValue={sale.notes ?? ''} />;
  },
},
```
New Tip column (D-11): insert in `BASE_COLUMNS` right after the Price column, before MOP. Combine both patterns — right-aligned (like Price) but editable via `EditableCell` with `field="tip"` (like Notes): `displayValue={sale.tip ?? ''}`, header right-aligned `<span className="block text-right">Tip</span>`.

---

### `packages/frontend/src/components/shift/ShiftTotalsBanner.tsx` (component, transform)

**Analog:** full file — `addThousandsSep` (lines 13-17) and the Revenue card (lines 30-38) are the exact pattern to extend.

```tsx
interface ShiftTotalsBannerProps {
  count: number;
  revenue: string; // DECIMAL string, never parsed as float (CLAUDE.md Rule 6)
  loading?: boolean;
}
function addThousandsSep(moneyStr: string): string { ... }
...
<p className="text-2xl font-semibold ...">{'₱' + addThousandsSep(revenue)}</p>
```
Per D-04: add optional `tips?: string` prop, and render a smaller secondary line under the revenue figure using the same `addThousandsSep` helper: `incl. ₱{addThousandsSep(tips)} tips`, hidden when `tips === '0.00'` (Claude's Discretion). `revenue` prop continues to receive the combined `price+tip` total from the backend (no frontend arithmetic — Rule 6).

---

### `packages/frontend/src/components/admin/AdminSalesTable.tsx` (component/table + CSV, transform)

**Analog — column def** (`priceSnapshot`, lines ~111 area) and **CSV row** (`sanitizeCell`, lines 24-56):
```tsx
sanitizedRows.push({
  productNameSnapshot: sanitizeCell(row.productNameSnapshot),
  priceSnapshot: sanitizeCell(row.priceSnapshot),
  ...
  notes: sanitizeCell(row.notes ?? ''),
  ...
});
...
fields: [
  { label: 'Price', value: 'priceSnapshot' },
  ...
  { label: 'Notes', value: 'notes' },
],
```
Per D-17/D-18: add a `tip` column definition right after Price (same right-aligned + `EditableCell` pattern as `SalesTable.tsx` above, reusing the same `EditableCell` component since admins share the same PATCH permission flow), and add `tip: sanitizeCell(row.tip ?? '')` to the CSV row-mapping plus a `{ label: 'Tip', value: 'tip' }` entry in the CSV `fields` array, positioned after Price.

---

### `packages/frontend/src/pages/DashboardPage.tsx` (component, transform)

**Analog:** Total Revenue card with regex-based thousands separator (~line 106) — same string-only formatting rule as `ShiftTotalsBanner`'s `addThousandsSep`. Reuse (or extract/share) that helper rather than reimplementing per D-05; add the `incl. ₱X tips` caption beneath the Total Revenue figure using `summary.totalTips` from the admin.ts dashboard endpoint change above.

---

### `packages/frontend/src/components/admin/VoidRequestsTable.tsx` (component/table, transform)

**Analog:** its existing Price column (mirrors `AdminSalesTable.tsx`'s read-only display style, not editable — void-request rows are not edited). Add a Tip column next to Price (D-20), display-only, same empty-cell-when-null convention as Price.

---

## Shared Patterns

### Money serialization (`.toFixed(2)`, never `.toString()`)
**Source:** `packages/backend/src/routes/sales.ts` lines 14-15, 41 (`serializeSale`); `admin.ts` `toMoneyStr` (line 12 comment)
**Apply to:** every backend response touching `tip` — serializer, create route, PATCH route, all aggregate/raw-SQL revenue endpoints.
```typescript
priceSnapshot: sale.priceSnapshot.toFixed(2), // CRITICAL: never .toString() — drops trailing zeros
```

### Nullable-field PATCH + audit (blank → null)
**Source:** `packages/backend/src/routes/sales.ts` lines 519-556
**Apply to:** the `tip` PATCH branch — same shape as `notes`, but with money-specific `.toFixed(2)`/`'(empty)'` audit formatting (D-08/D-09) and `0`→`null` normalization (D-12) added on top.
```typescript
const coercedValue: string | null =
  field === 'notes' && rawValue === '' ? null : String(rawValue);
const oldValue = String(sale[field as keyof typeof sale] ?? '');
```

### Right-aligned money column in tables
**Source:** `packages/frontend/src/components/sales/SalesTable.tsx` lines 21-33
**Apply to:** `SalesTable.tsx`, `AdminSalesTable.tsx`, `VoidRequestsTable.tsx`, `AdminShiftsPage.tsx` Tip columns.
```tsx
header: () => <span className="block text-right">Price</span>,
cell: ({ row }) => <span className="block text-right ...">{sale.priceSnapshot}</span>,
```

### CSV export via `sanitizeCell`
**Source:** `packages/frontend/src/components/admin/AdminSalesTable.tsx` lines 24-56
**Apply to:** Tip column in the CSV export (D-18) — same formula-injection sanitization, empty string when null.

### Revenue aggregation: Prisma `_sum` (JS layer) + raw SQL `SUM(CASE...)` (KPI layer)
**Source:** `packages/backend/src/routes/shifts.ts` lines 119/153; `admin.ts` lines 51-61, 130-161
**Apply to:** every revenue figure listed in D-01 except the product-breakdown groupBy (D-02, explicitly excluded).
```typescript
_sum: { priceSnapshot: true }  // add: tip: true, then Decimal-add before .toFixed(2)
```
```sql
SUM(CASE WHEN status = 'active' THEN priceSnapshot ELSE 0 END)  -- add: + COALESCE(tip, 0)
```

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|---|---|---|---|
| Digit/decimal-only keystroke filter for Tip input | utility (inline) | request-response | No existing numeric-only input filter in the codebase (Price is always read-only/auto-populated, never freehand-typed); write a small inline filter in `AddRowForm.tsx`/`EditableCell.tsx`, no shared pattern to copy. |
| `tip` express-validator rule (2-decimal cap, `99999999.99` ceiling, reject negatives) | validation | request-response | No existing decimal-money *input* validator — `priceSnapshot` is server-derived from `product.price`, never validated as user input. Closest precedent is `body('notes').optional().isString()` (shape only, not content). |

## Metadata

**Analog search scope:** `packages/backend/src/routes/{sales,shifts,admin}.ts`, `packages/frontend/src/components/sales/*`, `packages/frontend/src/components/admin/{AdminSalesTable,VoidRequestsTable}.tsx`, `packages/frontend/src/components/shift/ShiftTotalsBanner.tsx`, `packages/backend/prisma/schema.prisma`
**Files scanned:** 8 read in full/targeted sections, 2 grepped
**Pattern extraction date:** 2026-09-23
