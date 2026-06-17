# Roadmap — Sales Auditing Web App

**Granularity:** Coarse (4 phases)
**Coverage:** 57/57 v1 requirements mapped
**Last updated:** 2026-06-17

---

## Phases

- [x] **Phase 1: Foundation** — Monorepo, schema, environment, seed data — the bedrock every other phase builds on
- [x] **Phase 2: Auth + Catalogs** — Login, sessions, invite flow, roles enforcement, product catalog, MOP catalog
- [ ] **Phase 3: Sales Core** — The main product: inline-edit sales sheet, add row, void, full audit log (transactional)
- [ ] **Phase 4: Admin Dashboard + Management** — All-sales view, filters, charts, CSV export, user management

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
**Plans**: TBD
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
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 5/5 | Complete | 2026-06-17 |
| 2. Auth + Catalogs | 6/6 | Complete | 2026-06-18 |
| 3. Sales Core | 0/0 | Not started | - |
| 4. Admin Dashboard + Management | 0/0 | Not started | - |

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
