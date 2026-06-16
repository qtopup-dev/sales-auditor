# Pitfalls Research — Sales Auditing Web App

**Domain:** Internal sales auditing tool (React + Node.js/Express + MySQL + Prisma)
**Researched:** 2026-06-16
**Confidence:** HIGH — all pitfalls are well-documented patterns in the React/Node/MySQL/Prisma ecosystem; no external lookups required given training depth on these stacks.

---

## 1. Inline Editing UX — Focus Management

**Risk:** When a user clicks a cell to edit, React re-renders may steal or lose focus. The most common trigger is state updates (e.g., auto-save triggering a list re-fetch) that unmount and remount the editing cell mid-keystroke, resetting the cursor to position 0 or blurring the input entirely. With virtual scroll, the problem compounds: the row being edited may scroll out of the virtual window and be unmounted while the user is still typing.

**Warning signs:**
- Cursor jumps to the beginning of the text after each character typed
- The input loses focus when another row updates (e.g., WebSocket push or polling refresh)
- Editing a cell near the bottom of the virtual scroll area causes the row to disappear mid-edit

**Prevention:**
- Keep editing state (`editingRowId`, `editingField`, `draftValue`) in a dedicated store (Zustand slice or React context) completely separate from the server data store. Never derive edit state from the rows array.
- Gate data refreshes: while a cell is in edit mode, suppress background re-fetches or apply them only to non-editing rows. After commit, flush the refresh.
- Use `useEffect(() => { inputRef.current?.focus() }, [isEditing])` with a stable ref — do not rely on autofocus attributes which fire only on mount.
- Assign stable `key` props to row components derived from the row's database ID, never from array index. Index-based keys cause React to treat a scrolled-in row as a new component and fire remount, destroying focus.
- For the virtual scroll container, configure the overscan count (e.g., `overscan={5}` in TanStack Virtual) to keep rows adjacent to the viewport mounted, reducing the chance the editing row gets unmounted.

**Phase:** Sales Sheet UI (inline editing phase)

---

## 2. Inline Editing UX — Accidental Edits

**Risk:** A single click activates edit mode on a cell. On mobile or a touchscreen, a scroll gesture that starts on a cell triggers the click handler and opens an editor. Users also tab through a row and accidentally trigger edit mode on cells they did not intend to edit. There is no visible boundary between "this row is being edited" and "this row is display-only."

**Warning signs:**
- QA reports unexpected edit mode activations on scroll
- Moderators complain they accidentally changed values
- The audit log shows edits with old_value === new_value (phantom saves)

**Prevention:**
- Use double-click (or a single click + 200ms delay) to enter edit mode rather than immediate single-click. For touch, use `onTouchEnd` with movement detection to distinguish tap from scroll.
- Highlight the entire row with a distinct background color when any cell in that row is in edit mode.
- Only save on explicit commit (Enter key or blur away from the row), never on every keystroke. Show a discard button (Escape key) alongside the commit affordance.
- Filter the audit log before writing: compare `old_value !== new_value` before creating an audit entry. Do not write audit records for no-op saves.

**Phase:** Sales Sheet UI (inline editing phase)

---

## 3. Inline Editing UX — Optimistic UI Rollback

**Risk:** If you apply changes to local state before the server confirms them (optimistic update), and the server returns an error, the rollback can leave the UI in an inconsistent state. With a spreadsheet table where multiple cells can be saved in rapid succession, a failed save on row N can roll back a value that was already overwritten by a subsequent edit on the same cell.

**Warning signs:**
- After a network error, a cell shows the wrong value (neither the pre-edit value nor the intended new value)
- Console shows React state update warnings during error recovery
- QA cannot reproduce the corruption because it requires rapid typing + slow network

**Prevention:**
- For this app (small team, VPS, internal tool), prefer pessimistic updates: disable the cell and show a spinner on save, then update the display only after server confirmation. This eliminates rollback complexity entirely.
- If optimistic updates are chosen, version each row with a local `editVersion` counter. Only apply a rollback if the rollback's version matches the current version; discard stale rollbacks.
- Store the pre-edit snapshot (`originalValue`) in the edit state slice at the moment edit mode is entered, not at save time.

**Phase:** Sales Sheet UI (inline editing phase)

---

## 4. Audit Log — Schema Design That Makes Queries Painful

