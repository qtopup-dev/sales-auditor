# Phase 14: Moderator Product Management - Pattern Map

**Mapped:** 2026-09-24
**Files analyzed:** 9 (all modified, none new)
**Analogs found:** 9 / 9 (all patterns exist in-repo; every cited CONTEXT.md line/file verified current — no drift found)

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|-----------------|---------------|
| `packages/backend/src/routes/products.ts` | route/controller | CRUD | `packages/backend/src/routes/sales.ts` (audit-in-tx), `packages/backend/src/routes/users.ts` (409 duplicate check) | exact (self, extend in place) |
| `packages/backend/src/middleware/requireRole.ts` | middleware | request-response | `packages/backend/src/routes/voidRequests.ts` (multi-role-per-router usage) | role-match |
| `packages/backend/src/app.ts` | config | request-response | itself (comment update only) | exact |
| `packages/backend/prisma/schema.prisma` | model | CRUD | `AuditLog`/`Product` models already generic — no migration needed | exact (no change) |
| `packages/frontend/src/router/index.tsx` | route/config | request-response | itself; array-role pattern absent, needs new shape | role-match |
| `packages/frontend/src/layouts/AuthenticatedLayout.tsx` | component/nav | request-response | itself (`MODERATOR_NAV` array) | exact |
| `packages/frontend/src/pages/ProductsPage.tsx` | component | CRUD | itself (`ADMIN_NAV`→`MODERATOR_NAV` copy for nav; own toggle mutation for invalidation) | exact |
| `packages/frontend/src/components/catalog/ProductModal.tsx` | component/form | request-response | `packages/frontend/src/components/users/UserModal.tsx` (409 inline field error) | exact |
| `AddRowForm.tsx` / `EditableCell.tsx` / `SalesPage.tsx` (catalog-products query key) | hook/component | request-response | unchanged reads — only new writers must invalidate this key | n/a (consumer, not modified) |

## Pattern Assignments

### `packages/backend/src/routes/products.ts` (route, CRUD)

**Line-number drift check:** file is 195 lines, matches CONTEXT.md description exactly (guard L9, GET L39-48, POST L63-78, PATCH L94-118, toggle L125-154, DELETE L163-194). No drift.

**Analog 1 — guard widening:** `packages/backend/src/middleware/requireRole.ts` L9 currently `role: 'admin' | 'moderator'` (single role only):
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
To widen per CONTEXT.md discretion, change the param to accept multiple roles, e.g. `role: Array<'admin' | 'moderator'>` and check `!role.includes(req.session.role)`. **Every other caller passes a single string literal** (`requireRole('admin')` in `users.ts:13`, `mops.ts:9`, `receivers.ts:9`, `admin.ts:11`, `auth.ts:144`; `requireRole('moderator')` in `shifts.ts:12`, `voidRequests.ts:91/207`; mixed per-route in `voidRequests.ts:176/191/238/350` and `sales.ts:633/702`). If the signature changes to an array/rest-args, wrap single-role call sites in an array (`requireRole(['admin'])`) or keep a rest-params signature `requireRole(...roles)` so existing single-arg calls need no changes — **rest-params is the smaller diff** since none of the ~13 other call sites need touching.

**Analog 2 — audit-in-transaction:** `packages/backend/src/routes/sales.ts` L272-286 (create) and L325-410 (update, multi-field):
```typescript
// AUDIT-02 hard constraint: audit record in SAME transaction
await tx.auditLog.create({
  data: {
    organizationId: req.session.organizationId!,
    userId: req.session.userId!,
    userUsername: req.session.username!,
    saleId: createdSale.id,
    tableName: 'sales',
    rowId: createdSale.id,
    action: 'create',
    fieldName: null,
    oldValue: null,
    newValue: null,
  },
});
```
For products: `tableName: 'products'`, `rowId: product.id`, `saleId: null` (per D-06). Wrap each of POST/PATCH/toggle/DELETE in `prisma.$transaction(async (tx) => { ... })` — currently none of `products.ts`'s handlers use a transaction at all (plain `prisma.product.create/update`), so this is new to this file. Model the multi-field PATCH after `sales.ts` L375-410 `tx.auditLog.createMany` (one row per changed field, oldValue/newValue as `.toFixed(2)` strings for price, plain strings for name/isActive/deletedAt).

