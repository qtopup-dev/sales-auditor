# Features Research — Sales Auditing Web App

**Domain:** Internal sales auditing / lightweight CRM tracker
**Researched:** 2026-06-16
**Confidence:** HIGH — domain is well-established; patterns are stable across tools like Airtable, Notion databases, Google Sheets + internal CRUD apps, and enterprise audit systems.

---

## Table Stakes (Must Have)

These are the features users expect to exist on day one. Their absence produces immediate complaints or abandonment. For an internal tool used daily, "users leave" translates to "users work around it in a spreadsheet instead."

### 1. Inline Cell Editing
**Why expected:** Moderators use this tool like a spreadsheet. Any workflow that requires opening a separate form to edit a single field will be rejected immediately — it feels like downgrade from Excel/Sheets.
**Complexity:** Medium. Requires state management per row, optimistic updates, and clear save/cancel semantics.
**Dependencies:** Depends on row ownership model (mod can only edit own rows). Inline edit must be visually suppressed for rows the current user cannot edit.
**Notes:** The most critical UX decision in the entire app. Get this wrong and the tool will feel broken even if everything else is correct.

### 2. Add Row (append-first workflow)
**Why expected:** Core data entry mechanism. Must be one click. Blank row should appear at top (newest-first sort) and immediately be in edit mode.
**Complexity:** Low-Medium.
**Dependencies:** Inline editing. Auto-assign creator. Auto-timestamp on creation.

### 3. Searchable Combo Box for Catalog Fields
**Why expected:** Product and MOP lists will grow. Free-text typing that filters the dropdown is standard in any modern web form. Forcing users to scroll a long dropdown is a friction point that causes data quality issues (wrong product selected).
**Complexity:** Medium. Requires controlled input with filtered list, keyboard navigation, and "no match" handling.
**Dependencies:** Active/inactive product and MOP catalog must exist before this can populate.

### 4. Auto-populate Price from Product
**Why expected:** The price is a function of the selected product. Making moderators type it separately introduces transcription errors. This is a basic data integrity guardrail.
**Complexity:** Low. On product selection, write price from catalog into the Price cell and lock it.
**Dependencies:** Product catalog with price per product. Price field must be read-only after population.

### 5. Voided Rows Visible with Strikethrough
**Why expected:** Audit tools must not make data disappear. Moderators who void a row will need to see what they voided. Admins need the full picture. Hidden voids destroy trust in the audit trail.
**Complexity:** Low. CSS strikethrough + conditional row styling.
**Dependencies:** Soft-delete / void status field. Void action must be accessible but require confirmation.

### 6. Newest-First Default Sort
**Why expected:** Every moderator's mental model is "the thing I just entered is at the top." Any other default causes immediate confusion.
**Complexity:** Low. Default ORDER BY created_at DESC.
**Dependencies:** Created-at timestamp on every row.

### 7. Role-Specific Views (Admin vs Moderator)
**Why expected:** Moderators should not see admin controls. Admins need cross-user visibility. Mixing the two produces confusion and accidental actions.
**Complexity:** Medium. Two distinct layouts / nav trees, not just toggled buttons.
**Dependencies:** Role stored on user record. Route guards on frontend. Permission checks on every API endpoint (not just UI).

### 8. Admin: Filter by Date Range, Product, MOP, Moderator
**Why expected:** An admin looking at "all sales ever" needs to narrow scope. These four axes cover 95% of real-world admin queries (e.g., "show me all sales by Ana for Product X last month").
**Complexity:** Medium. Filter state management + parameterized query.
**Dependencies:** All filter dimensions must be indexed on the sales table for acceptable query performance at scale.

### 9. CSV Export of Filtered Results
**Why expected:** Finance and management always want a spreadsheet. If the tool cannot export, someone will screenshot the screen instead. CSV is the lowest common denominator — accepted by Excel, Google Sheets, and every accounting tool.
**Complexity:** Low-Medium. Stream filtered query result as CSV from backend.
**Dependencies:** Filters must apply before export, not export all then filter client-side. Voided rows should be included in export with a "void" status column so the receiving spreadsheet preserves the audit trail.

### 10. Per-Row Audit Log (Field-Level)
**Why expected:** The core value proposition of the product is "every change is traceable." If a moderator edits the receiver name, the admin must be able to see what it was before and after, who changed it, and when. Without this, it is not an audit tool — it is just a form.
**Complexity:** High. Requires before/after capture on every write, a separate audit_log table, and a UI to surface it per row.
**Dependencies:** Must be implemented at the service layer, not the UI layer. Every backend write endpoint must emit an audit event.

