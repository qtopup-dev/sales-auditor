# Research Summary — Sales Auditing Web App

**Synthesized:** 2026-06-16
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, PROJECT.md

---

## Recommended Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend framework | React 18 (Vite + TypeScript) | Fixed constraint; concurrent features help large table re-renders; Vite replaces CRA as the standard build tool |
| Table | @tanstack/react-table v8 | Headless — enables custom inline cell renderers without markup opinions; same ecosystem as virtual scroll |
| Virtual scroll | @tanstack/react-virtual v3 | Dynamic row height support; shared row model with TanStack Table avoids double-measuring |
| Combo box | react-select v5 | Controlled mode, async option loading, clean react-hook-form integration via Controller |
| Charts | Recharts v2 | Declarative React API over D3; covers all dashboard chart types without D3 expertise |
| Forms | react-hook-form v7 | Minimal re-renders; controlled inline cell editors integrate cleanly |
| HTTP client | axios v1 | Interceptors for 401 session expiry; simpler than raw fetch for error handling |
| Routing | react-router-dom v6 | Data router API reduces protected-route boilerplate |
| Styling | Tailwind CSS v3 | Utility-first; fastest iteration for internal tool layouts with no imposed component opinions |
| Date formatting | date-fns v3 | Tree-shakeable; no prototype pollution; covers all audit log timestamp needs |
| Backend framework | Express v4 | Fixed constraint; stable; Express 5 was still RC as of mid-2025 [VERIFY] |
| **Auth (resolved)** | **express-session + express-mysql-session + bcrypt** | **See conflict resolution below** |
| ORM | Prisma v5 | Type-safe generated client; prisma migrate for reproducible migrations; soft-delete middleware; first-class MySQL support |
| Database | MySQL | Fixed constraint |
| Input validation | express-validator v7 | Validate and sanitize all incoming API payloads before they reach the service layer |
| Security headers | helmet v8 | One middleware call; ships CSP, X-Frame-Options, HSTS from day one |
| CSV export | @json2csv/plainjs | Battle-tested serializer; streaming upgrade path available |
| Logging | morgan v1 | Access logs essential for debugging on VPS without an attached debugger |
| Server state (React) | @tanstack/react-query v5 | onMutate/onError pattern for optimistic updates and clean rollback |
| UI state (React) | Zustand | Lightweight; isolates edit-mode state from server data to prevent focus-loss bugs |
| Repo structure | Monorepo, npm workspaces | Single team; shared TypeScript types between front and back; simpler VPS deployment |
### Auth Conflict Resolution: express-session wins over JWT

The Architecture researcher recommended JWT in an httpOnly cookie. The Stack researcher recommended express-session + MySQL session store. **express-session is the correct choice for this project.**

The decisive reason is direct functional requirements from PROJECT.md:

1. **Admin can manually reset any user password** — with JWT, a reset does not log the user out; the old token remains valid until expiry. With server-side sessions, the admin deletes the session rows and revocation is instant.
2. **Admin can toggle moderator edit rights on/off** — the Architecture researcher acknowledged this lag: if an admin revokes edit rights, the change takes effect only when the token is re-issued. That lag is unacceptable for a permission toggle that exists specifically to give the admin immediate control.
3. **Sessions persist until explicit logout** — server-side sessions with rolling: true and a long maxAge (30 days) satisfy this cleanly. JWT with the same long expiry cannot be revoked.

JWT in a cookie is a valid pattern for stateless APIs, but this app explicit admin-control requirements make statefulness a feature, not a liability. The complexity argument for JWT (no DB lookup per request) does not apply — the session store lookup is a single indexed read on the same MySQL instance already in use.

**Implementation:** express-session + express-mysql-session (persists to MySQL; no Redis needed) + bcrypt (cost factor 12). Call req.session.regenerate() after login (session fixation prevention). Call req.session.destroy() on logout and delete all session records for a user when admin resets their password.

---

## Table Stakes Features

