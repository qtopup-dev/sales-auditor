# Phase 3: Sales Core - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Moderators can enter, edit, and void sales rows in a spreadsheet-like inline-edit interface, and every write is captured in an immutable audit log written in the same database transaction.

Delivers: sales backend routes (CRUD + void + audit), SalesPage with virtual-scrolled inline-edit table, Add Row flow, field-level cell editing with blur-save, void action (admin only), and per-row audit log drawer (AUDIT-03).

</domain>

<decisions>
## Implementation Decisions

### SALES-03: Notes Field / Row Height Strategy
- **D-01:** True dynamic row heights via `@tanstack/react-virtual` v3 `measureElement` ref callback. Notes field content expands the row height. `virtualizer.measureElement(node)` is called on each row's DOM node ref so the virtualizer tracks actual rendered heights. Row heights update after cell edits without losing scroll position.
  - Folded from STATE.md todo: "Confirm with user: SALES-03 dynamic row heights vs CSS truncation + tooltip". Auto-resolved to true dynamic heights — SALES-03 and SALES-12 explicitly require it, and the Phase 3 success criterion states "if CSS truncation with tooltip is used instead of true dynamic heights, this must be confirmed acceptable before phase closes." Dynamic heights is the compliant option.

### Add Row UX
- **D-02:** The "Add Row" button prepends a new blank row as the FIRST item rendered in the virtual list. This row renders as an inline form row with input fields (not a modal). An explicit **Save** button completes creation (POST /api/sales). A **Cancel** button or Escape dismisses without saving. Save is disabled until Product, MOP, and Receiver are filled (required per SALES-14). **Blur does NOT auto-save new rows** — only blur-save applies to existing row edits (SALES-06 is for edits only).
- **D-03:** Only one "add row" form can be open at a time. While the add row form is open, clicking cells on existing rows is blocked (prevent competing edit state).

### Inline Cell Editing (Existing Rows)
- **D-04:** True cell-by-cell inline editing. Clicking an editable cell replaces the display value with an `<input>` (for text fields) or `<textarea>` (for Notes). Blur triggers `PATCH /api/sales/:id` for that single cell. The cell is disabled and shows a save indicator during the round-trip (SALES-06). One cell is active at a time across the entire table.
- **D-05:** Zustand edit-mode store tracks: `{ activeCellSaleId: number | null, activeCellField: string | null, draftValue: string }`. This is isolated from React Query server state (prevents focus-loss bugs during virtual scroll redraws — STATE.md pitfall).
- **D-06:** Editable cells per role: moderator can edit Product, MOP, Receiver, Notes on rows they created (if canEdit = true). Admin can edit any field on any row. Price is always read-only (locked — SALES-09). Date Edited is auto-timestamp (not manually editable). Voided rows: no cells are editable.

### Backend API — Sales Routes
- **D-07:** Sales routes at `/api/sales`, mounted on the protectedRouter in `app.ts` (accessible to all authenticated users with role enforcement per route):
  - `GET /api/sales` — all rows for org, newest-first (`ORDER BY createdAt DESC`), no server-side pagination (virtual scroll handles display). Returns full Sale objects including snapshots. Max rows: no limit enforced in v1 (internal tool, manageable dataset).
  - `POST /api/sales` — create row. Body: `{ productId, mopId, receiver, notes? }`. Backend reads product.name + product.price + mop.name, writes snapshots. Creates audit 'create' record in same Prisma transaction.
  - `PATCH /api/sales/:id` — edit one field. Body: `{ field: string, value: string }`. Backend reads current value, validates field is editable, writes new value + audit 'update' record in same Prisma transaction. Allowed fields: `productId`, `mopId`, `receiver`, `notes`. Changing `productId` must also update `productNameSnapshot` and `priceSnapshot` atomically in the same transaction.
  - `POST /api/sales/:id/void` — void a row (admin only). Creates audit 'void' record in same transaction. Sets `status = 'void'`.
  - `GET /api/sales/:id/audit` — return audit entries for this sale, newest-first (AUDIT-03).
- **D-08:** `productNameSnapshot`, `priceSnapshot`, `mopNameSnapshot`, and `createdByUsername` are written at creation time and never re-queried from the catalog tables for display (CLAUDE.md Rule 4). When `productId` is updated via PATCH, the backend refreshes `productNameSnapshot` and `priceSnapshot` atomically.

### PATCH Granularity
- **D-09:** Field-level PATCH. Each blur sends one field change: `{ field: 'receiver', value: 'John Doe' }`. One Prisma transaction per PATCH: read old value → write new value + audit record. This matches AuditLog schema exactly (fieldName, oldValue, newValue). No batched multi-field updates in v1.

