# Phase 4: Admin Dashboard + Management - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin has full observability over all sales data through a filterable all-sales table, summary statistics, charts, and CSV export; and can manage the full user lifecycle (invite, edit username, toggle edit rights, reset password with immediate session revocation).

Delivers: DashboardPage (stats + charts + filterable all-sales table + CSV export), UsersPage (full user management), and supporting backend routes. SalesPage and all Phase 3 moderator functionality remain unchanged.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Page Structure
- **D-01:** DashboardPage (`/dashboard`) is the full admin hub: stats summary banner at top, 3 Recharts charts below, then the filterable all-sales table with CSV export. One page covers ADMIN-01 through ADMIN-12.
  - [auto] Recommended option — single hub avoids duplication and `/sales` stays clean as the shared inline-edit sheet.
- **D-02:** SalesPage (`/sales`) remains unchanged — shared inline-edit sheet for both admin and moderators. Admins who need to void or inline-edit rows use `/sales`. The admin-specific features (filters, extra columns, CSV, charts) live exclusively on DashboardPage.
- **D-03:** Admin all-sales table on DashboardPage shows ALL columns per ADMIN-02: Product, Price, MOP, Receiver, Notes, Created By, Created At, Last Edited By, Date Edited, Status (active/void). Each row has an Audit button (reuses AuditDrawer from Phase 3) and a Void button (calls POST /api/sales/:id/void, already implemented).

### Filtering Approach
- **D-04:** Client-side filtering. Fetch all rows via existing `GET /api/sales` (which already returns all rows with full snapshot columns). Filter in-memory on the fetched data. This is appropriate for an internal tool with a manageable dataset.
  - [auto] Recommended option — simpler than a separate admin endpoint; consistent with the existing data fetch pattern.
- **D-05:** Filter bar is always-visible above the all-sales table. Filters: date range (created date — start date + end date), product (select from loaded products), MOP (select from loaded MOPs), moderator/creator (select from loaded users). All filters applied live on change — no explicit "Apply" button.
- **D-06:** Filter state: `{ startDate: string | null, endDate: string | null, productId: number | null, mopId: number | null, createdById: number | null }`. Initial state = all nulls (no filter = show all).

### Stats and Charts Backend
- **D-07:** Dedicated `GET /api/admin/summary` backend endpoint. Returns precomputed aggregates:
  ```json
  {
    "totalCount": 42,
    "totalRevenue": "10500.00",
    "trendData": [{ "date": "2026-06-01", "count": 5 }],
    "productBreakdown": [{ "name": "Product A", "count": 12, "revenue": "3000.00" }],
    "mopBreakdown": [{ "name": "GCash", "count": 20 }]
  }
  ```
  Revenue arithmetic uses Prisma aggregation (`_sum { priceSnapshot }`) — never JS float. Returns revenue as string with `.toFixed(2)`.
  - [auto] Recommended option — server-side Decimal math is required per CLAUDE.md Rule 6; frontend must never sum Decimal values.
- **D-08:** Chart library: Recharts v2 (already specified in CLAUDE.md Tech Choices — not yet installed, needs adding to frontend package.json). Chart types:
  - Trend: `LineChart` — X axis = date (daily/weekly), Y axis = count of sales
  - Product breakdown: `BarChart` — X axis = product name, Y axis = count (or revenue)
  - MOP breakdown: `BarChart` — X axis = MOP name, Y axis = count
