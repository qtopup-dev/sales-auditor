# Roadmap — Sales Auditing Web App

**Granularity:** Coarse (4 phases)
**Coverage:** 57/57 v1 requirements mapped
**Last updated:** 2026-07-18

---

## Phases

- [x] **Phase 1: Foundation** — Monorepo, schema, environment, seed data — the bedrock every other phase builds on
- [x] **Phase 2: Auth + Catalogs** — Login, sessions, invite flow, roles enforcement, product catalog, MOP catalog
- [x] **Phase 3: Sales Core** — The main product: inline-edit sales sheet, add row, void, full audit log (transactional)
- [x] **Phase 4: Admin Dashboard + Management** — All-sales view, filters, charts, CSV export, user management
- [x] **Phase 5: Receiver Catalog** — Receivers table (id, name, optional account number) and combobox replacing free-text receiver cell in sales sheet
- [x] **Phase 6: Dashboard KPI Cards** — Transactions / Profit / Turnover KPI summary cards at the top of the admin dashboard, each showing Today / Yesterday / This Month / Last Month
- [x] **Phase 7: Moderator Shift Clock In/Out** — Clock in/out shifts, per-shift sales view reset, shift history page, admin Shifts oversight page with force-clock-out

---

## Phase Details

### Phase 1: Foundation
**Goal**: A running monorepo with correct schema, seeded database, and Express skeleton — every subsequent phase builds on this without touching infrastructure again.
**Depends on**: Nothing (first phase)
**Requirements**: *(no direct REQ-IDs — this phase is prerequisite infrastructure that enables all requirements)*
**Success Criteria** (what must be TRUE):
  1. Running `npm run dev` from the repo root starts both the backend API and the frontend dev server without errors
  2. The database contains all tables with organization_id on every business entity, price_snapshot on sales, soft-delete fields, DECIMAL(10,2) for monetary columns, and correct composite indexes — verified via `prisma migrate status` showing clean
  3. A seeded admin user and one organization row exist; the admin can be confirmed present via a direct DB query
  4. The Express skeleton responds to `GET /health` with 200, and helmet security headers are present in the response
  5. All timestamps in the system are stored and returned in UTC — MySQL, Prisma connection, and Node process are all configured to UTC
**Plans:** 5 plans
Plans:
- [x] 01-01-PLAN.md — Root monorepo scaffold: package.json workspaces, Docker Compose MySQL, .env.example, ESLint+Prettier, tsconfigs for all three packages
- [x] 01-02-PLAN.md — Shared TypeScript types: domain entity interfaces for User, Sale, Product, Mop, AuditEntry, Organization
- [x] 01-03-PLAN.md — Prisma 7 schema, migration, and seed: all 7 models with correct types/indexes, init migration, admin user seed
- [x] 01-04-PLAN.md — Express 5 backend skeleton: app.ts, index.ts, health route, error handler, session store
- [x] 01-05-PLAN.md — React 18 frontend shell: Vite + placeholder "App coming soon" page

### Phase 2: Auth + Catalogs
**Goal**: Users can securely log in, invite new moderators, manage sessions, and the admin can maintain the product and MOP catalogs that the sales sheet depends on.
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, ROLES-01, ROLES-02, ROLES-07, ROLES-08, ROLES-09, PROD-01, PROD-02, PROD-03, PROD-04, PROD-06, PROD-07, PAY-01, PAY-02, PAY-03, PAY-04, PAY-06
**Success Criteria** (what must be TRUE):
  1. An admin can log in with username and password, navigate the admin dashboard, and remain logged in after closing and reopening the browser — then explicitly log out and be redirected to the login page with the session fully invalidated
  2. An admin can generate an invite link, share it with a new user, and that user can visit the link (GET renders a form only; POST consumes the token), set their own password, and log in — the invite link cannot be reused after registration and expires after 48 hours
  3. When an admin resets any user's password, that user's active session is immediately invalidated — the user cannot make any authenticated API call with their old session cookie (this validates the express-session-over-JWT decision for AUTH-07 and USERS-06)
  4. A moderator who logs in sees only the sales sheet view; an admin who logs in sees the admin navigation — direct URL access to admin-only routes by a moderator returns a 403 from the backend, not just a frontend redirect
  5. Admin can create, edit, toggle active/inactive status, and view all products and MOPs; inactive products and MOPs do not appear in the combo box options for new entries but existing rows that reference them still display their names correctly