### Void Flow
- **D-10:** Actions column appears as the rightmost column in the sales table. Admin sees: **Void** button + **Audit** button. Moderator sees: **Audit** button (read-only; ROLES-06 — only admin can void). Clicking **Void** shows a confirmation dialog ("Are you sure you want to void this row? This action cannot be undone."). On confirm: `POST /api/sales/:id/void`.
- **D-11:** Voided rows remain in the table with strikethrough styling applied to all cell content (SALES-15). A "Void" status indicator is shown in the actions column (or a dedicated status column). Voided row cells are NOT editable.

### Audit Log Drawer (AUDIT-03)
- **D-12:** Implement audit drawer in Phase 3 (AUDIT-03 is in Phase 3 requirements). Clicking the **Audit** button in the actions column opens a slide-in drawer on the right side of the screen. The drawer shows all AuditLog entries for that sale, newest-first. Each entry shows: timestamp (UTC), username, action type, field changed (for updates), old value, new value.
- **D-13:** Drawer is read-only. Uses `GET /api/sales/:id/audit`. This drawer serves AUDIT-03. ADMIN-12 in Phase 4 may add more detail or reuse the same drawer — Phase 4 planner decides.

### Backend Ownership / RBAC Enforcement
- **D-14:** All ownership and role checks are enforced server-side (ROLES-09):
  - `POST /api/sales`: any authenticated user can create (moderator or admin)
  - `PATCH /api/sales/:id`: check `(req.session.userId === sale.createdById && user.canEdit === true) || user.role === 'admin'` → 403 FORBIDDEN otherwise
  - `POST /api/sales/:id/void`: check `user.role === 'admin'` → 403 FORBIDDEN otherwise
  - `GET /api/sales/:id/audit`: check `user.role === 'admin'` → 403 FORBIDDEN otherwise (moderator does not see audit log)
- **D-15:** Voided rows: visible to all authenticated users in the sales list (SALES-15). Moderators see voided rows but cannot edit them.

### Frontend Architecture
- **D-16:** `SalesPage.tsx` (existing placeholder) is replaced with the full virtual-scroll table. The virtualizer ref scrolls to top on new row creation. `react-select` v5 is used for Product and MOP combo boxes in both the Add Row form and cell edit mode (CLAUDE.md Tech Choices).
- **D-17:** React Query key for sales list: `['sales']`. Invalidated after every successful POST, PATCH, or void mutation. React Query manages server state; Zustand manages edit-mode state (which cell is active, draft value, pending state).

### Claude's Discretion
- Exact Zustand store file name and structure (beyond the shape in D-05)
- Save indicator visual treatment (spinner icon, dimmed cell, disabled border style)
- Exact column widths for the sales table
- Whether a skeleton loader or simple "Loading..." text shows while sales fetch
- Exact Tailwind classes for strikethrough styling on voided rows
- Audit drawer animation (slide vs fade)
- Whether the confirmation for void is `window.confirm()` or a small inline confirmation UI

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture — non-negotiable locked decisions
- `CLAUDE.md` §Critical Architecture Rules — Rules 1–10. Especially: Rule 2 (audit log in same transaction), Rule 3 (soft-delete only), Rule 4 (price/name snapshots — never join products for display), Rule 6 (DECIMAL(10,2)), Rule 8 (soft-delete filter), Rule 9 (backend enforces RBAC), Rule 10 (pessimistic UI).
- `.planning/STATE.md` §Key Decisions Locked — All locked decisions; especially: virtual scroll with @tanstack/react-virtual, Zustand isolated from React Query, audit records capture Prisma return values (not raw input).

### Phase 3 requirements
- `.planning/ROADMAP.md` §Phase 3 — goal, 6 success criteria, full REQ-ID list (SALES-01 through SALES-18, AUDIT-01 through AUDIT-03, ROLES-03 through ROLES-06, PROD-05, PAY-05).
- `.planning/REQUIREMENTS.md` — Full requirement text for all Phase 3 REQ-IDs.

### Existing schema and types
- `packages/backend/prisma/schema.prisma` — Sale model (productNameSnapshot, priceSnapshot, mopNameSnapshot, status ENUM, createdById, lastEditedById) and AuditLog model (saleId, tableName, rowId, action, fieldName, oldValue, newValue). Read before writing any migration or query.
- `packages/shared/src/types/sale.ts` — Sale TypeScript interface; also notes the cross-plan dependency on productNameSnapshot/mopNameSnapshot (already present in schema).
- `packages/shared/src/types/audit.ts` — AuditEntry TypeScript interface.