- **D-09:** Summary stats banner above charts: two stat cards — "Total Sales" (count) and "Total Revenue" (formatted string). Recharts charts below. Filterable all-sales table below charts.
  - Note: D-07 summary endpoint is NOT affected by client-side filters (it's an aggregate snapshot of all org data). Summary stats represent the full dataset, not the filtered view. CSV export and the displayed table respect the filters; charts and stats do not.

### CSV Export
- **D-10:** Frontend generates CSV from the currently-filtered rows in memory using `@json2csv/plainjs` (browser-compatible — no Node.js deps required). Install in `packages/frontend`.
  - [auto] Recommended option — since filtering is client-side, the frontend already holds the exact filtered dataset; no need for a duplicate server-side filter + CSV endpoint.
- **D-11:** CSV safety per ADMIN-09: sanitize every cell value — prepend a single quote `'` to any value starting with `=`, `-`, `+`, `@`, tab (`\t`), or carriage return (`\r`). UTF-8 BOM (U+FEFF, hex `EF BB BF`) prepended to the CSV string before download for correct Excel encoding.
- **D-12:** CSV columns: Product, Price, MOP, Receiver, Notes, Created By, Created At, Last Edited By, Date Edited, Status. Voided rows included with Status = "void" per ADMIN-08. Download triggered via `URL.createObjectURL(blob)` + synthetic `<a>` click.
- **D-13:** CSV filename: `sales-export-{ISO-date}.csv` (e.g., `sales-export-2026-06-25.csv`).

### User Management UI (UsersPage)
- **D-14:** UsersPage (`/users`) replaces the placeholder with a full user management table per the ProductsPage pattern: `@tanstack/react-table` v8, useQuery + useMutation, pessimistic per-row pending state.
- **D-15:** Table columns: Username | Role | Edit Rights | Status (active/inactive) | Actions. Actions per row: **Edit** (username), **Toggle canEdit** (Activate/Deactivate edit rights — for moderators only), **Reset Password**.
- **D-16:** Username editing via UserModal: clicking Edit on a row opens a modal pre-filled with the user's username. Save calls new `PATCH /api/users/:id/username` endpoint. Consistent with ProductModal pattern.
- **D-17:** Invite flow: "Invite Moderator" button in the UsersPage header calls `POST /api/auth/invite-generate` (already implemented). Opens a modal displaying the generated invite link with a "Copy Link" button. Admin shares the link manually. No new backend endpoint needed for invite — existing endpoint is reused.
- **D-18:** Reset Password: dedicated button per row → calls `POST /api/users/:id/reset-password` (already implemented). On success, modal shows the generated temp password once ("Copy and share this password — it won't be shown again."). Consistent with Phase 2 D-01/D-02/D-03.
- **D-19:** canEdit toggle is shown only for moderators (not for admin users — admins always have full access). Toggle calls existing `PATCH /api/users/:id` with `{ canEdit: boolean }`. Per-row pending state (same pessimistic pattern as ProductsPage `pendingToggleId`).

### Username Edit Backend Endpoint
- **D-20:** New `PATCH /api/users/:id/username` endpoint in `users.ts`. Accepts `{ username: string }`. Validates: non-empty, 2–100 chars, unique within organizationId (check via `prisma.user.findFirst` before update). Admin-only (usersRouter already mounts `requireRole('admin')` at router level — no extra guard needed). Returns updated user object.
- **D-21:** Username uniqueness check: `prisma.user.findFirst({ where: { username, organizationId, NOT: { id: targetId } } })`. If match found: 409 CONFLICT with `{ error: 'USERNAME_TAKEN' }`.

### Backend Admin Summary Endpoint
- **D-22:** `GET /api/admin/summary` mounted on `protectedRouter` with `requireRole('admin')`. New file: `packages/backend/src/routes/admin.ts`. Export `adminRouter`. Mount in `app.ts` as `protectedRouter.use('/admin', adminRouter)`.
- **D-23:** Summary query uses Prisma aggregations:
  - `prisma.sale.count({ where: { organizationId } })` for totalCount (includes active + void — both are overridden with explicit status: { in: [...] })
  - `prisma.sale.aggregate({ _sum: { priceSnapshot: true }, where: { organizationId, status: 'active' } })` for totalRevenue (active rows only)
  - `prisma.sale.groupBy({ by: ['createdAt'], ... })` or raw date-grouped query for trendData
  - `prisma.sale.groupBy({ by: ['productId', 'productNameSnapshot'], _count: true, _sum: { priceSnapshot: true } })` for productBreakdown
  - `prisma.sale.groupBy({ by: ['mopId', 'mopNameSnapshot'], _count: true })` for mopBreakdown
  - All with explicit `organizationId` filter and `status: { in: ['active', 'void'] }` override where needed

### Claude's Discretion
- Exact Recharts chart dimensions, color palette, and responsive container setup
- Whether trendData groups by day, week, or uses all granularity (day is reasonable default)
- Exact Tailwind layout of the stats banner cards (card width, spacing)
- Whether the filter bar uses react-select for product/MOP/moderator dropdowns (react-select v5 already installed — reuse it)
- Exact error handling in the CSV download (try/catch, user-visible error toast — simple alert is acceptable)
- Whether UsersPage shows inactive users (isActive = false) — show all users matching ProductsPage precedent

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture — non-negotiable locked decisions
- `CLAUDE.md` §Critical Architecture Rules — Rules 1–10. Most relevant for Phase 4: Rule 1 (express-session, not JWT — session invalidation on reset already live), Rule 6 (DECIMAL(10,2) — never JS float for revenue), Rule 8 (soft-delete filter — override explicitly in summary queries), Rule 9 (backend enforces RBAC).
- `.planning/STATE.md` §Key Decisions Locked — all locked decisions; especially server-side Decimal math for revenue, express-session pattern for session invalidation.

### Phase 4 requirements
- `.planning/ROADMAP.md` §Phase 4 — goal, 5 success criteria, full REQ-ID list (ADMIN-01 through ADMIN-12, USERS-01 through USERS-06).
- `.planning/REQUIREMENTS.md` — Full requirement text for all Phase 4 REQ-IDs.

### Existing backend infrastructure (already implemented — Phase 4 builds on top)
- `packages/backend/src/app.ts` — protectedRouter at line 92–98. Phase 4 adds `protectedRouter.use('/admin', adminRouter)`. Do NOT change middleware order.
- `packages/backend/src/routes/users.ts` — GET /api/users (all users), PATCH /api/users/:id (canEdit toggle), POST /api/users/:id/reset-password. Phase 4 adds PATCH /api/users/:id/username.
- `packages/backend/src/routes/sales.ts` — GET /api/sales returns all rows newest-first with all snapshot columns + createdByUsername, createdAt, updatedAt. Phase 4 reuses this endpoint for DashboardPage admin table.
- `packages/backend/src/routes/auth.ts` — POST /api/auth/invite-generate already exists. UsersPage calls this endpoint directly.
- `packages/backend/src/lib/prisma.ts` — Prisma client singleton; all admin routes use this.
- `packages/backend/src/middleware/requireRole.ts` — Already applied at usersRouter level; apply at adminRouter level for the new summary endpoint.

### Existing frontend infrastructure (Phase 4 fills placeholders + adds components)
- `packages/frontend/src/pages/DashboardPage.tsx` — Placeholder (10 lines). Phase 4 replaces with full admin hub.
- `packages/frontend/src/pages/UsersPage.tsx` — Placeholder (10 lines). Phase 4 replaces with full user management.
- `packages/frontend/src/router/index.tsx` — `/dashboard` and `/users` routes already wired; no router changes needed.
- `packages/frontend/src/layouts/AuthenticatedLayout.tsx` — ADMIN_NAV already includes Dashboard, Sales, Products, MOPs, Users. No nav changes needed.

### Phase 3 components available for reuse (ADMIN-12)
- `packages/frontend/src/components/sales/AuditDrawer.tsx` — Existing audit drawer. DashboardPage admin table rows can open this for ADMIN-12 without rebuilding it.
- `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` — Existing void confirmation. Reuse in DashboardPage if admin wants to void rows from the admin table.
- `packages/frontend/src/components/Modal.tsx` — Shared modal wrapper. Reuse for UserModal, invite modal, reset-password modal.
- `packages/frontend/src/components/StatusBadge.tsx` — Reuse for void/active status display in admin table and users table.

### Phase 2/3 patterns to follow
- `packages/frontend/src/pages/ProductsPage.tsx` — Reference for @tanstack/react-table v8 column defs, useQuery + useMutation, pessimistic per-row pending state, modal open/close flow.
- `packages/frontend/src/components/catalog/ProductModal.tsx` — Reference modal form pattern for UserModal.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AuditDrawer.tsx` — Existing slide-in drawer; takes `saleId` prop, fetches audit entries. Directly reusable for ADMIN-12 in DashboardPage.
- `VoidConfirmDialog.tsx` — Existing void confirmation dialog; reusable if DashboardPage exposes void action on admin table rows.
- `Modal.tsx` — Shared modal wrapper; use for UserModal (edit username), invite modal, reset-password modal.
- `StatusBadge.tsx` — Active/Inactive chip; extend or reuse for active/void sale status and user isActive status.
- `ProductsPage.tsx` + `ProductModal.tsx` — Full reference implementation for the table + modal pattern that UsersPage should follow.
- `react-select` v5 — Already installed; use for product/MOP/moderator filter dropdowns in DashboardPage filter bar.
- `@tanstack/react-table` v8 — Already installed; use for both DashboardPage admin table and UsersPage table.
- `usersRouter` in `users.ts` — GET, canEdit PATCH, reset-password POST all already implemented. Phase 4 adds only the username PATCH.

### Established Patterns
- Pessimistic per-row pending state: `pendingToggleId` pattern from ProductsPage — replicate in UsersPage for canEdit toggle.
- useQuery / useMutation + `queryClient.invalidateQueries` — exact same pattern everywhere.
- Error handler reads `err.statusCode` + `err.code` — throw `{ statusCode: 409, code: 'USERNAME_TAKEN' }` for duplicate username conflict.
- Admin routes: requireRole('admin') at router level (usersRouter precedent) — follow same pattern for adminRouter.

### Integration Points
- `packages/backend/src/app.ts` line 98: `app.use('/api', requireAuth, protectedRouter)` — add `protectedRouter.use('/admin', adminRouter)` to mount the summary endpoint.
- `packages/frontend/src/pages/DashboardPage.tsx` — Replace placeholder content with AdminDashboard component (or inline implementation).
- `packages/frontend/src/pages/UsersPage.tsx` — Replace placeholder content with user management table.
- Recharts v2 needs installing: `npm install recharts` in `packages/frontend`. @json2csv/plainjs needs installing for CSV export.

</code_context>

<specifics>
## Specific Ideas

- The DashboardPage admin all-sales table is read-display focused (not inline-edit). Clicking the Audit button opens AuditDrawer for that row. Clicking Void opens VoidConfirmDialog. No inline cell editing — admins who need to edit individual cells use `/sales`.
- trendData grouping by day: `GROUP BY DATE(createdAt)` or Prisma `groupBy` with date truncation. For small datasets, the planner may opt to compute this in JS from the raw grouped records rather than raw SQL.
- productBreakdown should use `productNameSnapshot` (not join to products) — consistent with Rule 4 (price snapshot principle applied to name too).
- mopBreakdown should use `mopNameSnapshot` for the same reason.
- Summary endpoint includes all rows (active + void) in totalCount, but totalRevenue includes only active rows (voided rows should not count toward revenue).
- React Query key for admin summary: `['admin-summary']`. React Query key for users: `['users']` (matches existing usersRouter GET).
- The UsersPage "Invite Moderator" button should be visible in the page header (same position as "Add Product" in ProductsPage).
- Username conflict on edit should show inline error in the UserModal form, not a page-level alert.

</specifics>

<deferred>
## Deferred Ideas

- Global audit log feed (all changes across all tables) — v2 requirement, explicitly listed in REQUIREMENTS.md v2 section.
- Audit logging for admin actions on products/MOPs/users — v2.
- Pagination or server-side virtual scroll for admin sales table — not needed for v1 (internal tool, manageable dataset). If dataset grows large, Phase 4 can add server-side pagination in a backlog fix.
- Advanced chart interactions (click-to-filter, tooltips with drill-down) — basic Recharts tooltips are fine; advanced filtering via chart click is v2.
- Export format options beyond CSV (PDF, Excel native) — v2.
- Bulk user operations (bulk invite, bulk deactivate) — v2.

</deferred>

---

*Phase: 04-admin-dashboard*
*Context gathered: 2026-06-25*