### 11. User Management (Admin: Create, Disable, Reset Password)
**Why expected:** The admin must be able to onboard a new moderator without a developer touching the database. Similarly, a moderator who forgets their password should not block operations.
**Complexity:** Medium. Invite link generation, password hashing, admin-initiated reset.
**Dependencies:** Auth system. Invite links must expire (recommend 24-48h) to prevent stale links being used.

### 12. Product and MOP Catalog Management (Active/Inactive)
**Why expected:** Products get discontinued. Payment methods change. The admin must be able to remove an option from new entries without breaking existing records that reference it.
**Complexity:** Low-Medium. Active/inactive flag, filter active-only in combo boxes, preserve references in historical rows.
**Dependencies:** Soft-disable pattern (same as row soft-delete). Foreign key references must not cascade on deactivation.

### 13. Session Persistence Until Explicit Logout
**Why expected:** Internal tool users expect to stay logged in. Being kicked out mid-entry due to a short session timeout is a severe UX failure in a data-entry tool. One accidental loss of half-entered rows creates distrust.
**Complexity:** Low-Medium. Long-lived session token or refresh token pattern.
**Dependencies:** Secure httpOnly cookie for token storage. Backend session validation on every request.

### 14. Dashboard Summary Charts (Admin)
**Why expected:** Admins need a high-level view before drilling into rows. Total sales count, total revenue, breakdowns by product and MOP are the minimum. Without this, the admin has no "at a glance" view.
**Complexity:** Medium. Aggregation queries + chart library (Recharts or Chart.js for React).
**Dependencies:** Filters on the admin sales view should ideally drive chart data as well (filtered dashboard, not just filtered table).

### 15. Created-By and Last-Edited-By Displayed on Each Row (Admin View)
**Why expected:** The audit trail is useless if the admin cannot see who touched a row. These metadata columns must be visible in the table without needing to open a detail panel.
**Complexity:** Low. JOIN to users table on created_by and last_edited_by fields.
**Dependencies:** Row ownership fields written at create and update time by the backend (not supplied by the client).

---

## Differentiators (Nice to Have for v1)

These features are not expected out of the box but would make the tool noticeably better than a shared Google Sheet. Most are reasonable for v1 if the core is solid.

### 1. Per-Moderator Edit Rights Toggle (Admin)
**Value:** Gives admin fine-grained control — can freeze a moderator's editing without deactivating their account. Useful when a moderator goes on leave or during a review period.
**Complexity:** Low. Boolean flag per user. Backend checks this flag before allowing a write from that user.
**Notes:** Already in scope per PROJECT.md. Mentioned here because it is above the "basic RBAC" floor that most internal tools provide.

### 2. Global Audit Log View (Admin)
**Value:** Instead of viewing the audit trail per row, admin can see a chronological feed of all changes across all rows. Useful for spotting bursts of edits, unusual activity, or reconstructing a timeline.
**Complexity:** Medium. Paginated table from audit_log with user/row/field/old/new/timestamp columns.
**Dependencies:** Per-row audit log must exist first.

### 3. Void with Required Reason
**Value:** When a moderator (or admin) voids a row, require them to enter a reason. Stored in the audit log. Prevents drive-by voids that leave auditors wondering why something was removed.
**Complexity:** Low. Modal prompt before setting void status. Reason stored as a notes field on the void audit event.
**Notes:** Adds friction intentionally. For an auditing tool, that friction is the point.

### 4. Row-Level Audit Log Accessible Inline (Expandable Row or Panel)
**Value:** Admin can click a row and see its full edit history without leaving the table. Reduces context switching vs. navigating to a separate audit log page.
**Complexity:** Medium. Expandable row or slide-over panel that fetches audit events for that row_id.
**Dependencies:** Per-row audit log.

### 5. Keyboard Navigation in the Spreadsheet (Tab / Enter to Advance)
**Value:** Power users entering many rows back-to-back will use keyboard exclusively. Tab to next cell, Enter to save and move to next row, Escape to cancel. Without this, the tool is unusable for high-volume entry.
**Complexity:** Medium-High. Custom keyboard event handling in the inline editor. Must handle combo boxes (Enter opens dropdown vs. confirms selection).
**Notes:** Strongly recommended for v1 given the data-entry nature of the tool. Technically a differentiator but close to table stakes for high-volume users.

