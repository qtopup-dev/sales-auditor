# Requirements — Sales Auditing Web App

**Version:** v1
**Last updated:** 2026-06-17
**Status:** Defined — roadmap traceability complete

---

## v1 Requirements

### Authentication (AUTH)

- [ ] **AUTH-01**: User can log in with username and password
- [ ] **AUTH-02**: Session persists until the user explicitly logs out (no automatic expiry)
- [ ] **AUTH-03**: User can log out from any page, invalidating their session immediately
- [ ] **AUTH-04**: Admin can create a moderator account by generating an invite link
- [ ] **AUTH-05**: Invited user can register by visiting the invite link and setting their own password
- [ ] **AUTH-06**: Invite link is single-use and expires after 48 hours
- [ ] **AUTH-07**: Admin can manually reset any user's password (invalidates that user's active session immediately)

### Roles & Permissions (ROLES)

- [ ] **ROLES-01**: System enforces two roles: Admin and Moderator
- [ ] **ROLES-02**: Admin can toggle edit rights on or off for any individual moderator
- [ ] **ROLES-03**: Moderator with edit rights enabled can edit sales rows they personally created
- [ ] **ROLES-04**: Moderator without edit rights can only create new rows, not edit existing ones
- [ ] **ROLES-05**: Admin can edit any sales row regardless of who created it
- [ ] **ROLES-06**: Only admin can void (soft-delete) a sales row
- [ ] **ROLES-07**: Moderator sees only the sales sheet and their own entry history
- [ ] **ROLES-08**: Admin sees the admin dashboard, all sales, user management, product catalog, and MOP catalog
- [ ] **ROLES-09**: Backend enforces all ownership and role checks — frontend UI alone is not sufficient

### Sales Sheet — Moderator View (SALES)

- [ ] **SALES-01**: Sales sheet displays rows in a spreadsheet-like table, newest rows first
- [ ] **SALES-02**: Table uses virtual scroll to handle large row counts without pagination
- [ ] **SALES-03**: Row heights expand dynamically to fit the Notes field content
- [ ] **SALES-04**: Moderator can click "Add Row" to append a blank input row at the top of the sheet
- [ ] **SALES-05**: Moderator can click any editable cell to edit it inline (true spreadsheet feel)
- [ ] **SALES-06**: Cell saves to the server on blur; cell is disabled and shows a save indicator during the round-trip
- [ ] **SALES-07**: Each sales row contains: Product, Price, Mode of Payment, Receiver, Notes, Date Edited
- [ ] **SALES-08**: Product column is a searchable combo box showing only active products
- [ ] **SALES-09**: Price column auto-populates from the selected product's price and is read-only (locked)
- [ ] **SALES-10**: Mode of Payment column is a searchable combo box showing only active MOPs
- [ ] **SALES-11**: Receiver is a required free-text input
- [ ] **SALES-12**: Notes is an optional free-text input; long content expands the row height
- [ ] **SALES-13**: Date Edited auto-updates to the current timestamp on every create or edit
- [ ] **SALES-14**: Product, Mode of Payment, and Receiver are required — row cannot be saved without them
- [ ] **SALES-15**: Voided rows remain visible in the sheet with strikethrough styling; they are never hidden
- [ ] **SALES-16**: Moderator can only edit rows they personally created and only if their edit rights are enabled
- [ ] **SALES-17**: Inactive products and MOPs are hidden from the combo boxes for new rows but still display correctly on existing rows that reference them
- [ ] **SALES-18**: Sales sheet layout is responsive and usable on mobile devices

### Admin — Sales View & Reporting (ADMIN)

- [ ] **ADMIN-01**: Admin can view all sales rows from all moderators in a single table
- [ ] **ADMIN-02**: Each row in the admin view displays: Product, Price, MOP, Receiver, Notes, Created By, Created At, Last Edited By, Date Edited, Status (active/void)
- [ ] **ADMIN-03**: Admin can filter the sales table by date range (created or edited date)
- [ ] **ADMIN-04**: Admin can filter the sales table by product
- [ ] **ADMIN-05**: Admin can filter the sales table by mode of payment
- [ ] **ADMIN-06**: Admin can filter the sales table by moderator (who created the row)
- [ ] **ADMIN-07**: Admin can export the current filtered view to a CSV file
- [ ] **ADMIN-08**: CSV export includes voided rows with a STATUS column (active/void)
- [ ] **ADMIN-09**: CSV export is safe from formula injection (cells starting with =, -, +, @ are sanitized)
- [ ] **ADMIN-10**: Admin dashboard shows summary statistics: total sales count, total revenue
- [ ] **ADMIN-11**: Admin dashboard shows charts: sales over time (trend), breakdown by product, breakdown by MOP
- [ ] **ADMIN-12**: Admin can open a per-row audit log drawer showing every field change (field, old value, new value, who, when) in newest-first order

