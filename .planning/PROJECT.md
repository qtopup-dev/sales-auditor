# Sales Auditing Web App

## What This Is

A web-based sales auditing tool for a single organization. Moderators input and track sales entries in a spreadsheet-like interface, while admins oversee all data, manage the product/payment catalog, and control user access. Built on React + Node.js/Express + MySQL, deployed on a cloud VPS.

## Core Value

Every sales entry is traceable — who submitted it, what changed, when, and by whom — giving the admin a reliable audit trail of all sales activity.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Authentication**
- [ ] Users log in with username + password
- [ ] Admin creates moderator accounts via invite link (moderator sets their own password)
- [ ] Sessions persist until explicit logout
- [ ] Admin can manually reset any user's password

**Roles & Permissions**
- [ ] Two roles: Admin and Moderator
- [ ] Admin can toggle edit rights per moderator (grants/revokes ability to edit their own rows)
- [ ] Moderators can only edit rows they personally created (auto-assigned on creation)
- [ ] Admin can edit any sales row at any time
- [ ] Rows are never hard-deleted — soft-delete only (void status, strikethrough display)

**Sales Sheet (Moderator View)**
- [ ] Spreadsheet-style table, newest rows first
- [ ] Virtual scroll (no pagination — handles large row counts smoothly)
- [ ] Inline cell editing (click a cell to edit in place)
- [ ] "Add Row" button appends a new blank row
- [ ] Columns: Product, Price, Mode of Payment, Receiver, Notes, Date Edited
- [ ] Product column: searchable combo box showing active products only
- [ ] Price column: auto-populates from selected product; read-only (locked)
- [ ] Mode of Payment column: searchable combo box showing active MOPs only
- [ ] Receiver: free-text input (required)
- [ ] Notes: free-text input (optional)
- [ ] Date Edited: auto-timestamp, updates on every create or edit
- [ ] Voided rows remain visible with strikethrough styling
- [ ] Mobile-friendly responsive layout

**Admin Dashboard — Sales View**
- [ ] View all sales entries across all moderators
- [ ] Filter by: date range, product, mode of payment, moderator (creator)
- [ ] CSV export of filtered results
- [ ] Dashboard charts: total sales count, total revenue, breakdown by product, breakdown by payment method, trends over time
- [ ] Each row displays: created-by, created-at, last-edited-by, last-edited-at

**Admin — User Management**
- [ ] View all users (admins + moderators)
- [ ] Create moderator via invite link
- [ ] Edit user details (username)
- [ ] Toggle moderator edit rights on/off
- [ ] Reset any user's password

**Admin — Products**
- [ ] Create, edit, view, and deactivate products
- [ ] Each product: name, price, status (active/inactive)
- [ ] Inactive products hidden from new sales entries; existing rows retain their product reference

**Admin — Mode of Payment**
- [ ] Create, edit, view, and deactivate payment methods
- [ ] Each MOP: payment method name, status (active/inactive)
- [ ] Inactive MOPs hidden from new entries; existing rows retain their MOP reference

**Audit Log**
- [ ] Full field-level change log on every sales row edit
- [ ] Log captures: user, field changed, old value, new value, timestamp
- [ ] Accessible to admin (viewable per row or as global log)

### Out of Scope

- Hard delete of any sales row — soft-delete (void) is the only removal mechanism
- Self-service password reset via email — admin handles all resets
- Product variants/price tiers — one price per product for v1
- Sales targets or moderator quotas — v2
- Email/in-app notifications — v2
- Multi-tenant isolation — single company for v1 (schema designed to accommodate future)
- Brute-force/rate-limit protection on login — v1 is internal tool, add in v2
- Quantity field per row — deferred (not confirmed needed)
- Row statuses beyond active/void — no pending/confirmed states in v1

## Context

- **Domain:** Internal sales auditing tool for a single business unit
- **Users:** Small team — one or more admins, a handful of moderators
- **Deployment target:** Cloud VPS (provider TBD)
- **Database:** MySQL with Prisma ORM (recommended for type-safe queries, easy migrations, and future multi-tenant schema evolution)
- **Backend:** Node.js + Express — recommended stack with Prisma ORM; well-matched to React frontend, large ecosystem, easy to deploy on VPS
- **Schema design note:** Although v1 is single-tenant, leave room in the schema (e.g. an `organizations` table) for multi-tenant isolation, since multi-tenant and multiple-admin support are confirmed v2 targets

## Constraints

- **Tech stack:** React (frontend), Node.js/Express (backend), MySQL (database) — fixed by user
- **Auth method:** Username + password only — no OAuth, no magic links for v1
- **Delete policy:** Soft-delete only — no hard deletes anywhere in the system
- **Price mutability:** Product price is locked once a sales row is saved — moderators cannot override it
- **Edit ownership:** Moderators can only edit rows they created; edit rights are controlled by admin toggle per user

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Prisma ORM over raw SQL | Type safety, auto-migration, cleaner code, easier to evolve schema for multi-tenant v2 | — Pending |
| Soft-delete only | Full auditability — no data is ever lost | — Pending |
| Price locked at row creation | Prevents retroactive price manipulation; price history preserved via audit log | — Pending |
| Auto-assign row to creator | Simplest ownership model; avoids admin overhead of manually assigning rows | — Pending |
| Virtual scroll over pagination | Spreadsheet-like feel; works better for large datasets without page breaks | — Pending |
| Single-tenant v1, schema ready for multi-tenant | User confirmed multi-tenant is a likely v2 target | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-16 after initialization*
