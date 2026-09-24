---
phase: 14-moderator-product-management
plan: 01
subsystem: api
tags: [rbac, express, prisma, audit-log, react-query, react-hook-form, transactions]

# Dependency graph
requires:
  - phase: 09-delete-products-mops-users
    provides: soft-delete (deletedAt) on Product, existing PATCH/toggle/DELETE endpoints
  - phase: 12-moderator-void-requests
    provides: recent moderator-permission and audit-log patterns reused here
provides:
  - "requireRole(...roles) rest-params multi-role guard, backward-compatible with every existing single-role call site"
  - "Moderator full-parity product management: create/edit/toggle/delete on the existing /api/products/* endpoints, no canEdit or shift gate"
  - "Audit trail on every product mutation (create/name/price/isActive/deletedAt), same transaction, no role branch"
  - "409 DUPLICATE_PRODUCT_NAME case-insensitive/trimmed duplicate-name guard on create and rename"
  - "['catalog-products'] cache invalidation on every product mutation for same-tab sales-sheet freshness"
affects: [15-*, any future phase touching products.ts, requireRole.ts, or the product audit-row shape]

# Actuals (#2632)
actuals:
  tokens: 7980
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "requireRole(...roles: Array<'admin' | 'moderator'>) rest-params widening — every existing single-arg call site needs zero changes"
    - "Module-private productAudit()/nameTaken() helpers colocated in products.ts, same shape as sales.ts's audit-in-tx pattern"
    - "updateMany + count race guard for toggle/delete (state-predicate where clause, count === 0 => 404) instead of a combined-where update()"
    - "Explicit useMutation<TData, Error, TVariables> generics to keep TError as Error when the onError callback parameter is typed unknown"

key-files:
  created:
    - packages/backend/src/routes/products.check.ts
  modified:
    - packages/backend/src/middleware/requireRole.ts
    - packages/backend/src/routes/products.ts
    - packages/backend/src/app.ts
    - packages/frontend/src/router/index.tsx
    - packages/frontend/src/layouts/AuthenticatedLayout.tsx
    - packages/frontend/src/pages/ProductsPage.tsx
    - packages/frontend/src/components/catalog/ProductModal.tsx
    - packages/frontend/src/components/catalog/ProductDeleteConfirmDialog.tsx

key-decisions:
  - "requireRole widened via rest-params (...roles) rather than an array param, per CONTEXT.md discretion — zero changes needed to the ~13 other call sites"
  - "toggle/delete map onto AuditAction 'update' with fieldName 'isActive'/'deletedAt' — no schema/enum migration"
  - "Duplicate-name check relies on the column's utf8mb4_unicode_ci collation for case-insensitivity, not Prisma's mode: 'insensitive' (Postgres-only, unsupported on MySQL)"
  - "useMutation<Product, Error, ProductFormData> explicit generics avoid TError being inferred as unknown from onNameConflict's (err: unknown) parameter"

patterns-established:
  - "Rest-params role-guard widening is the reusable pattern for admitting a second role to any single-role router without touching other call sites"
  - "updateMany + count is the project's standard race guard for state-transition mutations (toggle/delete-style), superseding combined-where update()"

requirements-completed: [PROD-01, PROD-02, PROD-03, PROD-04, ROLES-07, ROLES-08, ROLES-09]

coverage:
  - id: D1
    description: "Moderator sees Products in the sidebar (Sales Sheet → Shift History → Products) and opens /products without a redirect; identical page/modal to admin, no role branching"
    requirement: "ROLES-07"
    verification:
      - kind: unit
        ref: "grep acceptance criteria — MODERATOR_NAV label order, /products route position, zero useAuthStore|getAuthUser hits in ProductsPage/ProductModal/ProductDeleteConfirmDialog"
        status: pass
    human_judgment: true
    rationale: "Visual sidebar order and modal parity require a human to look at the rendered UI — grep confirms the code shape but not the rendered UX"
  - id: D2
    description: "Moderator (canEdit false, no open shift) can create, rename, re-price, toggle, and delete products through the widened /api/products/* endpoints"
    requirement: "PROD-01"
    verification:
      - kind: e2e
        ref: "packages/backend/src/routes/products.check.ts (product checks passed) — written and tsc/type-checked, NOT executed this run (port 3001 held by the user's own dev server; see Deviations)"
        status: unknown
    human_judgment: true
    rationale: "The runnable e2e check exists and is believed correct (tsc-clean, exact acceptance-criteria greps pass), but its actual pass/fail was not observed in this run — deferred to the orchestrator's post-merge execution"
  - id: D3
    description: "Every product mutation (create/name/price/isActive/deletedAt) writes an audit_log row in the same Prisma transaction, for admin and moderator alike, with no viewer UI added"
    requirement: "PROD-01"
    verification:
      - kind: unit
        ref: "grep acceptance criteria — 4x prisma.$transaction, 2x tx.product.updateMany, 6x productAudit(), 1x tableName: 'products', 5 total router methods (no new endpoint)"
        status: pass
    human_judgment: false
  - id: D4
    description: "409 DUPLICATE_PRODUCT_NAME on create/rename (case-insensitive, trimmed, inactive-blocks, deleted-frees, self case-variant OK); ProductModal shows it inline under Product Name"
    requirement: "PROD-02"
    verification:
      - kind: unit
        ref: "grep acceptance criteria — 2x DUPLICATE_PRODUCT_NAME (non-comment) in products.ts; onError: onNameConflict x2, setError('name', ...) x1, exact inline copy x1 in ProductModal.tsx"
        status: pass
    human_judgment: true
    rationale: "Backend logic and wiring are grep/tsc-verified; the actual inline-error rendering in the browser was not visually confirmed this run"
  - id: D5
    description: "Product mutations invalidate ['catalog-products'] alongside ['products'] so the same tab's sales-sheet dropdowns refresh immediately"
    requirement: "PROD-04"
    verification:
      - kind: unit
        ref: "grep acceptance criteria — queryKey: ['catalog-products'] count 2 in ProductModal.tsx, 1 in ProductsPage.tsx, 1 in ProductDeleteConfirmDialog.tsx"
        status: pass
    human_judgment: false