**Risk:** Two common schema mistakes in field-level audit logs:

**Mistake A — Storing the entire row as JSON diff.** Querying "show me all changes to the Price field across all rows" requires a JSON extract in every row of the audit table. MySQL's `JSON_EXTRACT` with `->` syntax works, but it cannot use a standard B-tree index on the extracted value, making aggregate queries over large audit tables extremely slow.

**Mistake B — No index on `(table_name, record_id, field_name)`.** The two most common access patterns are: "all changes to record #42" and "all changes to the Price field in date range X-Y." Without a composite index covering both patterns, these queries do full table scans as the audit table grows.

**Warning signs:**
- Admin audit log page takes >2 seconds to load for a moderator with 500 rows
- Adding a date range filter makes queries slower, not faster (index not being used)
- `EXPLAIN` on audit queries shows `type: ALL` (full table scan)

**Prevention:**
- Use the EAV (Entity-Attribute-Value) row schema, not JSON: `(id, sale_id, field_name VARCHAR(64), old_value TEXT, new_value TEXT, changed_by, changed_at)`. One row per changed field per save action.
- Add a composite index: `INDEX idx_audit_record (sale_id, changed_at DESC)` for per-record queries, and `INDEX idx_audit_field (field_name, changed_at DESC)` for global field queries.
- For grouping edits in the same save into one "change set," add a `change_set_id UUID` column. Generate the UUID on the backend before the batch insert.
- Add `changed_at` as a standalone indexed column even though it is part of composite indexes — MySQL can use it for range scans in queries that do not filter by `sale_id` or `field_name`.

**Phase:** Backend / database schema phase

---

## 5. Audit Log — Missing or Incorrect Value Capture

**Risk:** The audit log captures the value the frontend sent, not the value actually stored in the database. If Prisma coerces a value (e.g., a Decimal rounds, a DateTime gets UTC-shifted), the audit log shows the raw string the user typed while the DB stores a different number. Comparing them later is misleading.

**Warning signs:**
- Audit log shows `old_value: "199.9"` but the database has `199.90` — superficially different but numerically identical, causing spurious "changed" records on re-save
- Timezone-related: log shows time at UTC while the UI displays local time, causing confusion about "when did this change"

**Prevention:**
- Write audit records after the Prisma write resolves, using the values from the Prisma return object (which reflects what is actually stored), not the input payload.
- Normalize the comparison before writing: use `String(parseFloat(incoming)) === String(parseFloat(stored))` for numeric fields, and ISO 8601 strings for dates.
- Store all timestamps in the audit log in UTC; let the frontend convert to local time for display.

**Phase:** Backend / database schema phase

---

## 6. Soft Delete — Unique Constraint Violations

**Risk:** If you have a unique constraint on a business-meaningful column (e.g., a unique product name), soft-deleting a product and then creating a new one with the same name violates the constraint because the deleted row is still present in the table.

For this app specifically: the `products` table likely needs a unique constraint on `name`. When a product is deactivated (soft-deleted), re-creating it with the same name or renaming another product to that name will fail.

**Warning signs:**
- Admin tries to create "Widget A" after "Widget A" was deactivated — gets a database unique constraint error
- Error messages bubble to the UI as an unhandled 500 instead of a friendly message

**Prevention:**
- Make unique constraints conditional on the soft-delete state. In MySQL, this requires a partial/filtered index, which MySQL does not support directly on non-generated columns. The workaround: add a `deleted_at DATETIME NULL` column and create a unique index on `(name, deleted_at)` — but this still fails if two deleted rows share a name and `deleted_at` differs.
- Better pattern: use a generated column `is_active TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED` and unique-index on `(name, is_active)`. NULL values are not considered equal in MySQL unique indexes, so multiple deleted rows (is_active = NULL) coexist without conflict, while active rows (is_active = 1) enforce uniqueness.
- For product/MOP names: enforce uniqueness only among active records at the application layer (Prisma query check before insert) with a clear API error message, rather than relying solely on DB constraints.

**Phase:** Database schema phase (before any CRUD is built)

---

## 7. Soft Delete — Query Filter Leakage

**Risk:** Every query that touches a soft-deletable table must include `WHERE deleted_at IS NULL` (or `WHERE is_deleted = 0`). Miss it once and voided sales rows appear in totals, voided products appear in the product combo box, or a voided moderator account can still log in.

