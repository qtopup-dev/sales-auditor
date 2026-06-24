# Phase 999.1: fix: Add Row Catalog Lag — Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the product/MOP dropdown lag and 403 errors in the Add Row form and EditableCell inline dropdowns.

Delivers: new backend catalog endpoints accessible to all authenticated users (not just admins), eager pre-fetch in SalesPage, and updated AddRowForm + EditableCell to read catalog data from React Query cache instead of making fresh API calls on every mount.

**Out of scope:** Changes to /api/products or /api/mops admin CRUD routes, new catalog admin features, or any other sales sheet UX changes.

</domain>

<decisions>
## Implementation Decisions

### Root Cause (confirmed)
- **D-01:** Two components make raw API calls to `/api/products` and `/api/mops` on every mount: `AddRowForm.tsx` and `EditableCell.tsx` (for product/mop select fields).
- **D-02:** Both routes require `requireRole('admin')` at the router level. Moderators with `canEdit=true` get a 403 — product/MOP dropdowns never load for them.
- **D-03:** After a void, the `['sales']` refetch and the fresh `/products` + `/mops` calls from AddRowForm all fire simultaneously. The simultaneous requests cause visible lag on the dropdowns. Admin role means no 403, but the timing makes it noticeable.

### Backend — Catalog Endpoints
- **D-04:** Add two new endpoints accessible to **all authenticated users** (no role restriction):
  - `GET /api/catalog/products` — returns active products only (`isActive: true`). Response shape: `{ id, name, price }[]`.
  - `GET /api/catalog/mops` — returns active MOPs only (`isActive: true`). Response shape: `{ id, name }[]`.
- **D-05:** Implement as a new `catalogRouter` mounted on `protectedRouter`. Do NOT modify the existing `/api/products` or `/api/mops` routers — those remain admin-only for CRUD operations.
- **D-06:** The catalog endpoints filter only active items (`isActive: true`) via the Prisma `$extends` softDeleteFilter. No `isActive: undefined` override — active-only is exactly what the sales form needs (PROD-05, PAY-05 requirements).

### Frontend — SalesPage Eager Pre-fetch
- **D-07:** `SalesPage.tsx` adds two `useQuery` calls:
  - `useQuery({ queryKey: ['catalog-products'], queryFn: () => api.get('/catalog/products').then(r => r.data), staleTime: 5 * 60 * 1000 })` (5-minute stale time)
  - `useQuery({ queryKey: ['catalog-mops'], queryFn: () => api.get('/catalog/mops').then(r => r.data), staleTime: 5 * 60 * 1000 })`
- **D-08:** The pre-fetch results are NOT passed as props. SalesPage uses these queries solely to warm the React Query cache before Add Row is opened. No prop threading through SalesTable.

### Frontend — AddRowForm Update
- **D-09:** Replace `loadProducts` and `loadMops` raw API calls with `useQuery(['catalog-products'])` and `useQuery(['catalog-mops'])` inside `AddRowForm`. Since SalesPage already fetched these, the data is in cache and renders instantly.
- **D-10:** Keep using `AsyncSelect` but change `loadOptions` to filter from the cached array: `(inputValue) => Promise.resolve(cachedProducts.filter(p => p.name.toLowerCase().includes(inputValue.toLowerCase())).map(p => ({ value: p.id, label: p.name, price: p.price })))`. Drop `cacheOptions` (no longer needed — data comes from React Query cache).
- **D-11:** While `isLoading` is true on the catalog queries (edge case: first load before SalesPage has fetched), `AddRowForm` should disable the dropdowns and show `isDisabled={isLoading}`. In practice this should never happen since SalesPage pre-fetches, but guard defensively.

### Frontend — EditableCell Update
- **D-12:** Same pattern as AddRowForm. Replace `loadProducts` and `loadMops` in `EditableCell.tsx` with `useQuery(['catalog-products'])` and `useQuery(['catalog-mops'])`. Filter synchronously from cached data, same `Promise.resolve(filtered)` approach.
- **D-13:** EditableCell's select is only rendered when `isThisCellActive === true` (the cell is being edited). Since the data is in React Query cache from SalesPage, the dropdown opens with options already available — no network call on cell click.