# Metrics
duration: ~30min (active; excludes the mid-plan human checkpoint wait for Docker/MySQL)
completed: 2026-09-24
status: complete
---

# Phase 14 Plan 01: Moderator Product Management Summary

**Moderators get full product-catalog parity with admins (widened `requireRole` RBAC), every product mutation now writes an in-transaction audit row, and a case-insensitive 409 duplicate-name guard backs both create and rename.**

## Performance

- **Duration:** ~30min active work, split across two sessions around a human checkpoint (Docker/MySQL was down at first attempt)
- **Tasks:** 3/3 completed
- **Files modified:** 8 modified, 1 created

## Accomplishments

- `requireRole` widened to rest-params (`...roles: Array<'admin' | 'moderator'>`); `products.ts` is the only router that now passes two roles — every other router's guard is byte-identical to before
- `/products` moved into the both-roles route group and `MODERATOR_NAV` gained a Products entry (`Sales Sheet → Shift History → Products`) — `ProductsPage`/`ProductModal` are used unchanged by both roles, no role branching added
- All four product mutations (create, rename/re-price, toggle, delete) write `audit_log` rows inside the same `prisma.$transaction` as the write, for admin and moderator alike; toggle and delete use `updateMany` + count as the concurrency guard (project memory: combined-where `update()` doesn't reliably reject non-matching writes here)
- `nameTaken()` duplicate-name guard: case-insensitive (MySQL collation, not Prisma's Postgres-only `mode: 'insensitive'`), trimmed, excludes only soft-deleted products, blocks against inactive products too; POST and PATCH `/:id` both return `409 DUPLICATE_PRODUCT_NAME`
- `ProductModal` shows "A product with this name already exists." inline under Product Name on a 409, suppressing the generic error for that case; create/update/toggle/delete all invalidate `['catalog-products']` so the sales-sheet dropdowns refresh in the same tab

## Task Commits

1. **Task 1 (tracer): moderator sees Products in the sidebar → /products route admits them → widened RBAC → product create + audit row in one transaction** - `ebd82b0` (feat)
2. **Task 2: rename, re-price, toggle and delete are audited in-transaction, race-guarded, and duplicate names get 409** - `938069d` (feat)
3. **Task 3: ProductModal shows the duplicate-name 409 inline, and every product mutation refreshes the sales-sheet product dropdowns** - `4f2a49e` (feat)

**Plan metadata:** committed together with this SUMMARY.md (docs commit follows, per worktree-mode conventions — STATE.md/ROADMAP.md are NOT touched here).

## Files Created/Modified

- `packages/backend/src/middleware/requireRole.ts` - widened to rest-params multi-role guard
- `packages/backend/src/routes/products.ts` - guard, `productAudit()`/`nameTaken()` helpers, all four mutations transactional + audited + duplicate-checked
- `packages/backend/src/routes/products.check.ts` - new runnable end-to-end check covering D-01, D-03..D-07, D-09, D-10
- `packages/backend/src/app.ts` - products mount comment updated (admin-only → admin + moderator)
- `packages/frontend/src/router/index.tsx` - `/products` moved into the both-roles route group
- `packages/frontend/src/layouts/AuthenticatedLayout.tsx` - `MODERATOR_NAV` gains Products
- `packages/frontend/src/pages/ProductsPage.tsx` - header comment reworded, `toggleMutation` invalidates `catalog-products`
- `packages/frontend/src/components/catalog/ProductModal.tsx` - `onNameConflict` 409 handler, `isNameConflict` flag, `catalog-products` invalidation
- `packages/frontend/src/components/catalog/ProductDeleteConfirmDialog.tsx` - `deleteMutation` invalidates `catalog-products`

## Decisions Made

- Kept `requireRole`'s rest-params signature exactly as CONTEXT.md's discretion suggested — the smallest diff, since every other of the ~13 call sites needed zero edits (verified via grep in Task 1's acceptance criteria)
- `useMutation<Product, Error, ProductFormData>` explicit generics in `ProductModal.tsx`: without them, TypeScript infers `TError` as `unknown` from `onNameConflict`'s `(err: unknown) => void` parameter (the plan's specified signature), which then fails `ReactNode` assignability on the generic-error JSX. Pinning the generics to `Error` (react-query's own default) fixes this while keeping `onNameConflict`'s parameter type exactly as specified — `unknown` is a valid contravariant widening of `Error`, so the callback still type-checks against the pinned generic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `useMutation` TError inference producing a JSX type error**
- **Found during:** Task 3 (ProductModal 409 handling)
- **Issue:** Adding `onError: onNameConflict` (parameter typed `(err: unknown) => void`, per the plan's own interface spec) caused TypeScript to infer the `useMutation` `TError` generic as `unknown` instead of the default `Error`, which then failed `packages/frontend/src/components/catalog/ProductModal.tsx(128,9): error TS2322: Type 'unknown' is not assignable to type 'ReactNode'` on the generic-error JSX block.
- **Fix:** Pinned explicit generics `useMutation<Product, Error, ProductFormData>` on both `createMutation` and `updateMutation`. `onNameConflict`'s wider `unknown` parameter type remains valid (contravariantly assignable) against the now-fixed `Error` `TError`.
- **Files modified:** `packages/frontend/src/components/catalog/ProductModal.tsx`
- **Verification:** `npx tsc -p packages/frontend/tsconfig.json` exits 0
- **Committed in:** `4f2a49e` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** No scope creep — a pure type-level fix required to make the plan's specified `onNameConflict` signature compile cleanly with `useMutation`.

## Issues Encountered

- **Unmet precondition, resolved mid-plan via checkpoint:** Task 1's `<precondition>` ("the dev MySQL container is running") was unmet at first attempt — Docker Desktop itself was not running on the host machine (`docker ps` couldn't reach the daemon; no `mysqld.exe`/`Docker Desktop.exe` process; `localhost:3306` refused connections). Per the precondition protocol, execution halted with zero commits and a `checkpoint:human-verify` was returned rather than self-remediating. The user enabled Docker; the orchestrator verified `alejinput-mysql-1` healthy on `0.0.0.0:3306` before resuming. All Task 1 code (written before the halt) was already tsc-clean and grep-verified, so no rework was needed on resume — only the commit and the live check remained.
- **Live `products.check.ts` run deferred to the orchestrator (both Task 1 and Task 2):** Port 3001 was occupied by a pre-existing process (started ~10 minutes before the resume, well before this session touched it) that is not the dev API I started — consistent with "the user's own dev server" per this worktree's documented environment notes. Per that explicit fallback ("do not start a second API... skip the live run... rely on tsc plus grep... orchestrator re-runs `products.check.ts` against the merged tree"), the live e2e run was **not** executed against this worktree's code. Every static verification available was run instead and passed: `tsc -p packages/backend/tsconfig.json --noEmit` (0 errors), `tsc -p packages/frontend/tsconfig.json` (0 errors), and every acceptance-criteria grep from all three tasks (exact expected counts, verified individually and reported above). The orchestrator should run `cd packages/backend && npx tsx src/routes/products.check.ts` against the merged tree post-merge and confirm it prints `product checks passed` before considering Phase 14 fully verified.
- **Dev-API cleanup:** The dev API I started from this worktree during the first (pre-checkpoint) attempt was force-killed (`taskkill //F //PID 5184`) and port 3001 was confirmed free before the checkpoint was raised. No second API instance was started during the resume, since port 3001 was already occupied by what is believed to be the user's own server; no processes were started or touched in the resume session.

## Known Stubs

None — no hardcoded empty values, placeholder text, or unwired data sources introduced.

## User Setup Required

None - no external service configuration required. (The dev MySQL container needing to be running is a local dev-environment precondition, not a new setup step introduced by this plan.)

## Next Phase Readiness

- All three tasks' static verification (tsc + full acceptance-criteria grep set) passes cleanly on this worktree's HEAD.
- **Blocking item before Phase 14 is considered fully verified:** the orchestrator (or a follow-up session) must run `cd packages/backend && npx tsx src/routes/products.check.ts` against the merged tree with the dev API and MySQL both up, and confirm it prints `product checks passed`. The script covers D-01, D-03..D-07, D-09, D-10 end-to-end (moderator RBAC, audit-row sequence for both roles, the full duplicate-name matrix, and 404s after delete) and was not executed in this run due to port 3001 contention with a pre-existing process.
- UI parity (moderator sidebar order, identical page/modal rendering, the inline duplicate-name error, and the same-tab dropdown refresh) is explicitly left to `/gsd-verify-work` UAT per the plan's own `<verification>` section — nothing in this plan's scope required visual confirmation to commit.

---
*Phase: 14-moderator-product-management*
*Completed: 2026-09-24*
