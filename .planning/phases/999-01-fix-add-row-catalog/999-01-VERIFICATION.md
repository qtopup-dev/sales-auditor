---
phase: 999-01-fix-add-row-catalog
verified: 2026-06-24T00:00:00Z
status: human_needed
score: 13/13 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Log in as a moderator (canEdit=true, not admin) — navigate to Sales Sheet — click Add Row — open the product dropdown"
    expected: "Dropdown populates immediately with active product options. No 403 error. No blank/empty dropdown."
    why_human: "Cannot verify runtime session-role enforcement or dropdown render output without a running app and a real moderator session."
  - test: "Log in as a moderator — click Add Row — open the MOP dropdown"
    expected: "MOP dropdown populates immediately with active MOP options. No 403. No blank dropdown."
    why_human: "Same as above — runtime + session required."
  - test: "Log in as a moderator — click an editable product cell on an existing active row"
    expected: "AsyncSelect opens immediately with active product options loaded from cache (no network call on click)."
    why_human: "Inline-cell activation and cache hit timing require runtime browser observation."
  - test: "Log in as a moderator — click an editable MOP cell on an existing active row"
    expected: "AsyncSelect opens immediately with active MOP options. No network call triggered on click."
    why_human: "Same as above."
  - test: "Open browser DevTools Network tab — log in — navigate to Sales Sheet"
    expected: "Exactly two catalog requests appear on page load: GET /api/catalog/products and GET /api/catalog/mops. No requests to /api/products or /api/mops originate from the frontend."
    why_human: "Network tab observation requires a running browser session."
  - test: "Log in as admin — perform a void — then click Add Row"
    expected: "Product and MOP dropdowns open without lag. No simultaneous re-fetch storm."
    why_human: "Lag is a timing/performance observation; requires runtime testing."
---

# Phase 999-01: Fix Add Row Catalog Lag / 403 Verification Report

**Phase Goal:** Fix the UI lag / 403 error when Add Row form tries to load product and MOP dropdowns — create dedicated catalog endpoints accessible to all authenticated users, and update the frontend to pre-fetch via React Query cache instead of calling on demand.
**Verified:** 2026-06-24
**Status:** HUMAN_NEEDED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/catalog/products returns 200 for a moderator (canEdit=true, not admin) | ✓ VERIFIED | `catalogRouter` in `catalog.ts` has no `requireRole`; mounted on `protectedRouter` which applies `requireAuth` only; `products.ts` and `mops.ts` retain `requireRole('admin')` so the split is clean |
| 2 | GET /api/catalog/mops returns 200 for a moderator (canEdit=true, not admin) | ✓ VERIFIED | Same evidence as above — `catalogRouter.get('/mops', ...)` with no role restriction |
| 3 | Both catalog endpoints return only active items (isActive: true via $extends) | ✓ VERIFIED | `catalog.ts` uses no `isActive: undefined` override; `prisma.ts` `$extends` injects `isActive: true` as default for both `product.findMany` and `mop.findMany` (lines 47–58 of `prisma.ts`) |
| 4 | Products response shape is { id, name, price }[] with price as .toFixed(2) string | ✓ VERIFIED | `catalog.ts` line 14: `products.map((p) => ({ id: p.id, name: p.name, price: p.price.toFixed(2) }))` |
| 5 | MOPs response shape is { id, name }[] | ✓ VERIFIED | `catalog.ts` line 24: `mops.map((m) => ({ id: m.id, name: m.name }))` |
| 6 | Existing /api/products and /api/mops routes are unchanged and still require admin role | ✓ VERIFIED | `products.ts` line 9: `productsRouter.use(requireRole('admin'))`. `mops.ts` line 9: `mopsRouter.use(requireRole('admin'))`. Both unchanged. |
| 7 | AddRowForm product dropdown loads from cache — no calls to admin /products route | ✓ VERIFIED | `AddRowForm.tsx` imports and uses `useQuery({ queryKey: ['catalog-products'], queryFn: () => api.get('/catalog/products')... })`. No `api.get('/products')` found in file. |
| 8 | AddRowForm MOP dropdown loads from cache — no calls to admin /mops route | ✓ VERIFIED | `AddRowForm.tsx` uses `useQuery({ queryKey: ['catalog-mops'], queryFn: () => api.get('/catalog/mops')... })`. No `api.get('/mops')` found in file. |
| 9 | EditableCell product/MOP dropdowns load from cache — no calls to admin routes | ✓ VERIFIED | `EditableCell.tsx` uses both `queryKey: ['catalog-products']` and `queryKey: ['catalog-mops']`. No `api.get('/products')` or `api.get('/mops')` found in file. No `async (inputValue` pattern (old async functions gone). |
| 10 | SalesPage pre-fetches catalog data on mount so cache is warm before Add Row is opened | ✓ VERIFIED | `SalesPage.tsx` lines 21–30: two `useQuery` calls with `queryKey: ['catalog-products']` and `queryKey: ['catalog-mops']`, both with `staleTime: 5 * 60 * 1000`. Return values not assigned (cache warming only). |
| 11 | AddRowForm disables dropdowns while catalog data is loading (isLoading guard) | ✓ VERIFIED | `AddRowForm.tsx` line 63: `const isCatalogLoading = productsLoading || mopsLoading`. Lines 108 and 151: `isDisabled={isPending \|\| isCatalogLoading}` on both AsyncSelect instances. |
| 12 | No cacheOptions on any AsyncSelect that uses cache-based load functions | ✓ VERIFIED | Grep found zero `cacheOptions` occurrences in both `AddRowForm.tsx` and `EditableCell.tsx`. |
| 13 | catalog.ts uses req.session.organizationId (not hard-coded 1) | ✓ VERIFIED | `catalog.ts` lines 11 and 21: `where: { organizationId: req.session.organizationId }`. Plan template had `organizationId: 1` as a placeholder; executor correctly used the session value. |