These must be present on day one or users will reject the tool and return to spreadsheets.

| Feature | Why it is non-negotiable |
|---------|-------------------------|
| Inline cell editing (click-to-edit) | Moderators treat this as a spreadsheet; a separate edit form feels like a regression from Excel |
| Add Row — one click, blank row at top in edit mode | Core data entry mechanism; any more friction breaks the workflow |
| Searchable combo box for Product and MOP | Free-text lists grow; scroll-only dropdowns cause wrong selections and data quality issues |
| Price auto-populates from product and is locked | Prevents transcription errors; satisfies the PROJECT.md price immutability constraint |
| Voided rows visible with strikethrough, never hidden by default | Hiding voids destroys trust in the audit trail — the core value of the product |
| Newest-first default sort | Every moderator mental model is what I just entered is at the top |
| Role-specific views — Admin and Moderator see different navigation entirely | Not just toggled buttons; two distinct nav trees to prevent confusion and accidental actions |
| Per-row field-level audit log | Without this, the tool is a form, not an audit tool |
| Admin: filter by date range, product, MOP, moderator | Admins cannot work with all sales ever; these four axes cover 95% of real admin queries |
| CSV export of filtered results (voided rows included with STATUS column) | Finance always wants a spreadsheet; silently omitting voided rows corrupts the audit trail in exports |
| User management: invite link, disable, reset password | Admin must onboard moderators without developer access to the database |
| Product and MOP catalog with active/inactive flag | Products get discontinued; inactive items must disappear from new-entry dropdowns without breaking historical rows |
| Session persistence until explicit logout | Data-entry tools that expire sessions mid-row lose user trust immediately |
| Admin dashboard: summary numbers and charts | Admin needs an at-a-glance view before drilling into rows |
| Created-by and last-edited-by visible in admin table view | Audit trail is useless if you cannot see who touched a row without opening a detail panel |

**Defer to v2:** Keyboard tab-navigation across rows, global audit log feed, void-with-required-reason, bulk CSV import, email notifications, rate limiting on login, quantity field per row.

**Explicitly exclude:** Hard delete, bulk row edit, in-app notifications, row comments/threads, complex status states beyond active/void, mobile-optimized data entry, custom permission sets.
---

## Critical Architecture Decisions

### 1. Server-Side Sessions Over JWT

Covered in the auth conflict resolution above. The functional requirements for immediate session revocation mandate server-side session storage. Store sessions in MySQL via express-mysql-session. Never use MemoryStore in production — it leaks memory and loses all sessions on restart.

### 2. Audit Log Inside the Same Database Transaction as the Mutation

Every UPDATE on sales and every INSERT must write audit records inside the same prisma.() call. This guarantees it is impossible to mutate data without a corresponding audit record, and impossible to have an orphaned audit record. Do not write audit records after the fact in a separate request or middleware hook.

The audit log schema uses EAV rows (one row per changed field, not a JSON blob of the full row). This enables readable per-field diffs and efficient indexed queries. Required columns: table_name, row_id, field_name, old_value, new_value, user_id, created_at. Composite indexes on (table_name, row_id) and (user_id, created_at) are required from day one.

### 3. Price Snapshot Denormalized at Row Creation

Copy product.price into sale.price_snapshot at the moment a sales row is created. Never derive the display price from a join to the products table. This means changing a product price never affects historical rows. Consider also snapshotting product.name to survive product renames without null-rendering in old rows.

### 4. organization_id on Every Business Table From Day One

Create an organizations table (one seeded row in v1). Add organization_id as a non-null foreign key on users, sales, products, mops, audit_log, and invite_tokens. Write all query helpers to accept organizationId as an explicit parameter even when there is only one value. The cost is near-zero now; retrofitting later requires a multi-hour migration on every table plus a systematic audit of every query to prevent cross-tenant data leaks.

### 5. Soft Delete via Status Flag With Strict Filter Enforcement