**Plans:** 6 plans
Plans:
- [x] 02-01-PLAN.md — Backend foundation: extract sessionPool to lib/db.ts, requireAuth + requireRole middleware, shared InviteToken/AuthSession types
- [x] 02-02-PLAN.md — Backend auth routes: login, logout, invite generate, invite register, password reset + users route (canEdit toggle, reset-password); wire into app.ts
- [x] 02-03-PLAN.md — Backend catalog routes: products CRUD + toggle, MOPs CRUD + toggle; wire into protectedRouter
- [x] 02-04-PLAN.md — Frontend infrastructure: install deps, Tailwind v3, axios + queryClient + authStore singletons, router with ProtectedRoute guards, AuthenticatedLayout, placeholder pages
- [x] 02-05-PLAN.md — Frontend auth pages: LoginPage + InviteRegisterPage with form handling, returnTo navigation, error states
- [x] 02-06-PLAN.md — Frontend catalog pages: Modal + StatusBadge primitives, ProductsPage + MopsPage with @tanstack/react-table v8, ProductModal + MopModal

### Phase 3: Sales Core
**Goal**: Moderators can enter, edit, and void sales rows in a spreadsheet-like interface, and every write is captured in an immutable audit log written in the same database transaction.
**Depends on**: Phase 2
**Requirements**: SALES-01, SALES-02, SALES-03, SALES-04, SALES-05, SALES-06, SALES-07, SALES-08, SALES-09, SALES-10, SALES-11, SALES-12, SALES-13, SALES-14, SALES-15, SALES-16, SALES-17, SALES-18, AUDIT-01, AUDIT-02, AUDIT-03, ROLES-03, ROLES-04, ROLES-05, ROLES-06, PROD-05, PAY-05
**Success Criteria** (what must be TRUE):
  1. A moderator can click "Add Row", select a product from the searchable combo box, see the price auto-populate and lock, select a MOP, enter a receiver name, and save — the row appears at the top of the sheet newest-first and is immediately visible without a page reload
  2. A moderator can click any editable cell on a row they created (when edit rights are on), edit it inline, and the cell saves on blur — the cell is disabled with a save indicator during the round-trip, and the Date Edited column updates to the current timestamp on every save
  3. An audit log entry is created inside the same database transaction as every create, edit, and void — if the mutation fails, no orphaned audit record exists; if the audit write fails, the mutation is rolled back (AUDIT-02 hard constraint)
  4. Voided rows remain visible in the sheet with strikethrough styling and are never removed from view; a moderator cannot void rows (only admin can), and a moderator cannot edit rows belonging to another moderator or their own rows if their edit rights are disabled — these checks are enforced by the backend, not just the UI
  5. The sales sheet handles large row counts via virtual scroll without pagination; SALES-03 (dynamic row heights from Notes content) is implemented — note: if CSS truncation with tooltip is used instead of true dynamic heights, this must be confirmed acceptable before phase closes; the layout is usable on mobile (SALES-18)
  6. Inactive products are hidden from the Product combo box (PROD-05) and inactive MOPs are hidden from the MOP combo box (PAY-05) when adding new rows; row-level edit rights and void permission are enforced server-side (ROLES-03/04/05/06)