**Score:** 13/13 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/src/routes/catalog.ts` | catalogRouter with GET /products and GET /mops | VERIFIED | File exists, 26 lines, exports `catalogRouter`, two GET routes, no `requireRole`, `.toFixed(2)` price, `req.session.organizationId` tenant isolation, no `isActive: undefined` override |
| `packages/backend/src/app.ts` | `protectedRouter.use('/catalog', catalogRouter)` mount | VERIFIED | Line 19: `import { catalogRouter } from './routes/catalog.js'`. Line 97: `protectedRouter.use('/catalog', catalogRouter)` placed after `salesRouter` and before `app.use('/api', requireAuth, protectedRouter)`. |
| `packages/frontend/src/pages/SalesPage.tsx` | Two useQuery pre-fetch calls warming catalog cache | VERIFIED | Lines 21–30: both `queryKey: ['catalog-products']` and `queryKey: ['catalog-mops']` with `staleTime: 5 * 60 * 1000`. No props passed down from these queries. |
| `packages/frontend/src/components/sales/AddRowForm.tsx` | useQuery-based catalog loading | VERIFIED | Lines 49–63: two useQuery calls, `isCatalogLoading` guard, synchronous `loadProducts`/`loadMops` using `Promise.resolve(...)`, no `cacheOptions`, `isDisabled` includes `isCatalogLoading`. |
| `packages/frontend/src/components/sales/EditableCell.tsx` | useQuery-based catalog loading | VERIFIED | Lines 36–48: two useQuery calls with correct query keys. Lines 114–126: synchronous `loadProducts`/`loadMops`. No old async pattern. No `cacheOptions`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app.ts` | `catalog.ts` | `protectedRouter.use('/catalog', catalogRouter)` | WIRED | Import at line 19; mount at line 97 inside `protectedRouter` block, before `app.use('/api', requireAuth, protectedRouter)` |
| `catalog.ts` | `prisma.ts` | `prisma.product.findMany` / `prisma.mop.findMany` | WIRED | Lines 10 and 20 use `prisma.product.findMany` and `prisma.mop.findMany` respectively; prisma imported from `'../lib/prisma.js'` at line 2 |
| `SalesPage.tsx` | React Query cache | `useQuery(['catalog-products'])` + `useQuery(['catalog-mops'])` with staleTime 5min | WIRED | Both queries present at lines 21–30 with correct staleTime |
| `AddRowForm.tsx` | React Query cache | `useQuery(['catalog-products'])` read from cache warmed by SalesPage | WIRED | Same query keys used; React Query deduplicates — SalesPage fetch populates cache that AddRowForm reads |
| `EditableCell.tsx` | React Query cache | `useQuery(['catalog-products'])` and `useQuery(['catalog-mops'])` | WIRED | Both present at lines 37–48 with matching query keys |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `catalog.ts` GET /products | `products` | `prisma.product.findMany({ where: { organizationId: req.session.organizationId } })` | Yes — DB query via Prisma with soft-delete filter applied by `$extends` | FLOWING |
| `catalog.ts` GET /mops | `mops` | `prisma.mop.findMany({ where: { organizationId: req.session.organizationId } })` | Yes — DB query via Prisma with soft-delete filter | FLOWING |
| `AddRowForm.tsx` product AsyncSelect | `cachedProducts` | `useQuery` → `api.get('/catalog/products')` → catalog endpoint above | Flows from real DB through API to cache to select options | FLOWING |
| `AddRowForm.tsx` MOP AsyncSelect | `cachedMops` | `useQuery` → `api.get('/catalog/mops')` → catalog endpoint above | Same chain | FLOWING |
| `EditableCell.tsx` AsyncSelect | `cachedProducts` / `cachedMops` | Same React Query keys as AddRowForm — shares the SalesPage-warmed cache | Cache hit if SalesPage already fetched; falls back to network if not | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for TypeScript source files — no runnable entry point without starting the backend server. Human verification items in the next section cover the runtime behaviors.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROD-05 | 999-01-01-PLAN.md, 999-01-02-PLAN.md | Inactive products are hidden from the Product combo box in the sales sheet for new rows | SATISFIED | `$extends softDeleteFilter` in `prisma.ts` injects `isActive: true` on all `product.findMany` calls. Catalog endpoint does not override this. `AddRowForm.tsx` and `EditableCell.tsx` both source their product options from `/api/catalog/products` which returns active-only items. |
| PAY-05 | 999-01-01-PLAN.md, 999-01-02-PLAN.md | Inactive MOPs are hidden from the MOP combo box in the sales sheet for new rows | SATISFIED | Same mechanism — `$extends softDeleteFilter` on `mop.findMany`. Catalog endpoint `/api/catalog/mops` returns active-only. `AddRowForm.tsx` and `EditableCell.tsx` source MOP options from this endpoint. |