This is the most operationally damaging soft-delete mistake: the bug is silent (no error, just wrong data) and often only discovered via a user complaint about wrong totals.

**Warning signs:**
- Revenue dashboard total does not match manual count
- A voided product appears in the "add row" product dropdown
- A suspended moderator can still authenticate

**Prevention:**
- Use Prisma's `softDelete` middleware or a global `where` extension to append `deleted_at: null` to every query on soft-deletable models automatically. This is available via Prisma Client extensions (`$extends`).
- Add a test for every list/lookup endpoint: seed a voided row, call the endpoint, assert the voided row is absent from the response. These tests catch filter-leakage regressions immediately.
- Establish a naming convention: all Prisma queries that intentionally include soft-deleted rows use a clearly named helper `findIncludingVoided(...)` so unintentional omissions stand out in code review.

**Phase:** Database schema + every CRUD endpoint (enforce from day one; retrofitting is risky)

---

## 8. Soft Delete — Foreign Key Integrity With Voided References

**Risk:** A sales row references a product via `product_id`. If the product is soft-deleted (voided), the FK reference is still valid at the DB level — the row exists. But application logic that checks `WHERE deleted_at IS NULL` on the products table will fail to resolve the product name for display in the voided sales row, resulting in "Product not found" or null rendering for historical rows.

**Warning signs:**
- Voided sales rows show blank product name in the admin view
- CSV export has empty cells in the Product column for old rows
- Audit log shows the product name but the current query does not return it

**Prevention:**
- Never join products/MOPs with `WHERE products.deleted_at IS NULL` when rendering sales rows. The soft-delete filter on lookup tables should only apply when populating combo boxes for new entries, not when displaying existing rows.
- Use separate query paths: `getActiveProducts()` for the add-row combo box; `getProductById(id)` (no soft-delete filter) for rendering existing row data.
- Store a snapshot of the product name and price in the sales row at creation time (denormalized columns: `product_name_snapshot`, `price_snapshot`). This is especially important here because the spec already locks price at row creation. These snapshots survive product rename or deactivation without any join.

**Phase:** Database schema phase + Sales Sheet rendering phase

---

## 9. Prisma + MySQL — Decimal Precision Loss

**Risk:** Prisma maps MySQL `DECIMAL` columns to JavaScript's `Decimal` type from the `@prisma/client` Decimal.js dependency. If you access the value as a plain JS number (e.g., `Number(row.price)` or `row.price * 1`), you lose the precision guarantee. Currency amounts like `199.99` can become `199.98999999999999` in floating-point arithmetic.

**Warning signs:**
- Revenue totals are off by fractions of a cent
- CSV export shows prices like `"9.999999999999998"`
- Frontend receives price as a number in JSON and JavaScript silently loses the last digit

**Prevention:**
- Define price columns in the Prisma schema as `@db.Decimal(10, 2)`. Prisma returns these as `Prisma.Decimal` objects.
- Serialize Decimal fields to strings in the API response (`price: row.price.toString()`). The frontend stores and displays the string; it does not perform arithmetic on it.
- All server-side arithmetic (totals for dashboard charts) must use Decimal.js or integer-cent arithmetic, never native JS `number`. Install `decimal.js` or use `Prisma.Decimal` arithmetic methods.
- In Prisma schema, never use `Float` for monetary values. `Float` maps to MySQL `DOUBLE` which is inherently imprecise.

**Phase:** Database schema phase (fix before any price logic is written)

---

## 10. Prisma + MySQL — Timezone Handling

**Risk:** MySQL `DATETIME` columns store no timezone information. Prisma sends dates to MySQL in the connection's timezone. If the VPS system timezone, MySQL server timezone, and Node.js process timezone differ, timestamps stored by Prisma will be silently shifted. A row created at 11:00 PM local time may be stored as 03:00 AM UTC the next calendar day, corrupting date-range filters.

**Warning signs:**
- Filtering sales by "today" misses rows created late in the evening
- `created_at` in the audit log is several hours off from what the moderator sees in the UI
- The admin sees different row counts when filtering by date on the server vs. counting in the UI