### 6. Column-Level Search / Quick Filter in Moderator View
**Value:** Moderator who entered 200 rows wants to find the one for "John Doe" quickly. A quick filter bar above the table that filters client-side on visible rows is faster than navigating to admin filters.
**Complexity:** Low-Medium. Client-side filter on the already-loaded virtual scroll dataset.
**Dependencies:** Virtual scroll implementation. Client-side filter must not re-fetch from server — it filters the loaded window.

### 7. Confirmation Before Void
**Value:** Voiding a row is irreversible from the moderator's perspective (though admin can un-void). A confirmation dialog prevents accidental voids.
**Complexity:** Low. Standard confirm modal.
**Notes:** Nearly table stakes from a data safety perspective, but included here because many lightweight tools skip it.

---

## Anti-Features (Deliberately Exclude)

These features are commonly requested, look reasonable on paper, but consistently add complexity, maintenance burden, or product confusion without proportional value for this tool's scope and user size.

### 1. Hard Delete
**Why avoid:** Destroys audit trail integrity. Once a record is gone, there is no recovery. For any auditing tool, this is a design violation, not a feature.
**Instead:** Void/soft-delete with strikethrough display. Admin can always see voided rows.

### 2. Bulk Row Edit
**Why avoid:** For a small team doing daily entry, bulk edit is rarely needed but introduces significant surface area for accidental mass corruption. "I bulk-changed all prices to 0" is a support nightmare with no simple undo in a simple system.
**Instead:** Individual inline editing per row. If genuinely needed, defer to v2 with proper confirmation UX and audit coverage.

### 3. In-App Notifications / Activity Feed
**Why avoid:** For a small internal team, notifications add infrastructure (websockets or polling) and UI complexity that does not justify the effort. The admin checks the dashboard on demand.
**Instead:** Admin checks the global audit log. Already out of scope per PROJECT.md — confirmed correct.

### 4. Row Comments / Discussion Thread per Row
**Why avoid:** Turns a sales audit tool into a project management tool. Scope creep. Comments require threading, read/unread state, notifications — each is its own feature.
**Instead:** The Notes field on each row handles freeform context. That is sufficient for v1.

### 5. Email / SMS Alerts on Specific Events
**Why avoid:** Requires email infrastructure (SMTP service, templates, deliverability management) and makes the app stateful about "did this notification fire yet." Not proportional for a small team that can check the tool directly.
**Instead:** Defer to v2. Already out of scope per PROJECT.md.

### 6. Complex Row Statuses (Pending / Approved / Rejected)
**Why avoid:** A workflow approval system is a different product. It requires state machines, role-based transitions, and notification hooks. For an auditing tool where the admin is the approver-of-record, the admin's ability to edit/void is sufficient.
**Instead:** Active / voided only. Admin edits rows directly rather than "approving" them.

### 7. Quantity Field (Unit Count per Sale)
**Why avoid:** Not confirmed needed per PROJECT.md. Adding it without validation means the price calculation logic (price x qty) must change, the reports must change, and edge cases multiply. One unverified field cascades.
**Instead:** Defer until a moderator explicitly cannot do their job without it. Then add in v2.

### 8. Mobile Data Entry (Native App Feel)
**Why avoid:** The spreadsheet-like layout with combo boxes and inline editing is inherently desktop-optimized. Attempting to make full data entry feel native on mobile (especially inline cell editing) requires a completely different interaction model.
**Instead:** Responsive layout so it works acceptably on mobile for viewing, but the primary device is desktop. Do not optimize data entry for mobile in v1.

### 9. Granular Permission Sets (Custom Roles)
**Why avoid:** "Admin can see this column but not that one" permission matrices are a maintenance trap. Two clean roles (Admin, Moderator) with one toggle (edit rights) cover all stated use cases.
**Instead:** Admin / Moderator with per-user edit rights toggle. If the team grows significantly, address in v2 with a real RBAC system.

### 10. Undo/Redo on Cell Edits
**Why avoid:** Browser-level undo in a form input works within an active edit session. Implementing application-level undo across persisted writes requires an undo stack, transaction reversal, and audit log reconciliation. Complexity is disproportionate.
**Instead:** The audit log provides the reconstruction capability. Admin can revert a change manually by looking at the old value and typing it back. For a small team, this is sufficient.