Use status ENUM(active, void) on sales rows and is_active BOOLEAN on users, products, and MOPs. Every list query on soft-deletable tables must filter by status. Use Prisma middleware or a  global where clause to append the filter automatically. Missing this filter on even one endpoint is a silent data leak (voided rows appear in revenue totals, deactivated products appear in dropdowns).

When displaying existing sales rows, do not apply the soft-delete filter to joined product/MOP lookups — only apply it when populating combo boxes for new entries. A voided product name must still resolve on historical rows.

### 6. Pessimistic UI Updates for v1

Disable the cell and show a save indicator during the server round-trip, then update on confirmation. The team is small, the VPS is co-located, and round-trip latency will be imperceptible. Optimistic updates with correct rollback logic require careful handling of rapid successive edits; the complexity is not justified for this team size. Revisit if save latency becomes a complaint post-launch.

---

## Top Pitfalls to Avoid

| # | Pitfall | Severity | Prevention |
|---|---------|----------|------------|
| 1 | Soft-delete filter leakage — voided rows appear in totals and dropdowns | CRITICAL | Prisma global where extension on all soft-deletable models; integration test per list endpoint that seeds a voided row and asserts it is absent |
| 2 | RBAC middleware mounted after route handler, or new routes added outside the protected router | CRITICAL | Mount requireAuth and requireRole at the router level, not per-route; security smoke test that calls every route without a session and asserts 401 |
| 3 | Row ownership check only in the frontend — moderator bypasses it via direct API call | CRITICAL | Backend PATCH /api/sales/:id must verify sale.created_by === req.session.userId OR role === admin AND user.can_edit === true; never trust the UI to enforce this |
| 4 | express-session MemoryStore in production — memory leak and sessions lost on restart | HIGH | Configure express-mysql-session from day one; MemoryStore is documented as not for production |
| 5 | Prisma Decimal to JS number conversion loses cent precision | HIGH | Return price fields as strings from the API; all server-side arithmetic uses Prisma.Decimal; never use Float in Prisma schema for monetary values |
| 6 | Prisma + MySQL timezone mismatch shifts timestamps | HIGH | Set MySQL to UTC (SET GLOBAL time_zone = +00:00), add ?timezone=UTC to Prisma connection URL, set TZ=UTC in Node process environment — all three, from day one |
| 7 | Audit log captures raw input value, not the value Prisma actually stored | HIGH | Write audit records using values from the Prisma return object, not the incoming payload; compare after coercion to avoid phantom changed records for numeric fields |
| 8 | Inline edit focus lost when virtual scroll unmounts the row being edited | HIGH | Keep edit state (editingRowId, draftValue) in Zustand separate from React Query server data; set overscan on the virtualizer; use stable row key props based on database ID never array index |
| 9 | Invite link consumed by email security scanner before user clicks it | HIGH | Make GET on invite URL stateless (validates only, renders form); consume token only on POST form submission; 48h expiry; crypto.randomBytes(32) stored as SHA-256 hash |
| 10 | CSV injection — Notes or Receiver field containing = triggers Excel formula | HIGH | Prefix any value starting with =, -, +, @, tab, or carriage return with a single quote; prepend UTF-8 BOM (EF BB BF) so Excel opens with correct encoding |

Additional high-severity items by phase:
- **Schema Day 1:** No organization_id on tables blocks multi-tenant migration
- **Schema Day 1:** Unique constraint on product names breaks when a soft-deleted product name is reused — enforce uniqueness among active records at the application layer
- **Each migration:** MySQL has no transactional DDL; always dump before prisma migrate deploy; never run prisma migrate dev in production
- **Sales Sheet UI:** Enforce fixed row heights via CSS truncation and tooltip for Notes to avoid virtual scroll position jumping from dynamic heights
---

## Build Order

### Phase 1 — Foundation: Schema and Environment

**Delivers:** Running database with correct schema. Every subsequent phase builds on this.