**Prevention:**
- Set MySQL server timezone to UTC: `SET GLOBAL time_zone = '+00:00'` and persist in `my.cnf`.
- Set the Prisma datasource connection timezone to UTC by appending `?timezone=UTC` to the connection URL (e.g., `mysql://user:pass@host/db?timezone=UTC`).
- Store all timestamps in UTC throughout (DB, API responses, audit log). Convert to the user's local timezone only in the frontend display layer.
- Add `TZ=UTC` to the Node.js process environment (in the systemd service file or `.env`) so `new Date()` in Node also produces UTC.

**Phase:** Database schema + backend setup phase (Day 1 environment configuration)

---

## 11. Prisma + MySQL — Production Migration Risks

**Risk:** `prisma migrate deploy` applies pending migrations in a transaction, but MySQL does not support transactional DDL. If a migration adds a column and then fails mid-way, the column is already added but the migration is marked as failed. The next `migrate deploy` tries to re-apply the same migration and fails with "column already exists." The database is now in a state that does not match any migration snapshot.

**Warning signs:**
- Deployment fails with "Table already exists" or "Duplicate column" after a partially failed migration
- The `_prisma_migrations` table has a row with `applied_steps_count < steps` and non-null `rolled_back_at`
- The Prisma shadow database diverges from the production schema

**Prevention:**
- Always take a full MySQL dump before running `prisma migrate deploy` in production.
- For destructive migrations (column drops, type changes), split them across two deployments: deploy 1 makes the app backward-compatible with both old and new schema; deploy 2 applies the destructive change after the app no longer reads the old column.
- Test migrations on a staging database that is a recent clone of production before applying to production.
- Never run `prisma migrate dev` in production — it prompts for input and can create shadow databases. Production command is `prisma migrate deploy` only.
- When a migration is stuck, manually mark it as rolled back in `_prisma_migrations` and resolve the schema drift before re-running.

**Phase:** DevOps / deployment setup phase; each feature phase that introduces schema changes

---

## 12. Role-Based Auth — Middleware Ordering and Missing Route Protection

**Risk:** Express middleware is positionally ordered. If the auth middleware (`requireAuth`) or the role check middleware (`requireAdmin`) is mounted after the route handler, it never executes. Equally dangerous: the middleware is mounted correctly on a router, but a developer adds a new route outside that router without realizing it is unprotected.

**Warning signs:**
- Accessing `/api/admin/users` without a session returns the user list (not a 401)
- A new route added in a hurry works in testing because the developer is already logged in, and protection is never verified
- No integration test exists that calls protected routes without authentication

**Prevention:**
- Mount auth middleware at the top of every API router, not per-route. Pattern:

  ```
  const adminRouter = express.Router()
  adminRouter.use(requireAuth)           // All routes below require auth
  adminRouter.use(requireRole('admin'))  // All routes below require admin role
  adminRouter.get('/users', listUsers)
  ```

- Never add routes to the base `app` object after initialization — all routes go through named routers that have middleware pre-mounted.
- Write a "security smoke test" that lists every route and asserts each returns 401 when called without a session. Run this test in CI.

**Phase:** Auth phase (before any protected routes are built); re-run security tests at each phase

---

## 13. Role-Based Auth — Row-Level Ownership Bypass

**Risk:** The spec says moderators can only edit rows they created. If the ownership check is only in the frontend (the Edit button is hidden for rows not owned by the user), a moderator can POST directly to `/api/sales/:id` with a row ID they do not own. Without a backend ownership check, the edit succeeds.

**Warning signs:**
- A moderator can edit another moderator's row by calling the API directly (curl/Postman)
- Audit log shows `changed_by` is different from the `created_by` on a moderator-owned row without admin involvement

**Prevention:**
- Every `PATCH /api/sales/:id` handler must verify `sale.created_by === req.session.userId OR req.session.role === 'admin'` before applying the update. This check must be in the backend handler, not just the frontend.
- Additionally check `user.can_edit === true` for moderators (the admin-toggled edit rights flag) in the same guard.
- The check order: authenticated -> has session -> role -> owns row -> has edit rights enabled. Each step returns 403 if it fails, with no information leakage about whether the row exists.

**Phase:** Auth phase + Sales edit endpoint

---

## 14. Invite Link Auth — Security Vulnerabilities

**Risk:** Three distinct attack vectors:

**A — No expiry.** An invite link emailed or shared months ago remains valid indefinitely. If the link is forwarded, leaked, or found in a sent-items folder, anyone with it can create an account.