**Note on REQUIREMENTS.md traceability:** PROD-05 and PAY-05 are listed as "Phase 2 / Pending" in the traceability table. This phase (999-01) is a backlog bugfix that delivers the active-filtering behavior for these requirements ahead of Phase 2's formal catalog management UI. The requirements themselves are partially satisfied by this fix (the "hidden from dropdowns" behavior), though Phase 2 will complete the admin-side management (PROD-01–04, PAY-01–04) needed to mark them fully done.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Scan results:
- `catalog.ts`: No TODO/FIXME, no `return null`/`return {}`, no hardcoded empty arrays, no `organizationId: 1` (uses `req.session.organizationId`)
- `AddRowForm.tsx`: No `cacheOptions`, no old admin route calls, `Promise.resolve(...)` with real cache data (not empty arrays — populated by useQuery)
- `EditableCell.tsx`: No `cacheOptions`, no async loadProducts/loadMops pattern, no old admin route calls
- `SalesPage.tsx`: Both catalog queries present with staleTime, no props drilling

---

### Human Verification Required

The following items cannot be verified programmatically — they require a running application with real user sessions.

#### 1. Moderator product dropdown — Add Row form

**Test:** Log in as a moderator (role=moderator, canEdit=true). Navigate to Sales Sheet. Click "Add Row". Click the product dropdown.
**Expected:** Dropdown opens immediately with a list of active products. No 403 error. No spinner. No blank/empty dropdown.
**Why human:** Requires runtime session cookie with moderator role; requires verifying that `requireAuth` passes but `requireRole('admin')` on `/api/products` would block the old path.

#### 2. Moderator MOP dropdown — Add Row form

**Test:** Same moderator session. Click "Add Row". Click the MOP dropdown.
**Expected:** Dropdown opens immediately with active MOPs. No 403. No blank.
**Why human:** Runtime moderator session required.

#### 3. Moderator product dropdown — EditableCell inline edit

**Test:** Same moderator session. Click an editable product cell in an existing active row.
**Expected:** AsyncSelect opens immediately with product options. No network call triggered at click time (cache already warm from SalesPage mount).
**Why human:** Requires browser runtime and DevTools to confirm cache-hit vs network-request timing.

#### 4. Moderator MOP dropdown — EditableCell inline edit

**Test:** Same moderator session. Click an editable MOP cell.
**Expected:** AsyncSelect opens immediately with MOP options. No network call on click.
**Why human:** Same as above.

#### 5. Network tab — catalog called once on mount, not on each dropdown open

**Test:** Open DevTools Network tab. Log in. Navigate to Sales Sheet. Wait for page to load. Open Add Row and interact with dropdowns. Open multiple editable cells.
**Expected:** Exactly one GET /api/catalog/products and one GET /api/catalog/mops appear on page load. No additional catalog or admin-route calls appear when dropdowns open. No calls to /api/products or /api/mops from the frontend.
**Why human:** Network tab observation requires live browser session.

#### 6. Admin — no lag after void

**Test:** Log in as admin. Void a sales row. Immediately click "Add Row". Open the product dropdown.
**Expected:** Dropdown loads immediately. No lag from simultaneous catalog refetch (the old D-03 symptom).
**Why human:** Timing/performance observation; requires runtime with real data.

---

### Gaps Summary

No programmatic gaps found. All 13 must-have truths verified against the actual codebase. All artifacts exist and are substantive, wired, and data-flowing.

The phase goal is architecturally complete — the 403 root cause (moderators hitting admin-only routes) is eliminated by the new `/api/catalog/*` endpoints, and the refetch-lag root cause (per-render network calls) is eliminated by the React Query cache pre-fetch pattern.

Six human verification items remain that require a running application. These test runtime behavior (session role enforcement, cache timing, network tab) that cannot be inferred from static code analysis alone.

---

**Notable implementation improvement:** The executor used `req.session.organizationId` for tenant isolation in `catalog.ts` instead of the hard-coded `organizationId: 1` in the plan template. This is strictly better — it respects the multi-tenant architecture rule (CLAUDE.md Rule 5) and aligns with how all other routes handle organization scoping.

---

_Verified: 2026-06-24_
_Verifier: Claude (gsd-verifier)_