- Initialize monorepo (npm workspaces, /packages/backend, /packages/frontend, /packages/shared)
- Prisma schema: all tables with organization_id on every business entity, price_snapshot on sales, soft-delete fields, correct composite indexes, DECIMAL(10,2) for all monetary columns
- MySQL timezone configuration (UTC everywhere: my.cnf + Prisma connection URL + TZ env var)
- Seed: one organization row, one admin user
- Express app skeleton: helmet, cors, morgan, JSON body parser, global error handler, .env config

**Must-address pitfalls:** Decimal types, timezone, organization_id, and soft-delete field design — all schema decisions that are expensive to retrofit later.

### Phase 2 — Auth

**Delivers:** Working login/logout, invite-link registration, and session management. Every subsequent API route depends on this.

- POST /api/auth/login: bcrypt comparison, req.session.regenerate(), write userId + role to session
- POST /api/auth/logout: req.session.destroy()
- Invite token: two-step flow (GET validates and renders form only; POST consumes token and creates user)
- requireAuth and requireAdmin middleware mounted at router level, not per-route
- express-mysql-session configured from day one (never MemoryStore)
- Frontend: login page, invite registration page, AuthGuard, RoleGuard, axios 401 interceptor

**Must-address pitfalls:** RBAC middleware order, backend ownership check pattern established here, MemoryStore replacement, invite token scanner-proofing, session fixation (regenerate() before writing user to session).

### Phase 3 — Catalogs: Products and MOPs

**Delivers:** Admin can manage the catalogs that the sales sheet combo boxes depend on. Sales phase cannot begin without this.

- Products API: CRUD + status toggle; application-layer uniqueness check among active records only
- MOPs API: CRUD + status toggle
- Frontend: Admin Products and MOPs management pages
- Shared TypeScript types in /packages/shared

### Phase 4 — Sales Core: Create, Read, Edit, Void + Audit Log

**Delivers:** The end-to-end core of the product. Moderators can enter sales; every write is audited.

- POST /api/sales: create row; snapshot price from product at creation time; audit_log action=create inside same Prisma transaction
- GET /api/sales: scoped by role; soft-delete filter enforced via Prisma middleware; voided rows excluded by default
- PATCH /api/sales/:id: backend ownership + edit-rights check; field-level audit writes inside transaction; capture post-coercion values from Prisma return
- POST /api/sales/:id/void: same ownership check; audit entry for void action
- Frontend: Sales Sheet — virtual scroll with fixed row heights, pessimistic inline cell editing, Product and MOP combo boxes, Add Row, void with confirmation dialog

**Must-address pitfalls:** Edit state in Zustand isolated from React Query data (focus management), audit captures Prisma return values not raw input, stable row key props based on database ID.

### Phase 5 — Admin Sales View: Filters, Dashboard, CSV Export

**Delivers:** Admin-facing observability — filters, aggregated charts, and export.

- GET /api/sales admin path with filter params (date range, product, MOP, moderator); indexed columns handle performance
- GET /api/reports/summary: aggregated totals using Decimal.js arithmetic
- GET /api/reports/export: streamed CSV response; UTF-8 BOM prepended; formula injection sanitization applied; voided rows included with STATUS column
- Frontend: Admin Sales page with always-visible filter bar (default: last 30 days); Recharts dashboard (total count, revenue, by-product, by-MOP, trend over time); CSV download trigger

**Must-address pitfalls:** CSV injection sanitization, UTF-8 BOM, streaming not buffering for large exports.

### Phase 6 — Admin Management: Users and Audit Log Viewer

**Delivers:** User lifecycle management and drill-down audit access.

- Users API: list, invite, PATCH (username, can_edit toggle), POST /api/users/:id/reset-password (destroys all session records for that user in MySQL session store — the key validation of session-over-JWT)
- Audit log API: GET /api/audit (global, paginated), GET /api/audit/sales/:id (per-row)
- Frontend: Users management page (invite, toggle edit rights, reset password); per-row audit log drawer in admin sales table (field | from | to | who | when, newest first)

---

## Open Questions (Unresolved)