### Product Catalog (PROD)

- [ ] **PROD-01**: Admin can create a product with: name and price
- [ ] **PROD-02**: Admin can edit a product's name and price
- [ ] **PROD-03**: Admin can toggle a product's status between active and inactive
- [ ] **PROD-04**: Admin can view all products (active and inactive) in a management table
- [ ] **PROD-05**: Inactive products are hidden from the Product combo box in the sales sheet for new rows
- [ ] **PROD-06**: Existing sales rows retain their product name and price snapshot even if the product is later edited or deactivated
- [ ] **PROD-07**: Each product's price at the time of the sales row creation is stored as a snapshot on the sales row (price_snapshot) — price changes to the product catalog do not affect historical rows

### Mode of Payment Catalog (PAY)

- [ ] **PAY-01**: Admin can create a mode of payment with: payment method name
- [ ] **PAY-02**: Admin can edit a mode of payment's name
- [ ] **PAY-03**: Admin can toggle a MOP's status between active and inactive
- [ ] **PAY-04**: Admin can view all MOPs (active and inactive) in a management table
- [ ] **PAY-05**: Inactive MOPs are hidden from the MOP combo box in the sales sheet for new rows
- [ ] **PAY-06**: Existing sales rows retain their MOP reference even if the MOP is later deactivated

### User Management (USERS)

- [ ] **USERS-01**: Admin can view a list of all users with their role, username, and edit-rights status
- [ ] **USERS-02**: Admin can invite a new moderator by generating a single-use invite link
- [ ] **USERS-03**: Admin can edit a user's username
- [ ] **USERS-04**: Admin can toggle a moderator's edit rights on or off
- [ ] **USERS-05**: Admin can reset any user's password (generates a new invite-style reset link or sets a new password directly)
- [ ] **USERS-06**: Resetting a user's password immediately invalidates all of that user's active sessions

### Audit Log (AUDIT)

- [ ] **AUDIT-01**: Every create, edit, and void action on a sales row is logged with: user, field changed, old value, new value, action type, timestamp
- [ ] **AUDIT-02**: Audit log records are written inside the same database transaction as the data mutation — no change can occur without an audit record
- [ ] **AUDIT-03**: Admin can view the audit log for any individual sales row via an in-table drawer

---

## v2 Requirements (Deferred)

- Quantity field per sales row (total = price × quantity)
- Multiple admin accounts with distinct permission levels
- Multi-tenant organization isolation
- Email notifications (on edit, on void, on new row)
- Brute-force protection and login rate limiting
- Keyboard tab-navigation across rows in the sales sheet
- Global audit log feed (all changes across all rows and all tables)
- Audit logging for admin actions on products, MOPs, and users
- Bulk CSV import of sales rows
- Sales targets / moderator quotas
- Product variants with multiple price tiers
- Row comments / discussion threads

---

## Out of Scope

