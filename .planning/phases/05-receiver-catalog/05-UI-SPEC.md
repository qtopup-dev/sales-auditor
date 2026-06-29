# Phase 5: Receiver Catalog — UI-SPEC

**Gathered:** 2026-06-26
**Status:** Ready for planning
**Source:** Auto-generated (--auto, patterns derived from ProductsPage + MopsPage)

---

## Design System Baseline

Inherits the existing design system used across Phases 2–4:
- Tailwind CSS v3 utility classes
- `@tanstack/react-table` v8 (headless, no built-in styles)
- `react-select` v5 `AsyncSelect` for combo boxes
- `react-hook-form` v7 + Controller for form fields
- `@tanstack/react-query` v5 for server state
- `Modal.tsx` + `StatusBadge.tsx` shared primitives already in codebase
- Existing `authStore`, `api` axios instance, `queryClient` singletons

All new UI components MUST follow the exact same visual conventions as `ProductsPage.tsx`, `MopsPage.tsx`, `ProductModal.tsx`, and `MopModal.tsx`.

---

## 1. Receiver Catalog Page (Admin)

**Route:** `/receivers` (admin-only, ProtectedRoute + requireRole admin)
**File:** `packages/frontend/src/pages/ReceiversPage.tsx`
**Analog:** `packages/frontend/src/pages/ProductsPage.tsx` (copy structure exactly)

### Layout

```
[Page Header]
  "Receivers"                          [Add Receiver]
  
[Table — border border-gray-200 rounded-md overflow-hidden]
  Name | Account # | Status | Actions
  -------------------------------------------------
  John Doe | ACC-001  | Active  | Edit | Deactivate
  Jane Smith | —       | Inactive | Edit | Activate
```

### Column Definitions

| Column      | Width   | Content |
|-------------|---------|---------|
| Name        | default | `receiver.name` — `text-sm text-gray-900` |
| Account #   | 160px   | `receiver.accountNumber ?? '—'` — `text-sm text-gray-500` |
| Status      | 100px   | `<StatusBadge active={receiver.isActive} />` |
| Actions     | 160px   | Edit \| Deactivate/Activate buttons |

### Interaction

- Row click → opens `ReceiverModal` in edit mode (same as ProductsPage)
- "Edit" button → opens `ReceiverModal` in edit mode
- "Deactivate"/"Activate" → `PATCH /api/receivers/:id/toggle` (pessimistic per-row: `pendingToggleId` state)
- "Add Receiver" button → opens `ReceiverModal` in create mode

### States

- **Loading:** `<p className="text-sm text-gray-500">Loading...</p>`
- **Empty:** 
  ```
  <div className="border border-gray-200 rounded-md p-8 text-center">
    <p className="text-sm font-semibold text-gray-900 mb-1">No receivers yet</p>
    <p className="text-sm text-gray-500">Add your first receiver to get started.</p>
  </div>
  ```
- **Error:** same pattern as other catalog pages (query error display)

### Query Key

`['receivers']` — invalidated on create, update, toggle

---

## 2. Receiver Modal (Create / Edit)

**File:** `packages/frontend/src/components/catalog/ReceiverModal.tsx`
**Analog:** `packages/frontend/src/components/catalog/MopModal.tsx` (closest — no price field)

### Variants

| Mode   | Title           | CTA            |
|--------|-----------------|----------------|
| Create | "Add Receiver"  | "Add Receiver" |
| Edit   | "Edit Receiver" | "Save Changes" |

### Fields

| Field          | Type   | Required | Validation |
|----------------|--------|----------|------------|
| Name           | text   | Yes      | `notEmpty()` — "Receiver Name is required" |
| Account Number | text   | No       | optional free text, max 100 chars (no format constraint) |

### Form Layout

```
[label] Receiver Name
[input h-10 w-full border rounded-md px-3 py-2 text-sm]
[error if required]

[label] Account Number (optional)
[input h-10 w-full border rounded-md px-3 py-2 text-sm placeholder="e.g. ACC-001"]
```