**Analog 3 — 409 duplicate-name check:** `packages/backend/src/routes/users.ts` L67-80 (`PATCH /:id/username`, D-21 uniqueness excluding self):
```typescript
// D-21: uniqueness check excluding self — check active + inactive users (isActive: undefined)
// isActive: undefined overrides $extends softDeleteFilter — checks ALL users regardless of isActive
const conflict = await prisma.user.findFirst({
  where: {
    username,
    organizationId,
    NOT: { id: targetId },
    isActive: undefined, // override $extends — check ALL users regardless of isActive
  },
});
if (conflict) {
  res.status(409).json({ error: 'USERNAME_TAKEN' });
  return;
}
```
Copy directly for products: `prisma.product.findFirst({ where: { name: trimmedName, organizationId, deletedAt: null, NOT: id ? { id } : undefined } })`. **Important — do NOT set `isActive: undefined` here on purpose the way `users.ts` does**: check `packages/backend/src/lib/prisma.ts` — `product.findFirst` is **not** in the `$extends` override list at all (only `product.findMany` is), so `findFirst` on `product` never gets an automatic `isActive`/`deletedAt` default injected. That means the duplicate check must **explicitly** pass `deletedAt: null` (to exclude soft-deleted names, D-09) and must NOT filter on `isActive` (to include inactive names, D-09 "active OR inactive"). Return `res.status(409).json({ error: 'DUPLICATE_PRODUCT_NAME' })` — same shape as `USERNAME_TAKEN` and `voidRequests.ts` L164-165 `DUPLICATE_PENDING_REQUEST`.

**Collation note (for the duplicate check):** `prisma/migrations/20260617063721_init/migration.sql` sets `DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` on all tables. `utf8mb4_unicode_ci` is case-insensitive by default in MySQL/MariaDB — a plain Prisma `equals` (or bare `name: trimmedName`) on this column is **already case-insensitive** at the DB level. Prisma's `mode: 'insensitive'` is Postgres-only and unsupported on MySQL — do not use it; it isn't needed here anyway.

**Toggle/delete "own name" exemption:** N/A for toggle/delete (D-09 only applies to create/rename). For PATCH `/:id` rename, exclude the product's own row via `NOT: { id }` as shown above — this also makes renaming to the same name (or a case variant) a non-conflict, since the row is excluded from the search regardless of casing.

