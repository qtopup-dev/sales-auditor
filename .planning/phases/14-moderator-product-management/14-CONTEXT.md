# Phase 14: Moderator Product Management - Context

**Gathered:** 2026-09-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Moderators can open `/products` and manage the product catalog exactly like admins: create, edit name/price, activate/deactivate, and (soft) delete. The route guard, the moderator sidebar nav, and the backend RBAC on `/api/products/*` are opened to the `moderator` role. The phase also adds an audit trail for product mutations (all roles), a duplicate-name guard, and an immediate refresh of the sales-sheet product dropdown after product changes.

MOPs, receivers, users, and all other admin surfaces stay admin-only.

</domain>

<decisions>
## Implementation Decisions

### Scope of Moderator Access
- **D-01:** Full parity. Moderators get create, edit (name/price), toggle active/inactive, and delete, all on the existing endpoints in `packages/backend/src/routes/products.ts`. Delete remains the existing soft delete (`deletedAt`). Sales rows are untouched: their price and name snapshots keep history safe.
- **D-02:** The moderator sees the identical `ProductsPage` / `ProductModal`, including inactive products and all buttons. No role branching in the page.
- **D-03:** Products only. `/api/mops`, `/api/receivers`, and their pages stay admin-only.

### Edit Rights & Shift Gating
- **D-04:** Product management does NOT depend on `canEdit`. Any authenticated, active moderator can manage products, and `canEdit` stays scoped to sales rows.
- **D-05:** No active shift required. Product mutations work whether or not the moderator is clocked in.

### Audit Trail
- **D-06:** Every product mutation (create, name edit, price edit, active toggle, delete) writes `audit_log` rows **in the same Prisma transaction** as the change (CLAUDE.md Rule 2 spirit). Rows use `tableName: 'products'`, `rowId` = product id, `saleId: null`, actor `userId` + `userUsername`, and old → new values (money as `toFixed(2)` strings).
- **D-07:** Changes are logged for **all roles** (admin and moderator alike), with no role branch.
- **D-08:** No viewer UI in this phase. The data is only recorded.