---

## UX Patterns That Work

Patterns validated by use in tools like Airtable, Notion, Retool internal apps, Google Sheets, and AG Grid implementations.

### Inline Edit: Click-to-Edit with Visible Save State
- Clicking a cell enters edit mode for that cell only (not the whole row).
- A subtle border or background change signals "editing" state.
- Escape cancels with no save. Enter or Tab confirms and advances focus.
- Autosave on blur (leaving the cell) reduces explicit "Save" button clicks but requires clear visual feedback ("Saved" flash or green checkmark) to prevent "did it save?" anxiety.
- **Critical:** Never require a "Save Row" button at the end of the row. Users will forget to click it. Either autosave on blur or make save happen per-cell.

### Combo Box: Type-to-Filter with Keyboard Navigation
- Show full list on focus. Filter as user types.
- Arrow keys navigate, Enter selects, Escape closes.
- "No results" state must be visible — not just an empty dropdown.
- For small catalogs (< 50 items), client-side filtering is fine and faster than server-round-trips.

### Voided Row Styling
- Strikethrough on all text cells. Muted/grey color.
- Void action should be a clearly labelled button (not an icon-only button) accessible on hover or row selection.
- Voided rows should remain in default view unless the user explicitly hides them. A "hide voided" toggle is acceptable but not default.
- In exports: include voided rows with a STATUS column ("active" / "void"). Never silently omit them.

### Admin Dashboard Information Hierarchy
1. **Top level (first screen load):** Summary numbers — total sales count, total revenue, date range context. These are the numbers the admin checks every morning.
2. **Second level (above the fold on scroll or tab):** Charts — breakdown by product, by MOP, trend over time. These answer "where is revenue coming from."
3. **Third level (below the fold or on a tab):** The filterable table of all rows with per-row metadata (creator, timestamps). This is the drill-down layer.
4. **Fourth level (on demand):** Per-row audit log. Never surface this prominently — it is the "investigate this specific row" tool, not the default view.

### Role-Specific Navigation
- Admin sees: Dashboard, All Sales, Users, Products, MOPs, (Global Audit Log).
- Moderator sees: My Sales, (nothing else).
- Do not show admins a "My Sales" view. They own all rows implicitly.
- Do not show moderators admin sections with a "no permission" error — hide the nav items entirely.

### Virtual Scroll vs Pagination
- Virtual scroll is the correct choice for this tool. It preserves the spreadsheet mental model.
- Ensure the scroll container has a fixed height (not page-level scroll) so the header row stays anchored.
- Skeleton rows during initial load are better than a spinner that replaces the whole table.
- **Known gotcha:** Inline editing with virtual scroll requires careful handling — the cell being edited must not be unmounted when scrolled off. Anchor the edit row in the DOM even when outside the viewport window, or commit/cancel before allowing scroll.

### Audit Log: Useful vs Overwhelming
- **Useful:** Field-level diff (field name, old value, new value, who changed it, when). One row per changed field per save action. Grouped by the same save event (same timestamp/action_id).
- **Overwhelming:** JSON blob of the entire row state before and after on every change. Hard to scan. Hard to understand what actually changed.
- **Overwhelming:** Logging every page view, every filter applied, every dropdown opened. Audit logs should log writes, not reads.
- **Recommended display:** Table with columns — Timestamp | User | Field | From | To. Newest first. If multiple fields changed in one save, group them with a subtle separator.
- **Do not log:** Failed read attempts, successful logins (unless security audit is required — not the case here), filter/sort interactions.

### Filter UX for Admin Sales View
- Filters should be always-visible (not hidden in a dropdown) because admins use them constantly.
- Date range picker should default to "last 30 days" not "all time" — all time queries on a large table are slow and rarely what the admin wants.
- "Clear all filters" button must be prominent when any filter is active.
- Filter state should survive page refresh (URL params or localStorage) so admin can bookmark a view.

---

## v2 Radar (Common Requests After v1)

These are the features users of similar tools consistently request once the core is stable. They are explicitly out of scope for v1 but should influence schema and architecture decisions now.

### 1. Multi-Tenant / Multiple Organizations
**Signal:** "Can I set this up for another team / another client?"
**Architecture implication:** Add `organization_id` to all tables from day one. Already called out in PROJECT.md — confirmed correct.
**Complexity:** High (auth isolation, per-org catalogs, billing if SaaS).