**Plans:** 8 plans
Plans:
- [x] 03-01-PLAN.md — [BLOCKING] Schema migration: add createdByUsername/lastEditedByUsername to Sale, userUsername to AuditLog; extend SessionData with username + organizationId; update login handler
- [x] 03-02-PLAN.md — Backend sales routes: GET /api/sales, POST /api/sales, PATCH /:id, POST /:id/void, GET /:id/audit — all mutations with transactional audit log; mount salesRouter on protectedRouter
- [x] 03-03-PLAN.md — Frontend primitives: salesEditStore (Zustand D-05 shape) + VoidConfirmDialog (wraps Modal.tsx)
- [x] 03-04-PLAN.md — Frontend SalesTable (react-table v8 + react-virtual v3 + dynamic row heights) + AddRowForm (react-hook-form + AsyncSelect)
- [x] 03-05-PLAN.md — Frontend AuditDrawer (slide-in panel, useQuery audit entries, admin-only)
- [x] 03-06-PLAN.md — Frontend EditableCell (inline edit state machine, blur-save, pessimistic UI) + SalesPage full wiring
- [x] 03-07-PLAN.md — Fix: Add Row form not rendering on first mount (react-virtual outerSize=0 on fresh SalesTable) + fix AsyncSelect value={null} visual reset after product/MOP pick
- [x] 03-08-PLAN.md — Fix: AddRowForm outside virtualizer — static non-virtualized `<tr>` eliminates size-cache remap cascade with 200+ rows (gap closure)
**UI hint**: yes

### Phase 4: Admin Dashboard + Management
**Goal**: Admin has full observability over all sales data through filters, charts, and CSV export, and can manage the full user lifecycle including invite, edit, and password reset with immediate session revocation.
**Depends on**: Phase 3
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07, ADMIN-08, ADMIN-09, ADMIN-10, ADMIN-11, ADMIN-12, USERS-01, USERS-02, USERS-03, USERS-04, USERS-05, USERS-06
**Success Criteria** (what must be TRUE):
  1. Admin can view all sales rows from all moderators in a single table showing Product, Price, MOP, Receiver, Notes, Created By, Created At, Last Edited By, Date Edited, and Status (active/void) — voided rows are visible with their status clearly indicated
  2. Admin can filter the sales table by any combination of date range, product, MOP, and moderator (creator), then export the current filtered view to a CSV file that includes voided rows with a STATUS column and is safe from formula injection (cells starting with =, -, +, @ are sanitized; UTF-8 BOM prepended for correct Excel encoding)
  3. The admin dashboard displays summary statistics (total sales count, total revenue) and charts (sales over time trend, breakdown by product, breakdown by MOP) — revenue arithmetic uses server-side Decimal math, never JS float
  4. Admin can open a per-row audit log drawer showing every field change (field, old value, new value, who changed it, when) in newest-first order (ADMIN-12 + AUDIT-03)
  5. Admin can view all users, invite new moderators, edit usernames, toggle moderator edit rights, and reset any user's password — resetting a password immediately invalidates all active sessions for that user, confirmed by the user being unable to make authenticated API calls on their old session (AUTH-07 and USERS-06 correctness test for the express-session architecture)
**Plans:** 6 plans
Plans:
- [x] 04-01-PLAN.md — Backend: GET /api/admin/summary route (Prisma aggregations + $queryRaw trendData), PATCH /api/users/:id/username endpoint (before PATCH /:id), adminRouter mounted in app.ts
- [x] 04-02-PLAN.md — Frontend: install recharts@3.9.0 + @json2csv/plainjs@7.0.6, StatCard component, SalesFilterBar component (FilterState + applyFilters)
- [x] 04-03-PLAN.md — Frontend: SalesCharts (three Recharts charts with h-64 parent), AdminSalesTable (read-only react-table v8 + downloadCSV with BOM + injection sanitization)
- [x] 04-04-PLAN.md — Frontend: UserModal (username edit + 409 inline error), InviteModal (invite URL + copy), ResetPasswordModal (temp password + copy)
- [x] 04-05-PLAN.md — Frontend: DashboardPage full implementation — stats banner + charts + filter bar + admin sales table + CSV export + AuditDrawer + VoidConfirmDialog
- [x] 04-06-PLAN.md — Frontend: UsersPage full implementation — users table + invite + edit username + canEdit toggle + reset password
**UI hint**: yes