### Duplicate Names
- **D-09:** Creating or renaming a product is rejected when another **non-deleted** product (active OR inactive) in the org has the same name, **case-insensitive** and after trimming. The backend returns `409` with an error code (e.g. `DUPLICATE_PRODUCT_NAME`), and `ProductModal` shows it as an inline error on the name field. Only deleted products free up a name. Renaming a product to its own current name (or a case variant of it) is not a conflict. — **Reversibility:** reversible. It is app-level validation, not a DB unique constraint (a DB constraint can't easily express "non-deleted, case-insensitive" here).
- **D-10:** Existing duplicates (if any) are not migrated or cleaned up. The rule applies only to new creates and renames.

### Catalog Freshness
- **D-11:** Product mutations (create/edit/toggle/delete in `ProductsPage` / `ProductModal`) also invalidate the `['catalog-products']` query, so the same tab's sales-sheet dropdowns (`AddRowForm`, `EditableCell`, `SalesPage`) reflect the change immediately. Other sessions keep the existing 5-minute `staleTime` behavior.

### Sidebar
- **D-12:** Moderator nav becomes `Sales Sheet → Shift History → Products`, labeled `Products` (same as admin).

### Claude's Discretion
- How to open RBAC. For example, widen `requireRole` to accept multiple roles (`requireRole('admin', 'moderator')` or an array), or pass a different guard on the products router. Other routers' behavior must stay unchanged.
- How the frontend route guard admits both roles for `/products` (e.g. `requiredRole` accepting an array, or moving `/products` into its own guard group). The admin redirect behavior for other routes must stay unchanged.
- How toggle and delete map onto the existing `AuditAction` enum (`create | update | void`). Prefer `update` with `fieldName: 'isActive'` / `'deletedAt'` over a schema/enum migration unless there's a strong reason.
- Whether the audit write goes through a small helper or is inline per route, and the exact oldValue/newValue formatting for the create row.
- The exact inline error copy for a duplicate name.
- Updating the stale "admin only" comments in `products.ts`, `app.ts`, and `ProductsPage.tsx`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project rules
- `CLAUDE.md` — Critical Architecture Rules (Rule 2 audit-in-transaction, Rule 3 soft delete, Rule 6 money as DECIMAL/strings, Rule 9 backend RBAC)
- `.planning/ROADMAP.md` §Phase 14 — phase goal
- `.planning/REQUIREMENTS.md` — PROD-01..04 and ROLES-07/08/09 (the original admin-only wording that this phase relaxes for products)

### Prior phase context
- `.planning/phases/999-01-fix-add-row-catalog/999-01-CONTEXT.md` — catalog query/caching decisions (`catalog-products` query)
- `.planning/phases/12-moderator-void-requests/12-CONTEXT.md`, `.planning/phases/13-moderator-sales-sheet-tip-column/13-CONTEXT.md` — recent audit-log and moderator-permission patterns

No external specs. Requirements are fully captured in the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/backend/src/routes/products.ts`: all product endpoints already exist (GET, POST, PATCH `/:id`, PATCH `/:id/toggle`, DELETE `/:id` soft delete). Only the guard, audit writes, and duplicate check change.
- `packages/frontend/src/pages/ProductsPage.tsx` + `components/catalog/ProductModal.tsx`: reused unchanged apart from the `['catalog-products']` invalidation and the 409 inline error.
- `audit_log` model (`packages/backend/prisma/schema.prisma` ~L203) is generic (`tableName`, `rowId`, nullable `saleId`), so it needs no migration for product rows.
- Audit-write pattern in `packages/backend/src/routes/sales.ts` (~L279, L382+): `tx.auditLog.create` inside `prisma.$transaction`.

### Established Patterns
- `requireRole(role)` in `packages/backend/src/middleware/requireRole.ts` accepts a single role and is mounted at router level (`productsRouter.use(requireRole('admin'))`).
- Frontend `ProtectedRoute({ requiredRole })` in `packages/frontend/src/router/index.tsx`: a wrong role redirects to `/dashboard` (admin) or `/sales` (moderator). `/products` currently sits in the admin-only group.
- Nav arrays `ADMIN_NAV` / `MODERATOR_NAV` in `packages/frontend/src/layouts/AuthenticatedLayout.tsx`.
- `$extends` soft-delete filter defaults `isActive: true` / `deletedAt: null`. `products.ts` passes `isActive: undefined` to see inactive rows. The duplicate check must include inactive rows and exclude deleted ones.
- Per memory `project_prisma_updatemany_race_guard`: combined-where `update()` doesn't reliably reject non-matching writes here, so use `updateMany` + count for status guards when relevant.

### Integration Points
- `packages/backend/src/app.ts` L106: products router mount.
- `packages/frontend/src/router/index.tsx` L53-58: admin-only route group containing `/products`.
- `packages/frontend/src/layouts/AuthenticatedLayout.tsx` L24-27: `MODERATOR_NAV`.
- Sales-sheet catalog consumers: `AddRowForm.tsx` L73, `EditableCell.tsx` L47, `SalesPage.tsx` L54 (`['catalog-products']`, 5-minute staleTime).

</code_context>

<specifics>
## Specific Ideas

- "Exactly like admins": the moderator experience on `/products` should be indistinguishable from the admin's.

</specifics>

<deferred>
## Deferred Ideas

- Product change-history viewer (a "last changed by" note or a history drawer on `/products`, or an admin audit screen for products). The data is recorded from this phase on, and the viewer would be its own phase.
- Opening MOP / receiver management to moderators, which would be its own phase.

</deferred>

---

*Phase: 14-moderator-product-management*
*Context gathered: 2026-09-24*