### Footer (modal)

```
[Discard (ghost)] [Save Changes / Add Receiver (primary)]
```

- All inputs + buttons `disabled` while `isPending` (CLAUDE.md Rule 10)
- API error: `<p className="text-sm text-red-600 mt-1">Something went wrong. Please try again.</p>`

### Mutations

- Create: `POST /api/receivers` → invalidate `['receivers']`
- Update: `PATCH /api/receivers/:id` → invalidate `['receivers']`

---

## 3. AddRowForm — Receiver Field (Replace Free-Text Input)

**File:** `packages/frontend/src/components/sales/AddRowForm.tsx`

### Current State

Receiver column uses a plain `<input type="text">` with `register('receiver', ...)`.

### New State

Replace with `AsyncSelect` (identical to Product and MOP fields in the same form).

**Field changes:**
- Remove `register('receiver', ...)` plain text input
- Add `Controller` + `AsyncSelect` for `receiverId: number | null`
- Load from `catalog-receivers` React Query cache (same staleTime: 5min pattern)
- Add `selectedReceiver` state (`ReceiverOption | null`)
- `isFormValid` condition: add `watchedReceiverId !== null` check (replaces `watchedReceiver.trim() !== ''`)

**Form data type change:**
```typescript
type AddRowFormData = {
  productId: number | null;
  mopId: number | null;
  receiverId: number | null;  // WAS: receiver: string
  notes: string;
};
```

**AsyncSelect props (copy MOP pattern exactly):**
```tsx
<AsyncSelect
  loadOptions={loadReceivers}
  defaultOptions={receiverOptions}
  menuPortalTarget={document.body}
  menuPosition="fixed"
  isDisabled={isPending || isCatalogLoading}
  placeholder="Select receiver..."
  styles={{
    control: (base) => ({
      ...base,
      minHeight: '36px',
      fontSize: '14px',
      borderColor: errors.receiverId ? '#ef4444' : base.borderColor,
    }),
    menu: (base) => ({ ...base, zIndex: 9999 }),
  }}
  onChange={(option) => {
    const opt = option as ReceiverOption | null;
    field.onChange(opt?.value ?? null);
    setSelectedReceiver(opt);
  }}
  value={selectedReceiver}
/>
```

**Query key:** `['catalog-receivers']` — staleTime 5min, from `GET /api/catalog/receivers`

**Column width:** keep at `160px` (same as current receiver column)

---

## 4. EditableCell — Receiver Field (Replace Text Input with Select)

**File:** `packages/frontend/src/components/sales/EditableCell.tsx`

### Current State

`receiver` is a plain text field that uses the generic `<input type="text">` branch.

### New State

`receiver` field is removed; `receiverId` replaces it as a select field.

**`SELECT_FIELDS` change:**
```typescript
const SELECT_FIELDS = ['productId', 'mopId', 'receiverId'] as const;
```

**Cache query:** Add `catalog-receivers` query alongside existing catalog queries:
```typescript
const { data: cachedReceivers = [] } =
  useQuery<Array<{ id: number; name: string; accountNumber: string | null }>>({
    queryKey: ['catalog-receivers'],
    queryFn: () => api.get('/catalog/receivers').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
```

**`loadReceivers` function** (same pattern as `loadProducts`/`loadMops`):
```typescript
const loadReceivers = (inputValue: string) =>
  Promise.resolve(
    cachedReceivers
      .filter((r) => r.name.toLowerCase().includes(inputValue.toLowerCase()))
      .map((r) => ({ value: r.id, label: r.name }))
  );
```

**`loadOptions` switch:**
```typescript
const loadOptions =
  field === 'productId' ? loadProducts
  : field === 'mopId' ? loadMops
  : loadReceivers;
```

**EditableCellProps:** Change `field` type from `'productId' | 'mopId' | 'receiver' | 'notes'` to `'productId' | 'mopId' | 'receiverId' | 'notes'`

