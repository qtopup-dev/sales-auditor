# Phase 4: Admin Dashboard + Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-25
**Phase:** 04-admin-dashboard
**Mode:** --auto (all choices auto-selected using recommended defaults)
**Areas discussed:** Dashboard Structure, Filter Approach, Stats/Charts Backend, CSV Export, User Management UI, Username Edit Endpoint

---

## Dashboard Structure

| Option | Description | Selected |
|--------|-------------|----------|
| DashboardPage = stats + charts + filterable table | Single admin hub — all observability in one place | ✓ |
| DashboardPage = stats + charts only; table at /sales | Separate pages; /sales enhanced for admin role | |

**Auto-selected:** DashboardPage hosts everything (ADMIN-01 through ADMIN-12). SalesPage stays as shared inline-edit sheet.
**Notes:** /sales remains unchanged for inline editing (void, cell edit). Admin-specific columns, filters, and CSV export live exclusively on DashboardPage.

---

## Filter Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side filtering | Fetch all rows once, filter in JS memory | ✓ |
| Server-side filtering | New admin endpoint with query params | |

**Auto-selected:** Client-side filtering.
**Notes:** Internal tool with manageable dataset. Simpler than a second endpoint. Filter state: { startDate, endDate, productId, mopId, createdById }. Always-visible filter bar, live on change.

---

## Stats/Charts Backend

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated GET /api/admin/summary | Precomputed aggregates from Prisma, Decimal math on server | ✓ |
| Frontend-computed from raw data | Sum priceSnapshot in JS after fetching all rows | |

**Auto-selected:** Dedicated backend summary endpoint.
**Notes:** Revenue must never be computed in JS float. Prisma groupBy aggregations for product/MOP breakdown and trend data. Returns totalCount, totalRevenue (string), trendData, productBreakdown, mopBreakdown.

---

## CSV Export

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend CSV via @json2csv/plainjs | Browser-side generation from filtered rows; blob download | ✓ |
| Backend CSV endpoint | Server accepts filter params, returns file stream | |

**Auto-selected:** Frontend CSV generation.
**Notes:** Since filtering is client-side, frontend holds exact filtered dataset. @json2csv/plainjs works browser-side (no Node.js deps). Formula injection sanitization + UTF-8 BOM done in browser. Filename: sales-export-{ISO-date}.csv.

---

## User Management UI

| Option | Description | Selected |
|--------|-------------|----------|
| UserModal for username edit; invite modal | Consistent with ProductModal pattern | ✓ |
| Inline edit in table row | Different pattern from rest of app | |

**Auto-selected:** Modal pattern for both username edit and invite display.
**Notes:** "Invite Moderator" button calls existing POST /api/auth/invite-generate, shows link in modal with Copy button. Reset Password button shows temp password once in modal. canEdit toggle is inline in table (same as ProductsPage Activate/Deactivate).

---

## Username Edit Endpoint

| Option | Description | Selected |
|--------|-------------|----------|
| PATCH /api/users/:id/username (dedicated) | Separate from canEdit PATCH; validates unique username | ✓ |
| Extend existing PATCH /api/users/:id | Accept either canEdit or username in same endpoint | |

**Auto-selected:** Dedicated PATCH /api/users/:id/username.
**Notes:** Cleaner RBAC surface; validates uniqueness within org (409 USERNAME_TAKEN on conflict). Admin-only via existing usersRouter requireRole guard.

---

## Claude's Discretion

- Recharts chart dimensions, color palette, responsive container setup
- Whether trendData groups by day or is computed in JS from raw groupBy results
- Filter dropdowns using react-select v5 (already installed) vs native selects
- Exact Tailwind layout of stats banner cards
- Whether inactive users are shown in UsersPage (recommended: show all, per ProductsPage precedent)

## Deferred Ideas

- Global audit log feed — v2 requirement (listed in REQUIREMENTS.md)
- Advanced chart click-to-filter interactions — v2
- PDF/Excel native export — v2
- Server-side pagination for admin table — backlog if dataset grows