**B — Link pre-scanning by email clients and security proxies.** Corporate email security scanners (Proofpoint, Mimecast, Office 365 ATP) follow every link in inbound email to check for malware. If the invite link is a one-time-use GET endpoint (e.g., `/invite/accept?token=abc`), the scanner's HTTP GET consumes the token before the user clicks. The user clicks the link and gets "invalid token."

**C — Token entropy too low.** A 6-character alphanumeric token has 36^6 (~2.1 billion combinations) — weak against a targeted brute force over time if no rate limiting exists on the invite endpoint.

**Warning signs:**
- Admins report moderators getting "invalid invite link" errors immediately after being sent the link
- Old invite links still work after 30+ days
- The invite token is sequential or predictably short

**Prevention:**
- Set invite link expiry: 48-72 hours maximum. Store `expires_at` in the `invite_tokens` table and reject expired tokens.
- Make invite links two-step: the GET request on the invite URL only validates the token and renders a "Set Your Password" form. Token consumption (marking as used) happens only on the POST submission of the form, not on the GET. This defeats link scanners because GET is idempotent — scanners follow links but do not submit forms.
- Generate tokens with `crypto.randomBytes(32).toString('hex')` — 256 bits of entropy. Store only the SHA-256 hash in the database; compare by hashing the incoming token.
- Add a unique constraint on `token_hash` in the `invite_tokens` table and a composite index on `(used_at, expires_at)` for cleanup queries.

**Phase:** Auth phase

---

## 15. Session Management — Store Choice and Cookie Security

**Risk:** `express-session` defaults to an in-memory session store (`MemoryStore`). This leaks memory indefinitely (sessions are never cleaned up), crashes on VPS restart (all sessions lost, all users logged out), and does not scale beyond a single process. For a VPS deployment, this is a critical oversight that is easy to miss in development where restarts are frequent and the memory leak goes unnoticed.

**Warning signs:**
- VPS RAM usage climbs steadily over days
- All users are logged out after any deployment or server restart
- Session-related errors increase after the app has been running for 24+ hours