| Question | Affects | Notes |
|----------|---------|-------|
| Which MySQL session store package is actively maintained in 2026? | Phase 2 | express-mysql-session was canonical as of 2025 training data; verify npm publish date before choosing |
| Express 4 vs Express 5 stable? | Phase 1 | Express 5 was in RC as of late 2024; verify at expressjs.com before starting |
| Tailwind CSS v3 vs v4? | Phase 1 | Tailwind v4 was in alpha/beta as of early 2025; config changed significantly in v4; verify at tailwindcss.com/blog |
| Prisma v5 current patch version? | Phase 1 | Run npm info prisma version before pinning |
| react-select v5 still current or has v6 shipped? | Phase 4 | Run npm info react-select version to check |
| Fixed row height for Notes — is CSS truncation acceptable to users? | Phase 4 | If users need full Notes visible inline, dynamic row heights are required; this significantly increases virtual scroll complexity; confirm with stakeholder before building Phase 4 |
| Admin password reset UX — display new password or send reset-invite link? | Phase 6 | PROJECT.md specifies the requirement but not the UX; a reset-invite flow is safer than showing a generated password in plaintext |
| Audit log scope — sales rows only, or also user/product/MOP management changes? | Phase 4 | Schema supports any table_name; covering admin actions on catalogs and users would strengthen auditability but is not explicitly scoped in PROJECT.md |
| Primary key type — INT auto-increment vs UUID? | Phase 1 | PITFALLS.md recommends UUID for multi-tenant readiness; ARCHITECTURE.md uses INT; recommendation: use INT for v1 simplicity, migrate to UUID as part of multi-tenant v2 effort |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Stack choices | HIGH | All libraries well-established and actively maintained as of August 2025 training cutoff; specific patch versions need npm verification before pinning |
| Feature scope | HIGH | Domain patterns for internal CRUD auditing tools are stable; informed by Airtable, Notion, Google Sheets, Retool, and enterprise audit system patterns |
| Architecture | HIGH | REST + Express + Prisma + React Query is a well-documented stack with established patterns; no experimental technology |
| Auth decision | HIGH | express-session vs JWT is definitively resolved by functional requirements; not a judgment call |
| Pitfalls | HIGH | All pitfalls are grounded in documented behaviors of the specific libraries chosen; not speculative |
| Package versions | MEDIUM | Training cutoff August 2025; verify all versions via npm before starting; Express 5 and Tailwind v4 stable status are the two most likely to have changed since cutoff |
| v2 migration readiness | MEDIUM | Schema is designed for multi-tenant evolution but the actual migration path is not detailed; organization_id on all tables is the key hedge |

**Overall: HIGH confidence.** The stack is conventional, the domain is well-understood, and the four research files are internally consistent except for one conflict that is now resolved. The primary implementation risk is the inline editing and virtual scroll combination, which has well-documented pitfalls that are addressable with the patterns in PITFALLS.md.

---

## Resolved Conflicts

| Conflict | Resolution |
|----------|-----------|
| Auth mechanism: ARCHITECTURE.md recommended JWT in httpOnly cookie; STACK.md recommended express-session + MySQL store | **express-session wins.** Admin password reset and edit-rights revocation require immediate session invalidation. JWT statelessness is incompatible with these hard functional requirements. The Stack researcher reasoning is directly tied to the project actual requirements; the Architecture researcher recommendation was made without fully accounting for the revocation use cases. |
| UI update strategy: ARCHITECTURE.md recommended optimistic updates; PITFALLS.md recommended pessimistic | **Pessimistic for v1.** Small team, low VPS latency, eliminates rollback edge cases during initial build. The added complexity of correct optimistic rollback logic across rapid successive edits is not justified for this team size. Revisit if save latency becomes a complaint after launch. |

---

*Synthesized from: STACK.md (2026-06-16), FEATURES.md (2026-06-16), ARCHITECTURE.md (2026-06-16), PITFALLS.md (2026-06-16), PROJECT.md*