### 2. Multiple Admins per Organization
**Signal:** "Can I make my manager an admin too?"
**Architecture implication:** Admin is a role, not a user count. Schema should support N admins from the start.
**Complexity:** Low if schema is role-based (it is).

### 3. Sales Targets / Moderator Quotas
**Signal:** "I want to see how each moderator is tracking against their monthly target."
**Architecture implication:** Needs a targets table (moderator_id, period, target_amount). Dashboard needs a "progress vs target" chart.
**Complexity:** Medium.

### 4. Email Notifications (Digest or Event-Driven)
**Signal:** "Can I get a daily email summary?" or "Alert me when a row is voided."
**Architecture implication:** Needs a job queue (Bull/BullMQ) and an email provider (Resend, Postmark, SES). Do not bolt onto Express request handlers.
**Complexity:** Medium-High (infrastructure + deliverability).

### 5. Quantity Field + Price x Quantity Calculation
**Signal:** Moderators start saying "this sale was for 3 units."
**Architecture implication:** Adds a quantity column to sales table. Revenue calculations must switch from SUM(price) to SUM(price * quantity). Reports change.
**Complexity:** Medium. Schema change is easy; report and export changes cascade.

### 6. Row-Level Comments / Notes Thread
**Signal:** "I want to leave a note on this row without overwriting the Notes field."
**Architecture implication:** Separate row_comments table (row_id, user_id, body, created_at).
**Complexity:** Medium. Needs its own UI surface (expandable row).

### 7. Brute-Force / Rate-Limit Protection on Login
**Signal:** Security review, or "we had someone try to guess passwords."
**Architecture implication:** Already flagged in PROJECT.md as v2. Use express-rate-limit on the login endpoint. Low code complexity, but requires testing.
**Complexity:** Low. One middleware.

### 8. Bulk CSV Import
**Signal:** "We have 500 historical rows in a spreadsheet. Can we import them?"
**Architecture implication:** File upload endpoint, CSV parsing (papaparse), validation per row, transactional insert with audit events for each imported row.
**Complexity:** High. Edge cases in CSV parsing, duplicate detection, price reconciliation with catalog, partial failure handling.

### 9. Advanced Reporting / Custom Date Groupings
**Signal:** "Can I see revenue by week? By quarter? Year over year?"
**Architecture implication:** Reporting queries become more complex. Consider a dedicated reporting layer or materialized views if row counts grow large.
**Complexity:** Medium-High.

### 10. Audit Log Export
**Signal:** "Can I export the full audit trail as a spreadsheet for our accountant?"
**Architecture implication:** Audit log CSV export with join to user names and row identifiers. Similar to sales CSV export but from audit_log table.
**Complexity:** Low-Medium. Same pattern as sales export.

---

## Feature Dependencies Map

```
Auth (session, roles)
  └── Role-specific views (admin nav vs moderator nav)
      └── Moderator: Sales sheet
          ├── Product catalog (must exist first)
          │   └── Combo box population
          │   └── Price auto-populate (locked)
          ├── MOP catalog (must exist first)
          │   └── Combo box population
          ├── Inline edit
          │   └── Per-row audit log (fires on every write)
          ├── Add row
          ├── Void row
          │   └── Strikethrough display
          └── Virtual scroll

      └── Admin: Sales view
          ├── Filter (date, product, MOP, moderator)
          │   └── CSV export (filtered)
          ├── Dashboard charts (aggregations)
          ├── Per-row metadata (created-by, edited-by)
          └── Per-row audit log viewer

      └── Admin: User management
          └── Edit rights toggle per moderator

      └── Admin: Product management
      └── Admin: MOP management
```

**Critical path for v1 build order:**
1. Auth + roles (everything gates on this)
2. Product + MOP catalogs (sales sheet cannot function without them)
3. Sales row create/edit (core value)
4. Per-row audit log (core value — must ship with row editing, not after)
5. Void / soft-delete
6. Admin sales view + filters + export
7. Dashboard charts
8. User management (can be built in parallel with 3-6 but needed before onboarding real moderators)

---

*Confidence note: Domain patterns sourced from training knowledge of Airtable, Notion, Google Sheets, Retool, and enterprise audit systems. These patterns are stable and well-documented. No WebSearch or Context7 lookups were available in this session — core internal tooling UX patterns are LOW risk of being outdated. Specific library API details (e.g., AG Grid virtual scroll edge cases) should be verified against current docs during implementation.*