### Claude's Discretion
- Exact file name for the new catalog router (`catalogRouter.ts` or similar)
- Whether catalog endpoints return `createdAt`/`updatedAt` or strip to minimal shape
- Exact import style for the new `useQuery` calls in EditableCell (can import `useQuery` directly since it already imports `useMutation`)
- TypeScript types for catalog response shapes (can inline or share via types package)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Files Being Modified
- `packages/frontend/src/pages/SalesPage.tsx` — add useQuery pre-fetches here (lines 14–17 add alongside existing sales query)
- `packages/frontend/src/components/sales/AddRowForm.tsx` — replace loadProducts/loadMops (lines 49–61)
- `packages/frontend/src/components/sales/EditableCell.tsx` — replace loadProducts/loadMops (lines 100–114)
- `packages/backend/src/app.ts` — mount new catalogRouter on protectedRouter (line 91–95 region); do NOT change existing route mounts

### New Files to Create
- `packages/backend/src/routes/catalog.ts` — new catalogRouter with GET /products and GET /mops (active-only, no role restriction)

### Architecture Rules
- `CLAUDE.md` §Critical Architecture Rules — Rule 8 (soft-delete filter enforcement: let Prisma $extends handle active filter, no `isActive: undefined` override in catalog routes), Rule 9 (backend enforces RBAC — catalog endpoints do NOT require requireRole, that's correct by design)
- `packages/backend/src/app.ts` — middleware order is CRITICAL (comment at top). New catalogRouter mounts AFTER requireAuth on the protectedRouter. Do NOT rearrange existing middleware.

### Patterns to Follow
- `packages/backend/src/routes/mops.ts` — reference for Prisma mop query pattern and `serializeMop` shape; catalog endpoint returns a subset of this shape
- `packages/backend/src/routes/products.ts` — reference for Prisma product query and `serializeProduct` price formatting (`.toFixed(2)` CRITICAL — never `.toString()`)
- `packages/frontend/src/pages/SalesPage.tsx` — reference for `useQuery` pattern already used for `['sales']`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/backend/src/lib/prisma.ts` — Prisma singleton; the `$extends` softDeleteFilter already handles `isActive: true` automatically on `findMany` — catalog routes get active-only filtering for free (no explicit `isActive: true` needed, but can be explicit for clarity)
- `packages/frontend/src/lib/queryClient.ts` — React Query client singleton; `['catalog-products']` and `['catalog-mops']` follow the existing `['products']`, `['mops']`, `['sales']` key naming pattern
- `packages/frontend/src/lib/axios.ts` — `api` singleton; catalog API calls use same base URL `/api`

### Established Patterns
- All `useQuery` calls in this app follow: `{ queryKey, queryFn: () => api.get(path).then(r => r.data) }` — follow this pattern in AddRowForm and EditableCell
- `AsyncSelect` with `loadOptions` returns `Promise<Options[]>` — returning `Promise.resolve(filtered)` is correct and already used in the codebase pattern
- `staleTime: 5 * 60 * 1000` (5 min) matches the design decision; no existing precedent in this codebase yet for catalog stale time

### Integration Points
- `packages/backend/src/app.ts` line 91–95: `protectedRouter.use(...)` block — add `protectedRouter.use('/catalog', catalogRouter)` here
- The `isActive: undefined` override pattern in admin routes (`GET /api/products` and `GET /api/mops`) should NOT be used in the catalog routes — those routes intentionally show all items to admins. Catalog routes want only active items, so let `$extends` default apply.

</code_context>

<specifics>
## Specific Ideas

- The `$extends` Prisma softDeleteFilter automatically applies `isActive: true` for `findMany` queries — catalog routes get active-only filtering without explicit `isActive` in the `where` clause. This is the simplest implementation. Contrast with admin routes that use `isActive: undefined` to bypass it.
- `price` in catalog products response must use `.toFixed(2)` — same as `serializeProduct` in `products.ts`. Never `.toString()` (drops trailing zeros per the existing code comment).
- `catalogRouter` does NOT call `catalogRouter.use(requireRole('admin'))` — that's intentional. All authenticated users can read active catalog data. The router is still under the `requireAuth` middleware via `protectedRouter`, so unauthenticated requests are still blocked.
- In `AddRowForm`, after switching to `useQuery`, the `priceDisplay` state and `setPriceDisplay` call in `onChange` still work the same way — price comes from the option object, just sourced from cached data instead of a live request.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 999-01-fix-add-row-catalog*
*Context gathered: 2026-06-24*