### Phase 5: Receiver Catalog
**Goal**: Replace the free-text receiver cell in the sales sheet with a searchable combobox backed by a persistent receivers catalog (id, name, optional account number), so receiver data is consistent and reusable across rows.
**Depends on**: Phase 4
**Requirements**: *(new feature beyond v1 requirements — tracked as PHASE5-SC1 through PHASE5-SC5)*
**Success Criteria** (what must be TRUE):
  1. A `Receiver` table exists in the database with id, name, and optional account_number columns (with organization_id)
  2. Admin can manage receivers (create, edit, toggle active/inactive) via a catalog page or modal
  3. The receiver cell in both the Add Row form and inline edit uses a searchable AsyncSelect combobox loading from the receivers catalog
  4. Inactive receivers are hidden from the combobox options for new entries; existing rows still display the receiver name correctly
  5. Sales rows store receiver by id (foreign key), not free text; historical display uses the stored name snapshot — consistent with how products/MOPs are handled
**Plans:** 5 plans
Plans:
- [x] 05-01-PLAN.md — [BLOCKING] Prisma schema: add Receiver model + modify Sale (receiverId FK + receiverNameSnapshot); create-only migration, inject data transform SQL, apply migration
- [x] 05-02-PLAN.md — Shared types (new Receiver interface, Sale updated) + receiversRouter (admin CRUD + toggle) + catalog /receivers endpoint + app.ts wiring
- [x] 05-03-PLAN.md — sales.ts update: serializeSale, ALLOWED_PATCH_FIELDS, validators, POST handler (receiverId lookup in tx), PATCH handler receiverId branch (atomic FK + snapshot + 2 audit entries)
- [x] 05-04-PLAN.md — Frontend: ReceiversPage + ReceiverModal (create/edit) + /receivers route (admin-only) + "Receivers" nav link in admin sidebar
- [x] 05-05-PLAN.md — Frontend: AddRowForm (AsyncSelect receiver combobox) + EditableCell (receiverId in SELECT_FIELDS) + SalesTable (receiverNameSnapshot) + AdminSalesTable (receiverNameSnapshot column + CSV)

### Phase 6: Add dashboard KPI summary cards to admin dashboard top
**Goal**: Admin can see period-specific KPI cards (Transactions, Profit, Turnover) at the very top of the admin dashboard, each showing Today / Yesterday / This Month / Last Month values — giving instant snapshot of recent activity without scrolling past charts.
**Depends on**: Phase 5
**Requirements**: *(new feature — tracked as PHASE6-SC1 through PHASE6-SC5)*
**Success Criteria** (what must be TRUE):
  1. 3 KPI cards appear at the top of the admin DashboardPage (Transactions, Profit, Turnover) in a single row above the existing stats banner
  2. Each card shows 4 time-period values: Today / Yesterday / This Month / Last Month in a 2×2 grid
  3. KPI data is computed server-side with UTC date math; monetary values returned as strings (never float)
  4. KpiCard component visual style matches StatCard (bg-white, border border-gray-200, rounded-md, p-6)
  5. The existing stats banner (Total Sales / Total Revenue) and all other DashboardPage sections remain unchanged
**Plans:** 2 plans
Plans:
- [x] 06-01-PLAN.md — Backend: extend GET /api/admin/summary with 8 date-filtered $queryRaw queries (count + sum per period) and kpiData response field
- [x] 06-02-PLAN.md — Frontend: new KpiCard.tsx component + DashboardPage.tsx updated with KPI section and extended AdminSummary interface