**Existing findFirst-bypasses-default pattern** (for reference, same file, toggle L138-141 and delete L178-181):
```typescript
const current = await prisma.product.findFirst({
  where: { id, organizationId: 1, isActive: undefined, deletedAt: null },
  select: { isActive: true },
});
```
Note `organizationId: 1` is hardcoded throughout this file (pre-existing, not part of this phase's scope — do not "fix" unless asked).

---

### `packages/backend/src/app.ts` (config)

L106 currently:
```typescript
protectedRouter.use('/products', productsRouter); // admin-only (productsRouter mounts requireRole internally)
```
Update the trailing comment only (e.g. `// admin + moderator — productsRouter mounts requireRole internally`) — no functional change needed here since the guard lives in `products.ts` L9.

---

### `packages/backend/prisma/schema.prisma` (model)

No migration needed. `AuditLog` (L203-224) is fully generic already: `tableName String`, `rowId Int`, `saleId Int?` (nullable — D-06 sets `null` for product rows), `action AuditAction` (enum `create | update | void`, L25-29). Per CONTEXT.md discretion, map toggle/delete onto `update` with `fieldName: 'isActive'` / `fieldName: 'deletedAt'` — do not add an enum value or migrate.

---

### `packages/frontend/src/router/index.tsx` (route config)

Current shape, L20-35 (`ProtectedRoute`) and L53-65 (admin-only group holding `/products`):
```typescript
function ProtectedRoute({ requiredRole }: { requiredRole?: 'admin' | 'moderator' }) {
  ...
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'admin' ? '/dashboard' : '/sales'} replace />;
  }
  return <Outlet />;
}
...
{ path: '/sales', element: <SalesPage /> },
{ path: '/shift-history', element: <ShiftHistoryPage /> },
{
  element: <ProtectedRoute requiredRole="admin" />,
  children: [
    { path: '/dashboard', element: <DashboardPage /> },
    { path: '/products', element: <ProductsPage /> },
    ...
  ],
},
```
Per CONTEXT.md discretion, widen `requiredRole` to accept an array (`requiredRole?: Array<'admin' | 'moderator'>`, check `!requiredRole.includes(user.role)`) and move `{ path: '/products', element: <ProductsPage /> }` out of the admin-only group into its own `<ProtectedRoute requiredRole={['admin', 'moderator']} />` group (or the no-requiredRole group, since only admin/moderator exist and both roles are now allowed — but explicit `['admin','moderator']` is clearer intent and future-proof against a third role). **The `/dashboard`, `/mops`, `/receivers`, `/users`, `/shifts`, `/void-requests` group must stay on `requiredRole="admin"` (or `['admin']`) unchanged** — this is the "other routes must stay unchanged" constraint from CONTEXT.md discretion.

---

### `packages/frontend/src/layouts/AuthenticatedLayout.tsx` (nav)

L12-27:
```typescript
const ADMIN_NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/sales', label: 'Sales' },
  { to: '/products', label: 'Products' },
  ...
];
const MODERATOR_NAV = [
  { to: '/sales', label: 'Sales Sheet' },
  { to: '/shift-history', label: 'Shift History' },
];
```
Per D-12, add a `Products` entry to `MODERATOR_NAV` producing order `Sales Sheet → Shift History → Products`:
```typescript
const MODERATOR_NAV = [
  { to: '/sales', label: 'Sales Sheet' },
  { to: '/shift-history', label: 'Shift History' },
  { to: '/products', label: 'Products' },
];
```
`navItems = user?.role === 'admin' ? ADMIN_NAV : MODERATOR_NAV` (L35) needs no change — the array lookup already works per-role.

---

### `packages/frontend/src/pages/ProductsPage.tsx` (component, CRUD)

Existing `toggleMutation` (L34-45) invalidates only `['products']`:
```typescript
const toggleMutation = useMutation({
  mutationFn: (productId: number) => {
    setPendingToggleId(productId);
    return api.patch<Product>(`/products/${productId}/toggle`, {}).then((r) => r.data);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    setPendingToggleId(null);
  },
  onError: () => setPendingToggleId(null),
});
```
Per D-11, add `queryClient.invalidateQueries({ queryKey: ['catalog-products'] })` alongside the existing `['products']` invalidation in `onSuccess` here, and in `ProductModal.tsx`'s create/update mutations and in `ProductDeleteConfirmDialog`'s delete mutation (same shape — not re-read here, but check its `onSuccess` mirrors `toggleMutation`'s and add the same second invalidation call). No role branching needed in this file per D-02 — it stays byte-identical between admin and moderator.

**Stale comment to update:** L15-18 header comments say "PROD-04: admin views...", "PROD-01/02: create/edit...", "PROD-03: toggle active/inactive..." — reword to drop the "admin"-only framing per CONTEXT.md discretion item on stale comments.

---

### `packages/frontend/src/components/catalog/ProductModal.tsx` (component/form, request-response)

**Analog — inline 409 field error:** `packages/frontend/src/components/users/UserModal.tsx` L38-51:
```typescript
const updateMutation = useMutation({
  mutationFn: (data: UsernameFormData) =>
    api.patch(`/users/${user!.id}/username`, { username: data.username }).then((r) => r.data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    onClose();
  },
  onError: (err: unknown) => {
    // D-21: inline error in modal form — not a page-level alert
    if (axios.isAxiosError(err) && err.response?.status === 409) {
      setError('username', { message: 'Username already taken.' });
    }
  },
});
```
`ProductModal.tsx` currently (L32-51) has no `onError` on either `createMutation` or `updateMutation`, and does not call `setError` from `useForm` (only `register`/`handleSubmit`/`formState.errors`/`reset` are destructured, L23). Add `setError` to the destructure, add matching `onError` handlers to both mutations checking `err.response?.status === 409` and calling `setError('name', { message: 'A product with this name already exists.' })` (exact copy is Claude's discretion per D-09/CONTEXT.md). Also add the same `['catalog-products']` invalidation from D-11 to both `onSuccess` callbacks (currently only `['products']` at L36/L45).

**Existing generic error render** (L138-141), keep for non-409 errors:
```typescript
{error && (
  <p className="text-sm text-red-600 dark:text-red-400 mt-1">Something went wrong. Please try again.</p>
)}
```

---

### Catalog consumers (read-only, not modified)

`AddRowForm.tsx:73`, `EditableCell.tsx:47`, `SalesPage.tsx:54` all use `queryKey: ['catalog-products']` with the existing 5-minute `staleTime` — confirmed present via grep, unchanged by this phase. These files need no edits; they will pick up fresh data automatically once `ProductsPage.tsx`/`ProductModal.tsx`/`ProductDeleteConfirmDialog.tsx` mutations invalidate that same key (D-11).

---

## Shared Patterns

### Audit-in-transaction (CLAUDE.md Rule 2)
**Source:** `packages/backend/src/routes/sales.ts` L272-286, L325-410
**Apply to:** All four `products.ts` mutation handlers (POST, PATCH `/:id`, PATCH `/:id/toggle`, DELETE `/:id`) — currently none of them use `prisma.$transaction`; this phase introduces it to this file for the first time.

### 409 duplicate-conflict response shape
**Source:** `packages/backend/src/routes/users.ts` L77-80 (`USERNAME_TAKEN`), `packages/backend/src/routes/voidRequests.ts` L136-137/164-165 (`DUPLICATE_PENDING_REQUEST`)
**Apply to:** `products.ts` POST and PATCH `/:id` → `res.status(409).json({ error: 'DUPLICATE_PRODUCT_NAME' })`.

### Inline field error from axios 409
**Source:** `packages/frontend/src/components/users/UserModal.tsx` L45-50
**Apply to:** `ProductModal.tsx` create/update `onError` → `setError('name', { message: ... })`.

### requireRole multi-role widening
**Source:** `packages/backend/src/middleware/requireRole.ts` L9-17
**Apply to:** `products.ts` L9 only. All other 12 call sites across `voidRequests.ts`, `users.ts`, `shifts.ts`, `sales.ts`, `receivers.ts`, `mops.ts`, `auth.ts`, `admin.ts` pass a single literal role and must keep working unchanged — prefer a rest-params signature (`requireRole(...roles: Array<'admin'|'moderator'>)`) over a required-array param so no other call site needs edits.

### `['catalog-products']` cache invalidation on product mutation
**Source:** D-11, consumers at `AddRowForm.tsx:73`, `EditableCell.tsx:47`, `SalesPage.tsx:54`
**Apply to:** every mutation in `ProductsPage.tsx` (toggle), `ProductModal.tsx` (create, update), and `ProductDeleteConfirmDialog.tsx` (delete) — add alongside the existing `['products']` invalidation.

## No Analog Found

None — every file in scope has a direct, recently-modified in-repo analog (products.ts extends itself; the audit-tx, 409, and nav patterns all have 1+ close precedent from Phases 9-13).

## Line-number drift report

All CONTEXT.md-cited line numbers were verified against current file contents and matched exactly:
- `products.ts` (195 lines total, guard L9, all route sections as cited)
- `requireRole.ts` (17 lines, signature at L9)
- `app.ts` L106 (products mount)
- `schema.prisma` `AuditLog` L203, `AuditAction` enum L25-29, `Product` model L84-100
- `sales.ts` L272-286 (create audit), L325-410 (update, multi-field audit)
- `router/index.tsx` L20-35 (`ProtectedRoute`), L53-65 (admin-only group)
- `AuthenticatedLayout.tsx` L12-27 (`ADMIN_NAV`/`MODERATOR_NAV`)
- `ProductsPage.tsx`, `ProductModal.tsx` L23/32-51 (missing `setError`/`onError`, confirmed by reading full file)
- `AddRowForm.tsx:73`, `EditableCell.tsx:47`, `SalesPage.tsx:54` (`catalog-products` key, confirmed via grep)

No drift found — CONTEXT.md is accurate and current.

## Metadata

**Analog search scope:** `packages/backend/src/routes/*.ts`, `packages/backend/src/middleware/*.ts`, `packages/backend/src/lib/prisma.ts`, `packages/backend/prisma/schema.prisma`, `packages/frontend/src/router/index.tsx`, `packages/frontend/src/layouts/AuthenticatedLayout.tsx`, `packages/frontend/src/pages/ProductsPage.tsx`, `packages/frontend/src/components/catalog/ProductModal.tsx`, `packages/frontend/src/components/users/UserModal.tsx`
**Files scanned:** 14
**Pattern extraction date:** 2026-09-24