**`handleClick`:** Change `sale[field as keyof Sale]` — `receiverId` is now the FK integer (not a string). The draftValue will be the string ID, same as productId/mopId handling.

---

## 5. SalesTable — Receiver Column

**File:** `packages/frontend/src/components/sales/SalesTable.tsx`

The receiver column currently renders `sale.receiver` (free text string). After Phase 5, it must render `sale.receiverNameSnapshot` instead.

**Column cell change:**
```tsx
// Was: <EditableCell sale={sale} field="receiver" displayValue={sale.receiver} />
// Now:
<EditableCell sale={sale} field="receiverId" displayValue={sale.receiverNameSnapshot} />
```

The `displayValue` prop shows the snapshot name for historical display. The edit action sends the new `receiverId` FK.

---

## 6. AdminSalesTable — Receiver Column

**File:** `packages/frontend/src/components/admin/AdminSalesTable.tsx`

Currently shows `sale.receiver` (free text). After Phase 5, show `sale.receiverNameSnapshot`.

**Column cell accessor change:**
- Was: `accessorKey: 'receiver'` → display `sale.receiver`
- Now: `accessorKey: 'receiverNameSnapshot'` → display `sale.receiverNameSnapshot`

Admin table is read-only; no EditableCell wrapping needed here.

---

## 7. Navigation — Add "Receivers" Link

**File:** `packages/frontend/src/layouts/AuthenticatedLayout.tsx`

Add "Receivers" nav item to admin sidebar (admin-only, same as Products and MOPs).

Inspect existing nav items to determine exact insertion point. Insert after "MOPs" or before "MOPs" — whichever makes more semantic sense in context. Follow the exact same NavLink/active class pattern.

---

## 8. Router — Add Receivers Route

**File:** `packages/frontend/src/router/index.tsx`

Add admin-guarded route for `/receivers` → `ReceiversPage`.

Follow exact same pattern as `/products` and `/mops` routes (ProtectedRoute + role check).

---

## Shared Types Changes

**File:** `packages/shared/src/types/sale.ts`

```typescript
export interface Sale {
  // ... existing fields ...
  receiverId: number;          // FK to receivers table (replaces free-text receiver)
  receiverNameSnapshot: string; // Snapshot at creation (replaces receiver string)
  // REMOVE: receiver: string   ← this field is removed
  // ... rest of existing fields ...
}
```

**New file:** `packages/shared/src/types/receiver.ts`

```typescript
export interface Receiver {
  id: number;
  organizationId: number;
  name: string;
  accountNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**File:** `packages/shared/src/types/index.ts` — add `export * from './receiver.js'`

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Page title | "Receivers" |
| Add button | "Add Receiver" |
| Modal title (create) | "Add Receiver" |
| Modal title (edit) | "Edit Receiver" |
| Modal CTA (create) | "Add Receiver" |
| Modal CTA (edit) | "Save Changes" |
| Modal cancel | "Discard" |
| Empty state headline | "No receivers yet" |
| Empty state body | "Add your first receiver to get started." |
| Name field label | "Receiver Name" |
| Name field error | "Receiver Name is required" |
| Account # field label | "Account Number (optional)" |
| Account # placeholder | "e.g. ACC-001" |
| Combobox placeholder | "Select receiver..." |
| Nav link label | "Receivers" |

---

## Security Notes (ASVS L1)

Per `threat_model` requirement in PLAN.md files:

- Backend `receiversRouter` must use `requireRole('admin')` for all CRUD routes
- `catalogRouter` `/receivers` endpoint: no requireRole (authenticated users need it for the dropdown)
- `organizationId` from `req.session.organizationId` on all queries — never from request body
- Name field: sanitize/trim; reject empty after trim
- Account number: optional string, max 100 chars, no format constraint

---

*Phase: 05-receiver-catalog*
*UI-SPEC generated: 2026-06-26 (auto, from established ProductsPage/MopsPage patterns)*