### Phase 7: Moderator Shift Clock In/Out
**Goal**: Moderators can clock in/out of shifts; while clocked in, their Sales Sheet resets to show only the current shift's rows with a live count + revenue totals banner, and Add Row is gated on having an active shift. Moderators get a Shift History page of their own past shifts. Admins get a "Shifts" oversight page: a date-scoped, tabbed view (one tab per moderator, Excel-sheet-tab style) showing every moderator's sales for a selected day, with a force-clock-out action on any still-open shift when viewing today.
**Depends on**: Phase 6
**Requirements**: *(new feature beyond v1 requirements — no REQ-IDs; scope locked via CONTEXT.md decisions D-01 through D-17)*
**Success Criteria** (what must be TRUE):
  1. A moderator can clock in (single click, no confirmation) and clock out (confirm dialog); at most one open shift can ever exist per moderator, enforced server-side including under concurrent double-click (DB-level race guard)
  2. While clocked in, a moderator's Sales Sheet shows ONLY the current shift's rows (a true reset, not a client-side filter) with a live Sales/Revenue totals banner above the table; Add Row is disabled with a tooltip when not clocked in; an admin's Sales Sheet is completely unaffected (admins never have shifts)
  3. A moderator can view their own Shift History page: past shifts newest-first with clock-in/out times, duration, and per-shift active-sales count/revenue
  4. An admin can view the Shifts oversight page: pick a date, see one Excel-style tab per moderator who had a shift that day (multiple sessions same day merged into one tab), and view that moderator's totals + read-only sales rows for the day
  5. An admin can force-clock-out a moderator's still-open shift (visible only when viewing today), which closes the shift without affecting any sales data; voided rows are excluded from all shift totals everywhere but remain visible with existing strikethrough treatment
**Plans:** 9 plans (8 executed + 1 gap-closure)
Plans:
- [x] 07-01-PLAN.md — [BLOCKING] Prisma schema: Shift model + Sale.shiftId nullable FK, manual migration (db execute + migrate resolve), DB-level openLock race guard
- [x] 07-02-PLAN.md — Shared types (Shift, ShiftWithTotals, Sale.shiftId) + shiftsRouter (clock-in, clock-out, current, history) + app.ts wiring
- [x] 07-03-PLAN.md — sales.ts: shiftId lookup at creation (role-gated D-03/D-05) + ownership-checked shiftId query scoping on GET
- [x] 07-04-PLAN.md — admin.ts: GET /shifts?date= (per-moderator merge) + POST /shifts/:id/force-clock-out
- [x] 07-05-PLAN.md — Frontend: shiftStore, ClockControl, ClockOutConfirmDialog, ForceClockOutConfirmDialog, ShiftTotalsBanner
- [x] 07-06-PLAN.md — Frontend: ShiftHistoryTable + ShiftHistoryPage + /shift-history route
- [x] 07-07-PLAN.md — Frontend: AuthenticatedLayout (ClockControl + nav) + SalesPage (role-branched shift-gating)
- [x] 07-08-PLAN.md — Frontend: AdminShiftTabs + AdminShiftsPage + /shifts route
- [x] 07-09-PLAN.md — [GAP CLOSURE] shifts.ts: mount router-level requireRole('moderator') (CLAUDE.md Rule 9 backend RBAC enforcement) + correct app.ts mount comment
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 5/5 | Complete | 2026-06-17 |
| 2. Auth + Catalogs | 6/6 | Complete | 2026-06-18 |
| 3. Sales Core | 8/8 | Complete | 2026-06-25 |
| 4. Admin Dashboard + Management | 6/6 | Complete | 2026-06-26 |
| 5. Receiver Catalog | 5/5 | Complete | 2026-06-26 |
| 6. Dashboard KPI Cards | 2/2 | Complete | 2026-07-01 |
| 7. Moderator Shift Clock In/Out | 9/9 | Complete | 2026-07-18 |

---

## Backlog

### Phase 999.1: fix: Add Row Catalog Lag
**Goal:** Fix product/MOP dropdown 403 errors for moderators and simultaneous-refetch lag for admins by adding catalog endpoints accessible to all authenticated users and pre-fetching catalog data into React Query cache on SalesPage mount.
**Requirements:** PROD-05, PAY-05
**Plans:** 2 plans
Plans:
- [ ] 999-01-01-PLAN.md — Backend: new catalogRouter (GET /catalog/products + GET /catalog/mops, no requireRole) mounted on protectedRouter
- [ ] 999-01-02-PLAN.md — Frontend: SalesPage pre-fetch + AddRowForm + EditableCell updated to read from React Query cache