| Exclusion | Reason |
|-----------|--------|
| Hard delete of any sales row | Soft-delete (void) only — full audit trail must never have gaps |
| Self-service password reset via email | Admin handles all resets; email infrastructure out of scope for v1 |
| OAuth / SSO login | Username + password only for v1 |
| Price override by moderator | Price is locked at product price — prevents data quality issues |
| Row status beyond active/void | No pending/approved/rejected workflow for v1 |
| Bulk row editing | Risk of mass data corruption; team size does not justify it |
| In-app or email notifications | Infrastructure cost not proportional for v1 |
| Custom permission sets | Two fixed roles (Admin, Moderator) for v1 |
| Hard-coded moderator assignment | Rows auto-assign to creator |

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Pending |
| AUTH-06 | Phase 2 | Pending |
| AUTH-07 | Phase 2 | Pending |
| ROLES-01 | Phase 2 | Pending |
| ROLES-02 | Phase 2 | Pending |
| ROLES-03 | Phase 2 | Pending |
| ROLES-04 | Phase 2 | Pending |
| ROLES-05 | Phase 2 | Pending |
| ROLES-06 | Phase 2 | Pending |
| ROLES-07 | Phase 2 | Pending |
| ROLES-08 | Phase 2 | Pending |
| ROLES-09 | Phase 2 | Pending |
| PROD-01 | Phase 2 | Pending |
| PROD-02 | Phase 2 | Pending |
| PROD-03 | Phase 2 | Pending |
| PROD-04 | Phase 2 | Pending |
| PROD-05 | Phase 2 | Pending |
| PROD-06 | Phase 2 | Pending |
| PROD-07 | Phase 2 | Pending |
| PAY-01 | Phase 2 | Pending |
| PAY-02 | Phase 2 | Pending |
| PAY-03 | Phase 2 | Pending |
| PAY-04 | Phase 2 | Pending |
| PAY-05 | Phase 2 | Pending |
| PAY-06 | Phase 2 | Pending |
| SALES-01 | Phase 3 | Pending |
| SALES-02 | Phase 3 | Pending |
| SALES-03 | Phase 3 | Pending |
| SALES-04 | Phase 3 | Pending |
| SALES-05 | Phase 3 | Pending |
| SALES-06 | Phase 3 | Pending |
| SALES-07 | Phase 3 | Pending |
| SALES-08 | Phase 3 | Pending |
| SALES-09 | Phase 3 | Pending |
| SALES-10 | Phase 3 | Pending |
| SALES-11 | Phase 3 | Pending |
| SALES-12 | Phase 3 | Pending |
| SALES-13 | Phase 3 | Pending |
| SALES-14 | Phase 3 | Pending |
| SALES-15 | Phase 3 | Pending |
| SALES-16 | Phase 3 | Pending |
| SALES-17 | Phase 3 | Pending |
| SALES-18 | Phase 3 | Pending |
| AUDIT-01 | Phase 3 | Pending |
| AUDIT-02 | Phase 3 | Pending |
| AUDIT-03 | Phase 3 | Pending |
| ADMIN-01 | Phase 4 | Pending |
| ADMIN-02 | Phase 4 | Pending |
| ADMIN-03 | Phase 4 | Pending |
| ADMIN-04 | Phase 4 | Pending |
| ADMIN-05 | Phase 4 | Pending |
| ADMIN-06 | Phase 4 | Pending |
| ADMIN-07 | Phase 4 | Pending |
| ADMIN-08 | Phase 4 | Pending |
| ADMIN-09 | Phase 4 | Pending |
| ADMIN-10 | Phase 4 | Pending |
| ADMIN-11 | Phase 4 | Pending |
| ADMIN-12 | Phase 4 | Pending |
| USERS-01 | Phase 4 | Pending |
| USERS-02 | Phase 4 | Pending |
| USERS-03 | Phase 4 | Pending |
| USERS-04 | Phase 4 | Pending |
| USERS-05 | Phase 4 | Pending |
| USERS-06 | Phase 4 | Pending |

---

## Implementation Notes (from research)

- **Price storage:** Use `DECIMAL(10,2)` in MySQL and Prisma schema — never `Float`. Return price values as strings from the API to avoid JS floating-point precision loss.
- **Timestamps:** Configure MySQL, Prisma connection URL, and Node process to UTC from day one. All `Date Edited` values stored and returned in UTC.
- **organization_id:** Add `organization_id` as a non-null foreign key on all business tables (users, sales, products, MOPs, audit_log, invite_tokens) from day one — zero-cost v2 multi-tenant preparation.
- **Session store:** Use `express-session` + MySQL-backed session store (not in-memory). JWT is explicitly excluded — admin session revocation (AUTH-07, USERS-06) requires immediate server-side invalidation.
- **Soft-delete enforcement:** Apply Prisma middleware or a global `where` clause to filter voided/inactive records on every list query. One missed filter = silent data corruption in totals or dropdowns.
- **Dynamic row heights:** Notes field content drives variable row heights in the virtual scroll table. Use `@tanstack/react-virtual` with dynamic size measurement. Row heights must update after cell edits without losing scroll position.