**Prevention:**
- Use `express-mysql-session` to store sessions in the existing MySQL database. No additional infrastructure (Redis) needed for a small internal team. The package handles session expiry cleanup automatically.
- Set `cookie.secure = true` in production (requires HTTPS, which the VPS should terminate via nginx + Let's Encrypt).
- Set `cookie.httpOnly = true` (prevents JavaScript access to the session cookie).
- Set `cookie.sameSite = 'lax'` to prevent CSRF on cross-origin requests.
- Set `resave: false` and `saveUninitialized: false` in the session config to avoid writing unnecessary session records.
- Set a session TTL matching "sessions persist until explicit logout": use `rolling: true` with a long `maxAge` (e.g., 30 days) so active users stay logged in, and implement explicit `/api/auth/logout` that calls `req.session.destroy()`.

**Phase:** Auth phase (before any protected routes)

---

## 16. Session Management — Session Fixation

**Risk:** Session fixation occurs when the server keeps the same session ID after a user authenticates. An attacker who can set a victim's session ID (e.g., via a URL parameter) authenticates as the victim after the victim logs in with that pre-set ID.

**Warning signs:**
- The session ID in the cookie is the same before and after login
- `req.session.regenerate()` is not called in the login handler

**Prevention:**
- Call `req.session.regenerate(callback)` immediately after validating credentials and before writing user data to the session. This issues a new session ID while preserving the session data.
- Never accept session IDs from URL query parameters — enforce cookie-only sessions (`express-session` does this by default; do not override).

**Phase:** Auth phase

---

## 17. CSV Export — Formula Injection (CSV Injection)

**Risk:** If any free-text field (Notes, Receiver name) contains a value starting with `=`, `-`, `+`, or `@`, spreadsheet applications (Excel, Google Sheets) interpret it as a formula when the CSV is opened. A value like `=HYPERLINK("http://evil.com","Click here")` in the Notes field becomes a live formula in the exported spreadsheet. This is a documented attack vector (OWASP CSV Injection) that is trivial to trigger and often overlooked in internal tools.

**Warning signs:**
- Opening the exported CSV in Excel shows a formula bar entry instead of plain text for certain Notes values
- A moderator enters `=1+1` in Notes and the CSV shows `2` after opening

**Prevention:**
- Sanitize all field values before writing to CSV: prefix any value that starts with `=`, `-`, `+`, `@`, `\t`, or `\r` with a single quote (`'`). Excel treats a leading single quote as a text-force marker and does not evaluate the formula.
- Use a well-maintained CSV serialization library (e.g., `csv-stringify` in Node.js) rather than manual string concatenation with commas. Manual construction is also prone to failing on embedded commas and newlines.
- Add a content-type header: `Content-Disposition: attachment; filename="sales-export.csv"` and `Content-Type: text/csv; charset=utf-8`. Include a UTF-8 BOM (the three-byte sequence EF BB BF, written in code as `Buffer.from([0xEF, 0xBB, 0xBF])`) at the start of the file so Excel opens it with correct encoding without a manual import step.

**Phase:** Admin dashboard / export phase

---

## 18. CSV Export — Encoding and Special Characters

**Risk:** Sales data (product names, receiver names, notes) may contain non-ASCII characters (accented letters, currency symbols, non-Latin names). Without explicit UTF-8 BOM handling, Excel on Windows interprets the CSV as Windows-1252 (Latin-1) and corrupts characters. Embedded newlines in Notes fields break CSV row boundaries if not properly quoted.

**Warning signs:**
- Exported names with accents appear as garbled characters when opened in Excel
- A multi-line note in the Notes field causes the row to split across multiple lines in the exported CSV

**Prevention:**
- Prepend a UTF-8 BOM using `Buffer.from([0xEF, 0xBB, 0xBF])` to the export stream. This is the three-byte sequence (EF BB BF) that signals UTF-8 encoding to Excel on Windows.
- Use `csv-stringify` with `quoted: true` or `quoted_string: true` to wrap all string values in double-quotes. This correctly handles embedded commas, newlines, and double-quotes (which are escaped as `""`).
- Test the export with a row containing: a product name with an accent, a Notes field with a newline and a comma, and a Receiver name with a double-quote character.

**Phase:** Admin dashboard / export phase

---

## 19. CSV Export — Large Dataset Memory Exhaustion

**Risk:** Fetching all sales rows into memory for a CSV export (`prisma.sale.findMany()` with no limit) then building the entire CSV string before sending it creates a memory spike proportional to the number of rows. On a VPS with limited RAM, a 100,000-row export can OOM-crash the Node process.

**Warning signs:**
- Export works fine with 1,000 rows but the server becomes unresponsive during a large export
- Node process memory spikes to several GB during export requests
- VPS metrics show memory pressure correlating exactly with export requests

**Prevention:**
- Stream the export: use Prisma's cursor-based pagination (`.findMany({ cursor: { id: lastId }, take: 1000, skip: 1 })`) in a loop, piping each batch into the response stream via `csv-stringify`'s streaming API.
- Set `res.setHeader('Transfer-Encoding', 'chunked')` and pipe the CSV stringifier directly into `res` to start sending data immediately without buffering the full response.
- Add a soft row limit (e.g., 50,000 rows per export) with a UI warning and a suggestion to narrow the date range if the count is exceeded. For a small internal team this threshold is unlikely to be hit in v1, but the streaming pattern should be built from the start.

**Phase:** Admin dashboard / export phase

---

## 20. Virtual Scroll — Dynamic Row Heights

**Risk:** Virtualization libraries (TanStack Virtual, react-window) require knowing the row height in advance to calculate scroll position and total list height. If rows have variable heights — e.g., Notes content wraps to multiple lines — the library's assumed uniform height is wrong. The result is incorrect scroll positions, jumpy scroll behavior when rows near the viewport are measured post-render, and the total scrollable height being wrong (scroll thumb jumps when you reach rows taller than expected).

**Warning signs:**
- Scroll position "snaps" unexpectedly when scrolling past a row with long Notes text
- The scrollbar thumb size does not reflect the true number of rows
- Items near the bottom of the list are partially hidden or overlap

**Prevention:**
- For this app, enforce fixed row heights in the table: truncate Notes with CSS `text-overflow: ellipsis` in the table cell and show the full value in a tooltip or side panel. Fixed-height rows eliminate the dynamic height problem entirely.
- If variable heights are required later, use TanStack Virtual's `estimateSize` with `measureElement` callback (the `dynamic` mode), which measures each row after render and recalculates positions. This is more complex but accurate.
- Set an explicit `min-height` and `max-height` on table rows in CSS and clip overflow rather than letting rows grow.

**Phase:** Sales Sheet UI (virtual scroll implementation)

---

## 21. Virtual Scroll — Accessibility and Focus

**Risk:** Screen readers expect DOM elements to exist for navigation. Virtualized lists only render the visible subset of rows, so rows outside the viewport do not exist in the DOM. A keyboard user pressing Tab or arrow keys to navigate the table will appear to "hit a wall" at the edge of the rendered window. Screen readers announce incorrect item counts.

**Warning signs:**
- A keyboard user cannot tab through all rows
- Screen reader announces "10 items" when the table has 500 rows
- Focus disappears when tabbing into a row that gets virtualized out of the DOM

**Prevention:**
- For the core sales sheet UX, the primary interaction is: click a cell to edit, press Enter to save, press Escape to cancel. This does not require keyboard traversal across all rows. Ensure the "Add Row" button and the search/filter controls are keyboard-accessible even if full row traversal is not.
- Add `role="grid"` and `aria-rowcount={totalRows}` to the table container so screen readers report the true row count. Use `aria-rowindex` on each rendered row.
- Trap focus within the active row when a cell is in edit mode; do not allow Tab to navigate to a virtual row that may not be in the DOM.
- Document the accessibility limitation explicitly in a comment for future reference: "Row keyboard traversal not fully accessible due to virtualization; see WCAG 2.1 SC 4.1.2 for requirements if this becomes a compliance concern."

**Phase:** Sales Sheet UI (virtual scroll implementation)

---

## 22. Virtual Scroll — Scroll Position Lost After Data Updates

**Risk:** When the sales table refreshes (e.g., after a new row is added via "Add Row"), React re-renders the list. If the scroll container is re-mounted or the virtual window is reset, the user's scroll position jumps back to the top. This is particularly disruptive if the user has scrolled down to find a specific row and then saves a cell — the save triggers a re-fetch, and the list snaps back.

**Warning signs:**
- After saving a cell edit, the scroll position resets to the top
- Adding a new row (which prepends to the list) causes the entire view to scroll

**Prevention:**
- Do not unmount and remount the virtual scroll container after data updates. Merge new data into the existing list state using a stable sort key (row ID) rather than replacing the array.
- When a new row is added ("Add Row" button), append it to the local state immediately and scroll the virtual container to the new row's index using the virtualizer's `scrollToIndex(newRowIndex)` method.
- Use `stableSort` — sort by `created_at DESC` on the server and cache the result; only prepend new rows to the cached list client-side without full re-sort.
- Preserve scroll offset: capture `scrollElement.scrollTop` before any state update that triggers re-render, then restore it in `useLayoutEffect` after the render.

**Phase:** Sales Sheet UI (virtual scroll implementation)

---

## 23. Multi-Tenant Prep — Schema Decisions That Block Migration

**Risk:** Three decisions made in single-tenant mode that make multi-tenant migration painful:

**A — No `organization_id` on core tables from day one.** Adding a nullable `organization_id` column to `sales`, `products`, `mode_of_payment`, and `users` later requires a backfill migration on every row. If the tables are large, this migration is slow and locks the table. Worse, all existing queries must be updated to include `WHERE organization_id = ?`, and missing even one is a cross-tenant data leak.

**B — Shared sequences/auto-increment IDs.** If `sale.id` is a MySQL auto-increment integer, IDs are globally unique but also predictable and leaking (a tenant can guess neighboring IDs). When multi-tenancy is added, row IDs from different tenants may collide in imports or exports.

**C — Hardcoded single-admin assumptions.** Logic like "the admin" (singular) in role checks, or a single `settings` table with one row, breaks when multiple organizations each need their own admin.

**Warning signs:**
- The `users` table has no `organization_id` column
- Role checks use `role === 'admin'` without scoping to an organization
- The `products` table has no foreign key to an `organizations` table

**Prevention:**
- Create an `organizations` table now (single row for v1) and add `organization_id` as a non-null foreign key on `users`, `sales`, `products`, and `mode_of_payment`. Seed the single organization on first run.
- Use UUIDs (`cuid()` or `uuid()` in Prisma) for primary keys on all core tables. UUIDs eliminate ID collision risk in future multi-tenant scenarios and do not leak row counts to clients.
- Write all query helpers to accept `organizationId` as an explicit parameter even in v1, even though there is only one value. The function signature forces callers to be explicit, making the eventual multi-tenant migration a find-and-replace of the hardcoded value rather than a re-architecture.
- Make role checks organization-scoped: `user.organization_id === targetOrg.id AND user.role === 'admin'` from day one.

**Phase:** Database schema phase (must be done before any data is written to production)

---

## Summary Table

| # | Pitfall | Severity | Phase to Address |
|---|---------|----------|-----------------|
| 1 | Inline edit focus loss on re-render / virtual scroll unmount | HIGH | Sales Sheet UI |
| 2 | Accidental cell activation / phantom saves in audit log | MEDIUM | Sales Sheet UI |
| 3 | Optimistic UI rollback inconsistency | MEDIUM | Sales Sheet UI |
| 4 | Audit log schema — JSON diff vs. EAV rows, missing indexes | HIGH | DB Schema |
| 5 | Audit log captures input value, not stored value (Decimal/timezone drift) | HIGH | Backend / DB Schema |
| 6 | Soft delete breaks unique constraints on product names | HIGH | DB Schema |
| 7 | Soft delete filter leakage — voided rows appear in totals/dropdowns | CRITICAL | DB Schema + every CRUD endpoint |
| 8 | Foreign key refs to soft-deleted products resolve as null | MEDIUM | DB Schema + Sales rendering |
| 9 | Prisma Decimal to JS number precision loss in prices | HIGH | DB Schema |
| 10 | Prisma + MySQL timezone mismatch corrupts timestamps | HIGH | DB Schema + environment setup |
| 11 | Prisma migrations fail mid-way; MySQL has no transactional DDL | HIGH | DevOps / each schema change |
| 12 | Express RBAC middleware mounted after route or bypassed by new routes | CRITICAL | Auth phase |
| 13 | Row-level ownership check only in frontend, bypassable via API | CRITICAL | Auth phase + Sales edit endpoint |
| 14 | Invite link: no expiry, scanner consumes one-time GET, low entropy | HIGH | Auth phase |
| 15 | express-session MemoryStore in production — memory leak + lost sessions | HIGH | Auth phase |
| 16 | Session fixation — session ID not regenerated after login | MEDIUM | Auth phase |
| 17 | CSV injection — formula in Notes/Receiver triggers Excel formula execution | HIGH | Admin export phase |
| 18 | CSV encoding — non-ASCII corruption in Excel without UTF-8 BOM | MEDIUM | Admin export phase |
| 19 | CSV large export OOMs Node process — no streaming | MEDIUM | Admin export phase |
| 20 | Virtual scroll dynamic row heights cause jumpy scroll | MEDIUM | Sales Sheet UI |
| 21 | Virtual scroll accessibility — keyboard/screen reader incomplete | LOW | Sales Sheet UI |
| 22 | Virtual scroll scroll position resets after data update | MEDIUM | Sales Sheet UI |
| 23 | No organization_id on tables — blocks multi-tenant migration | HIGH | DB Schema (Day 1) |

---

## Phase-Specific Warning Map

| Phase | Must-Address Pitfalls |
|-------|-----------------------|
| **DB Schema (Day 1)** | #4, #5, #6, #7, #8, #9, #10, #23 — all schema decisions that are painful to retrofit |
| **Auth** | #12, #13, #14, #15, #16 — entire auth surface must be locked before any other feature |
| **Sales Sheet UI** | #1, #2, #3, #20, #21, #22 — inline editing and virtualization UX |
| **Backend CRUD endpoints** | #7 (soft-delete filter) — re-verify on every new list endpoint |
| **DevOps / deployment** | #10 (timezone env), #11 (migration strategy) |
| **Admin export** | #17, #18, #19 — CSV safety and correctness |

---

*Confidence: HIGH. All pitfalls are grounded in well-documented behaviors of React, Express, MySQL, Prisma, and CSV handling as of training cutoff (August 2025). No external sources were reachable during this research session; findings rely on training data depth for this well-established stack. Recommend spot-checking Prisma changelog for any Decimal or timezone handling changes released after August 2025.*