### Phase 8: Self-service password change for moderators via username dropdown menu

**Goal:** Any logged-in user (admin or moderator) can change their own password from a username dropdown in the sidebar. On success, all of their OTHER active sessions are invalidated while their current session stays logged in.
**Requirements**: PHASE8-SC1..SC5 (phase-local — new feature beyond v1 REQ-IDs)
**Depends on:** Phase 7
**Plans:** 2 plans

Plans:
- [x] 08-01-PLAN.md — Backend: POST /api/auth/change-password (bcrypt cost 12, server-side 8-char re-validation, invalidate other sessions but preserve current)
- [x] 08-02-PLAN.md — Frontend: username dropdown menu + Change Password modal (new/confirm fields, success + inline error states)

---

## Traceability

| REQ-ID | Phase |
|--------|-------|
| AUTH-01 | Phase 2 |
| AUTH-02 | Phase 2 |
| AUTH-03 | Phase 2 |
| AUTH-04 | Phase 2 |
| AUTH-05 | Phase 2 |
| AUTH-06 | Phase 2 |
| AUTH-07 | Phase 2 |
| ROLES-01 | Phase 2 |
| ROLES-02 | Phase 2 |
| ROLES-03 | Phase 3 |
| ROLES-04 | Phase 3 |
| ROLES-05 | Phase 3 |
| ROLES-06 | Phase 3 |
| ROLES-07 | Phase 2 |
| ROLES-08 | Phase 2 |
| ROLES-09 | Phase 2 |
| PROD-01 | Phase 2 |
| PROD-02 | Phase 2 |
| PROD-03 | Phase 2 |
| PROD-04 | Phase 2 |
| PROD-05 | Phase 3 |
| PROD-06 | Phase 2 |
| PROD-07 | Phase 2 |
| PAY-01 | Phase 2 |
| PAY-02 | Phase 2 |
| PAY-03 | Phase 2 |
| PAY-04 | Phase 2 |
| PAY-05 | Phase 3 |
| PAY-06 | Phase 2 |
| SALES-01 | Phase 3 |
| SALES-02 | Phase 3 |
| SALES-03 | Phase 3 |
| SALES-04 | Phase 3 |
| SALES-05 | Phase 3 |
| SALES-06 | Phase 3 |
| SALES-07 | Phase 3 |
| SALES-08 | Phase 3 |
| SALES-09 | Phase 3 |
| SALES-10 | Phase 3 |
| SALES-11 | Phase 3 |
| SALES-12 | Phase 3 |
| SALES-13 | Phase 3 |
| SALES-14 | Phase 3 |
| SALES-15 | Phase 3 |
| SALES-16 | Phase 3 |
| SALES-17 | Phase 3 |
| SALES-18 | Phase 3 |
| AUDIT-01 | Phase 3 |
| AUDIT-02 | Phase 3 |
| AUDIT-03 | Phase 3 |
| ADMIN-01 | Phase 4 |
| ADMIN-02 | Phase 4 |
| ADMIN-03 | Phase 4 |
| ADMIN-04 | Phase 4 |
| ADMIN-05 | Phase 4 |
| ADMIN-06 | Phase 4 |
| ADMIN-07 | Phase 4 |
| ADMIN-08 | Phase 4 |
| ADMIN-09 | Phase 4 |
| ADMIN-10 | Phase 4 |
| ADMIN-11 | Phase 4 |
| ADMIN-12 | Phase 4 |
| USERS-01 | Phase 4 |
| USERS-02 | Phase 4 |
| USERS-03 | Phase 4 |
| USERS-04 | Phase 4 |
| USERS-05 | Phase 4 |
| USERS-06 | Phase 4 |
</content>