### Existing backend infrastructure
- `packages/backend/src/app.ts` — Protected router at line 87. Phase 3 adds `salesRouter` to `protectedRouter`. Do NOT change middleware order.
- `packages/backend/src/middleware/requireAuth.ts` — Already applied to protectedRouter.
- `packages/backend/src/middleware/requireRole.ts` — Apply to void and audit endpoints.
- `packages/backend/src/lib/prisma.ts` — Prisma client singleton used by all routes.

### Existing frontend infrastructure
- `packages/frontend/src/pages/SalesPage.tsx` — Placeholder (5 lines). Phase 3 replaces content.
- `packages/frontend/src/router/index.tsx` — `/sales` route already wired to SalesPage.
- `packages/frontend/src/layouts/AuthenticatedLayout.tsx` — Main content area is `overflow-auto p-8`. Sales table will fill this area.
- `packages/frontend/src/stores/authStore.ts` — Zustand auth store pattern to mirror for edit-mode store.
- `packages/frontend/src/lib/axios.ts` — `api` singleton (base URL `/api`, credentials: true, 401 interceptor).
- `packages/frontend/src/lib/queryClient.ts` — React Query client singleton.

### Phase 2 patterns to follow
- `packages/frontend/src/pages/ProductsPage.tsx` — @tanstack/react-table v8 column definitions, useQuery + useMutation pattern, pessimistic per-row pending state.
- `packages/frontend/src/components/Modal.tsx` — Shared modal wrapper (reuse for audit drawer or void confirmation if modal-based).
- `packages/frontend/src/components/StatusBadge.tsx` — Status chip component (reuse for void/active status display).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/frontend/src/components/Modal.tsx` — Shared modal wrapper with overlay; reuse for audit drawer (or build a slide-in panel beside it)
- `packages/frontend/src/components/StatusBadge.tsx` — Active/Inactive chip; extend for active/void sale status
- `packages/frontend/src/stores/authStore.ts` — Zustand store pattern to copy for the sales edit-mode store
- `packages/frontend/src/lib/axios.ts` — `api` singleton; all sales API calls use this
- `packages/frontend/src/lib/queryClient.ts` — React Query client; `['sales']` query key follows existing `['products']` and `['mops']` pattern
- `packages/backend/src/middleware/requireRole.ts` — Already implemented; apply to void + audit routes
- `packages/backend/src/middleware/requireAuth.ts` — Already applied via protectedRouter

### Established Patterns
- @tanstack/react-table v8 column definitions → ProductsPage.tsx is the reference implementation
- useQuery / useMutation → exact same pattern as ProductsPage; invalidate `['sales']` on mutation success
- Pessimistic per-item pending state (pendingToggleId) → extend to per-cell saving state
- Error handler reads `err.statusCode` + `err.code` → throw `{ statusCode: 403, code: 'FORBIDDEN' }` for RBAC violations
- Prisma client from `packages/backend/generated/prisma/client.js` (not index.js)

### Integration Points
- `packages/backend/src/app.ts` line 87: `app.use('/api', requireAuth, protectedRouter)` — add `protectedRouter.use('/sales', salesRouter)` here
- `packages/frontend/src/pages/SalesPage.tsx` — replace placeholder content with SalesSheet component
- SalesPage route `/sales` already registered in router; no router changes needed
- `packages/shared/src/types/` — add any new shared types here (e.g., CreateSaleBody, PatchSaleBody API request types)

</code_context>

<specifics>
## Specific Ideas

- The virtual row containing the "Add Row" form should be rendered as a special first element in the data array (e.g., `isNewRow: true` sentinel object) so react-virtual measures it correctly alongside other rows.
- When `productId` is PATCHed: the backend must atomically update `productNameSnapshot` and `priceSnapshot` in the same query as the field update, and log old/new values for each snapshot field in separate audit entries (or one combined entry — planner decides).
- `userUsername` in AuditLog is denormalized at write time (same pattern as `createdByUsername` on Sale). Never join to users table for display in the audit drawer.
- `lastEditedById` and `lastEditedByUsername` on the Sale row should update on every PATCH — captured in the same transaction.
- The sales list `GET /api/sales` does NOT need to join products or MOPs — all display values come from snapshot columns.

</specifics>

<deferred>
## Deferred Ideas

- Keyboard tab-navigation across rows (v2 requirement — explicitly in REQUIREMENTS.md v2 section)
- Global audit log feed across all rows (v2 requirement)
- Audit logging for admin actions on products/MOPs/users (v2)
- Bulk CSV import of sales rows (v2)
- Filter/search within the sales sheet (Phase 4 scope — ADMIN view has filters; moderator sales sheet has none in v1)
- Server-sent events / live reload when another moderator adds a row (v2 — not needed for small team)

</deferred>

---

*Phase: 03-sales-core*
*Context gathered: 2026-06-18*
