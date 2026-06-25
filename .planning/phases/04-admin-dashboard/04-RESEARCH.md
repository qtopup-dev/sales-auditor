# Phase 4: Admin Dashboard + Management - Research

**Researched:** 2026-06-25
**Domain:** Recharts v2, @json2csv/plainjs, Prisma groupBy aggregations, client-side filtering, user management CRUD
**Confidence:** HIGH (existing codebase patterns verified; new library APIs verified via npm/docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** DashboardPage (`/dashboard`) is the full admin hub: stats banner + 3 Recharts charts + filterable all-sales table + CSV export. ADMIN-01 through ADMIN-12 delivered on one page.
- **D-02:** SalesPage (`/sales`) remains unchanged.
- **D-03:** Admin all-sales table shows ALL columns: Product, Price, MOP, Receiver, Notes, Created By, Created At, Last Edited By, Date Edited, Status. Each row has Audit (AuditDrawer) and Void (VoidConfirmDialog) buttons.
- **D-04:** Client-side filtering. Fetch all rows via existing `GET /api/sales`. Filter in-memory.
- **D-05:** Filter bar always-visible above the table. Filters: date range, product, MOP, moderator/creator. Applied live on change — no "Apply" button.
- **D-06:** Filter state: `{ startDate: string | null, endDate: string | null, productId: number | null, mopId: number | null, createdById: number | null }`. Initial = all nulls.
- **D-07:** Dedicated `GET /api/admin/summary` endpoint returning precomputed aggregates. Revenue via Prisma aggregation, never JS float. Returns revenue as string with `.toFixed(2)`.
- **D-08:** Chart library: Recharts v2 (not yet installed). LineChart for trend (X=date, Y=count), BarChart for product breakdown, BarChart for MOP breakdown.
- **D-09:** Stats banner: "Total Sales" + "Total Revenue" cards. Charts below. All-sales table below charts. Summary stats NOT affected by client-side filters.
- **D-10:** Frontend generates CSV from filtered rows using `@json2csv/plainjs` (not yet installed).
- **D-11:** CSV safety: prepend `'` to values starting with `=`, `-`, `+`, `@`, `\t`, `\r`. UTF-8 BOM (`﻿`) prepended before download.
- **D-12:** CSV columns: Product, Price, MOP, Receiver, Notes, Created By, Created At, Last Edited By, Date Edited, Status. Voided rows included.
- **D-13:** CSV filename: `sales-export-{ISO-date}.csv`.
- **D-14:** UsersPage follows ProductsPage pattern: react-table v8, useQuery + useMutation, pessimistic per-row pending state.
- **D-15:** Users table columns: Username | Role | Edit Rights | Status | Actions (Edit, Toggle canEdit, Reset Password).
- **D-16:** Username editing via UserModal (pre-filled). Calls new `PATCH /api/users/:id/username`.
- **D-17:** Invite flow: "Invite Moderator" button calls existing `POST /api/auth/invite-generate`. Modal displays generated link with "Copy Link" button.
- **D-18:** Reset Password: button per row → calls existing `POST /api/users/:id/reset-password`. Modal shows temp password once with "Copy" instruction.
- **D-19:** canEdit toggle for moderators only (not admins). Calls existing `PATCH /api/users/:id`. Per-row pending state.
- **D-20:** New `PATCH /api/users/:id/username`. Validates: non-empty, 2–100 chars, unique within organizationId. Admin-only (usersRouter already mounts requireRole at router level). Returns updated user.
- **D-21:** Username uniqueness: `prisma.user.findFirst({ where: { username, organizationId, NOT: { id: targetId } } })`. 409 CONFLICT with `{ error: 'USERNAME_TAKEN' }` on conflict.
- **D-22:** `GET /api/admin/summary` on `protectedRouter` with `requireRole('admin')`. New file: `packages/backend/src/routes/admin.ts`. Mount as `protectedRouter.use('/admin', adminRouter)` in `app.ts`.
- **D-23:** Summary query: `prisma.sale.count` for totalCount (active + void), `prisma.sale.aggregate(_sum priceSnapshot, status: 'active')` for totalRevenue, groupBy for trendData/productBreakdown/mopBreakdown — all with explicit `organizationId` + `status: { in: [...] }` override.

### Claude's Discretion
- Exact Recharts chart dimensions, color palette, ResponsiveContainer setup
- Whether trendData groups by day (day is reasonable default)
- Tailwind layout of stats banner cards
- Whether filter bar uses react-select for dropdowns (react-select v5 already installed — reuse)
- Error handling in CSV download (try/catch, simple alert acceptable)
- Whether UsersPage shows inactive users (show all — ProductsPage precedent)

### Deferred Ideas (OUT OF SCOPE)
- Global audit log feed across all tables — v2
- Audit logging for admin actions on products/MOPs/users — v2
- Pagination / server-side virtual scroll for admin sales table — v2 backlog
- Advanced chart interactions (click-to-filter, drill-down tooltips) — v2
- Export format options beyond CSV — v2
- Bulk user operations — v2
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMIN-01 | Admin views all sales rows from all moderators in a single table | Existing `GET /api/sales` returns all rows with status override; DashboardPage replaces placeholder |
| ADMIN-02 | Each row shows all columns including Created By, Created At, Last Edited By, Date Edited, Status | All columns already present in `serializeSale()` serializer in sales.ts |
| ADMIN-03 | Filter by date range (created date) | Client-side: compare `sale.createdAt` ISO string to startDate/endDate strings |
| ADMIN-04 | Filter by product | Client-side: compare `sale.productId === productId` |
| ADMIN-05 | Filter by MOP | Client-side: compare `sale.mopId === mopId` |
| ADMIN-06 | Filter by moderator (creator) | Client-side: compare `sale.createdById === createdById` |
| ADMIN-07 | Export filtered view to CSV | `@json2csv/plainjs` Parser on filtered in-memory rows; Blob download |
| ADMIN-08 | CSV includes voided rows with STATUS column | Filtering includes both active/void; STATUS column mapped from `sale.status` |
| ADMIN-09 | CSV safe from formula injection | Sanitize function prepends `'` to dangerous-prefix cells |
| ADMIN-10 | Summary stats: total count + total revenue | `GET /api/admin/summary` with Prisma count + aggregate |
| ADMIN-11 | Charts: trend, product breakdown, MOP breakdown | Recharts v2 LineChart + two BarCharts |
| ADMIN-12 | Per-row audit log drawer | Reuse existing `AuditDrawer.tsx` — currently reads from Zustand; needs saleId prop adaptation |
| USERS-01 | Admin views all users with role, username, edit-rights status | Existing `GET /api/users` already returns all fields |
| USERS-02 | Admin invites moderator via invite link | Existing `POST /api/auth/invite-generate`; new invite modal in UsersPage |
| USERS-03 | Admin edits username | New `PATCH /api/users/:id/username` endpoint + UserModal |
| USERS-04 | Admin toggles moderator edit rights | Existing `PATCH /api/users/:id`; replicate pendingToggleId pattern |
| USERS-05 | Admin resets any user's password | Existing `POST /api/users/:id/reset-password`; new result modal showing temp password |
| USERS-06 | Password reset immediately invalidates all active sessions | Already implemented via `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?` |
</phase_requirements>

---

## Summary

Phase 4 is a pure feature-completion phase — all foundational infrastructure exists. The backend has the authentication, RBAC, session invalidation, and sales data patterns locked. The frontend has the table, modal, and query patterns established via ProductsPage. Phase 4 fills two placeholder pages (DashboardPage, UsersPage) and adds one new backend file (admin.ts).

The primary new technical territory is: (1) **Recharts v2** for charts — well-established library with stable TypeScript support; (2) **@json2csv/plainjs** for browser-side CSV generation — pure ES module, no Node.js deps; (3) **Prisma groupBy aggregations** for the summary endpoint — standard patterns with one gotcha (date grouping requires raw SQL); (4) **AuditDrawer adaptation** — currently reads saleId from Zustand store, needs a prop-based variant for DashboardPage.

**Primary recommendation:** Follow the existing ProductsPage/ProductModal blueprint exactly for UsersPage. The only architectural complexity is the Prisma date-grouping for trendData (requires `$queryRaw`) and the AuditDrawer adaptation (two options: add a `saleId` prop override, or create a thin wrapper that pushes to the Zustand store before opening).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sales data fetching (admin table) | API / Backend | — | Existing `GET /api/sales` with status override |
| Client-side filtering | Browser / Client | — | D-04 decision: in-memory filter on fetched data |
| Summary aggregations | API / Backend | — | CLAUDE.md Rule 6: Decimal math must not happen in JS |
| Chart rendering | Browser / Client | — | Recharts renders SVG in browser from data props |
| CSV generation | Browser / Client | — | Filter state is already in-memory; no round-trip needed |
| User management CRUD | API / Backend | Browser / Client | Backend enforces RBAC; frontend renders optimistically-blocked UI |
| Session invalidation on password reset | API / Backend | — | express-mysql-session DELETE SQL already implemented |
| AuditDrawer | Browser / Client | API / Backend | Component reads from `GET /api/sales/:id/audit` via useQuery |

---

## Standard Stack

### Core (already installed — no action needed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@tanstack/react-table` | 8.21.3 | Admin all-sales table + UsersPage table | Installed [VERIFIED: package.json] |
| `@tanstack/react-query` | 5.101.0 | Data fetching, mutation, cache invalidation | Installed [VERIFIED: package.json] |
| `react-select` | 5.10.2 | Filter bar dropdowns (product, MOP, moderator) | Installed [VERIFIED: package.json] |
| `react-hook-form` | 7.79.0 | UserModal form (username field) | Installed [VERIFIED: package.json] |
| `axios` | 1.18.0 | HTTP client via `api` singleton | Installed [VERIFIED: package.json] |
| `tailwindcss` | 3.4.19 | All styling | Installed [VERIFIED: package.json] |
| `prisma` | 7.8.0 | ORM for summary aggregations + username PATCH | Installed [VERIFIED: package.json] |

### New Packages to Install
| Library | Version | Purpose | Install Command |
|---------|---------|---------|-----------------|
| `recharts` | 3.9.0 | Charts (LineChart, BarChart) | `npm install recharts` in `packages/frontend` |
| `@json2csv/plainjs` | 7.0.6 | Browser-side CSV generation | `npm install @json2csv/plainjs` in `packages/frontend` |

[VERIFIED: npm view recharts version → 3.9.0; npm view @json2csv/plainjs version → 7.0.6]

**Note on recharts version naming:** The npm package "recharts" at version 3.9.0 is the current stable release. The CONTEXT.md and CLAUDE.md reference "Recharts v2" but the latest stable on npm is 3.x. The API described below is from the 3.x line which maintains backward-compatible v2 component names (BarChart, LineChart, ResponsiveContainer). [VERIFIED: npm dist-tags.latest = 3.9.0]

---

## Architecture Patterns

### System Architecture Diagram

```
Admin User
    |
    | (browser)
    v
DashboardPage
  ├── useQuery(['admin-summary'])
  │       └── GET /api/admin/summary
  │               └── prisma.sale.count / aggregate / $queryRaw
  │                       └── MySQL (sales table)
  │
  ├── useQuery(['sales'])  ← reuses existing endpoint
  │       └── GET /api/sales (status: {in: ['active','void']})
  │               └── MySQL (sales table, all rows)
  │
  ├── filterState (useState) ← applied in-memory on fetched data
  │       ├── startDate, endDate  → filter by createdAt
  │       ├── productId           → filter by productId
  │       ├── mopId               → filter by mopId
  │       └── createdById         → filter by createdById
  │
  ├── Stats Banner (totalCount, totalRevenue from summary)
  ├── Recharts Charts (trendData, productBreakdown, mopBreakdown from summary)
  ├── Admin Table (filteredRows from sales)
  │       ├── Audit button → AuditDrawer (GET /api/sales/:id/audit)
  │       └── Void button  → VoidConfirmDialog → POST /api/sales/:id/void
  └── CSV Export button → @json2csv/plainjs → Blob download

UsersPage
  ├── useQuery(['users'])
  │       └── GET /api/users (all users, active + inactive)
  │
  ├── Invite button → POST /api/auth/invite-generate → InviteModal (copy link)
  ├── Edit row     → UserModal → PATCH /api/users/:id/username
  ├── Toggle       → PATCH /api/users/:id { canEdit }  [existing]
  └── Reset Pwd    → POST /api/users/:id/reset-password → ResetPasswordModal (show temp pwd)
```

### Recommended Project Structure (new files only)

```
packages/backend/src/routes/
└── admin.ts              # NEW: GET /api/admin/summary

packages/frontend/src/pages/
├── DashboardPage.tsx     # REPLACE placeholder: stats + charts + table + filters + CSV
└── UsersPage.tsx         # REPLACE placeholder: user management table

packages/frontend/src/components/
├── admin/
│   ├── StatCard.tsx      # Stat banner card (count or revenue)
│   ├── SalesFilterBar.tsx # Filter bar with react-select dropdowns + date inputs
│   ├── AdminSalesTable.tsx # react-table v8 read-only table (no inline edit)
│   └── SalesCharts.tsx   # Three Recharts charts
└── users/
    ├── UserModal.tsx     # Username edit modal (react-hook-form)
    ├── InviteModal.tsx   # Displays generated link with Copy button
    └── ResetPasswordModal.tsx # Displays temp password with Copy instruction
```

---

## Pattern 1: Recharts v2/3 — TypeScript Usage

**What:** Recharts renders SVG charts declaratively as React components. ResponsiveContainer handles fluid width.

**Key insight:** Recharts 3.x maintains backward-compatible component names from v2. All component imports remain from `'recharts'`.

**Verified props from official docs:** [CITED: recharts.github.io/en-US/api]

```typescript
// Source: recharts.github.io API docs
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

// Trend chart (ADMIN-11)
// trendData shape: { date: string; count: number }[]
function TrendChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Product breakdown chart (ADMIN-11)
// productBreakdown shape: { name: string; count: number; revenue: string }[]
function ProductBreakdownChart({ data }: { data: { name: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="name" tick={{ fontSize: 11, angle: -30, textAnchor: 'end' }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

**TypeScript note:** Recharts ships its own TypeScript types — no `@types/recharts` needed. [VERIFIED: jsDocs.io recharts 3.9.0]

**ResponsiveContainer gotcha:** The parent `<div>` must have an explicit height (e.g., `h-64` / `height: 256px`) for ResponsiveContainer's `height="100%"` to work. An unsized flex parent collapses to 0px. [CITED: recharts.github.io/en-US/api]

---

## Pattern 2: @json2csv/plainjs — Browser-Side CSV Export

**What:** Pure ESM package, no Node.js dependencies. Works directly in Vite/browser context.

**API (synchronous Parser — correct for this use case):** [CITED: github.com/juanjoDiaz/json2csv README, npmpackage.info/@json2csv/plainjs]

```typescript
import { Parser } from '@json2csv/plainjs';

// Field configuration — rename JSON keys to human-readable CSV headers
const fields = [
  { label: 'Product',         value: 'productNameSnapshot' },
  { label: 'Price',           value: 'priceSnapshot' },
  { label: 'MOP',             value: 'mopNameSnapshot' },
  { label: 'Receiver',        value: 'receiver' },
  { label: 'Notes',           value: (row: SaleRow) => row.notes ?? '' },
  { label: 'Created By',      value: 'createdByUsername' },
  { label: 'Created At',      value: 'createdAt' },
  { label: 'Last Edited By',  value: (row: SaleRow) => row.lastEditedByUsername ?? '' },
  { label: 'Date Edited',     value: 'updatedAt' },
  { label: 'Status',          value: 'status' },
];

// Formula injection sanitizer (ADMIN-09, D-11)
// Characters that trigger injection in Excel/Sheets: = - + @ \t \r
const INJECTION_PREFIXES = ['=', '-', '+', '@', '\t', '\r'];

function sanitizeCell(value: unknown): string {
  const str = String(value ?? '');
  if (INJECTION_PREFIXES.some((prefix) => str.startsWith(prefix))) {
    return `'${str}`;
  }
  return str;
}

// Apply sanitizer via transforms option
const parser = new Parser({
  fields,
  transforms: [
    (row: Record<string, unknown>) => {
      const sanitized: Record<string, unknown> = {};
      for (const key of Object.keys(row)) {
        sanitized[key] = sanitizeCell(row[key]);
      }
      return sanitized;
    },
  ],
});

// Generate CSV and trigger download (D-13)
function downloadCSV(filteredRows: SaleRow[]): void {
  try {
    const csvContent = parser.parse(filteredRows);
    const BOM = '﻿';  // UTF-8 BOM for Excel encoding (D-11)
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toISOString().slice(0, 10);
    link.download = `sales-export-${today}.csv`;  // D-13
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('CSV export failed. Please try again.');  // D-10 discretion
  }
}
```

**withBOM option:** The library has a `withBOM` option but it prepends BOM only to the CSV string itself. Prepending manually before the Blob gives more explicit control and matches D-11 requirements exactly. Either approach works — manual is clearer. [ASSUMED — `withBOM` option behavior not verified in this session against v7.0.6 source]

---

## Pattern 3: Prisma groupBy — Summary Aggregations

**What:** Prisma `groupBy` supports `_count` and `_sum` on numeric/Decimal fields. The result type includes aggregation sub-objects. [CITED: prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing]

### totalCount (active + void — override soft-delete filter)

```typescript
// Override $extends softDeleteFilter by providing explicit status
const totalCount = await prisma.sale.count({
  where: {
    organizationId,
    status: { in: ['active', 'void'] },
  },
});
```

### totalRevenue (active rows only — Decimal to string)

```typescript
// _sum on Decimal field returns Prisma.Decimal | null
const revenueResult = await prisma.sale.aggregate({
  _sum: { priceSnapshot: true },
  where: {
    organizationId,
    status: 'active',
  },
});
// .toFixed(2) converts Prisma.Decimal to "NNNN.NN" string — never .toNumber()
const totalRevenue = (revenueResult._sum.priceSnapshot ?? 0).toFixed(2);
```

**Critical:** `_sum.priceSnapshot` is typed as `Prisma.Decimal | null`. Call `.toFixed(2)` directly on it (Prisma.Decimal inherits this method). Fallback to `0` when null (no active sales). [CITED: prisma.io docs, pattern matches existing `serializeSale` in sales.ts]

### productBreakdown and mopBreakdown

```typescript
// Product breakdown — groupBy productNameSnapshot (snapshot, not join — Rule 4)
const productBreakdown = await prisma.sale.groupBy({
  by: ['productNameSnapshot'],
  _count: { _all: true },
  _sum: { priceSnapshot: true },
  where: {
    organizationId,
    status: { in: ['active', 'void'] },
  },
  orderBy: { _count: { productNameSnapshot: 'desc' } },
});

// Shape result for frontend
const productBreakdownFormatted = productBreakdown.map((row) => ({
  name: row.productNameSnapshot,
  count: row._count._all,
  revenue: (row._sum.priceSnapshot ?? 0).toFixed(2),
}));

// MOP breakdown — groupBy mopNameSnapshot (snapshot — Rule 4)
const mopBreakdown = await prisma.sale.groupBy({
  by: ['mopNameSnapshot'],
  _count: { _all: true },
  where: {
    organizationId,
    status: { in: ['active', 'void'] },
  },
  orderBy: { _count: { mopNameSnapshot: 'desc' } },
});
```

### trendData — DATE grouping requires $queryRaw

**Critical pitfall:** Prisma `groupBy` cannot group by a date expression like `DATE(createdAt)`. It can only group by actual model fields, which are full `DateTime` values — not truncated to day. Grouping by `createdAt` directly would give one group per unique timestamp (useless). [CITED: github.com/prisma/prisma/discussions/11692, github.com/prisma/prisma/issues/6653]

**Correct approach — raw query for date grouping:**

```typescript
// $queryRaw with MySQL DATE() function
// Returns: Array<{ date: Date | string; count: bigint }>
const rawTrend = await prisma.$queryRaw<
  { date: string; count: bigint }[]
>`
  SELECT
    DATE(createdAt) AS date,
    COUNT(*) AS count
  FROM sales
  WHERE organizationId = ${organizationId}
    AND status IN ('active', 'void')
  GROUP BY DATE(createdAt)
  ORDER BY date ASC
`;

// count is BigInt from MySQL COUNT(*) — convert to number
const trendData = rawTrend.map((row) => ({
  date: typeof row.date === 'string' ? row.date : row.date.toISOString().slice(0, 10),
  count: Number(row.count),
}));
```

**BigInt note:** MySQL `COUNT(*)` returns `BIGINT`. Prisma `$queryRaw` maps this to JavaScript `bigint`. Must call `Number()` before sending to JSON — `JSON.stringify` does not serialize BigInt. For small-to-medium datasets (internal tool), `Number(bigint)` is safe (stays below 2^53-1). [VERIFIED pattern: same as serializeAuditEntry in sales.ts which converts BigInt id]

**Alternative (JS grouping):** If raw SQL is undesirable, fetch all rows with their `createdAt` and group by date string in JavaScript. This is simpler code and fine for small datasets, but it pulls more data per request than the raw query. Given the summary endpoint is admin-only and datasets are small (internal tool), either is acceptable. The raw query is preferred as it avoids pulling all row data into the summary handler.

---

## Pattern 4: Client-Side Filtering

**What:** In-memory filter applied to the `sales` React Query result before rendering.

```typescript
// FilterState type (D-06)
interface FilterState {
  startDate: string | null;
  endDate: string | null;
  productId: number | null;
  mopId: number | null;
  createdById: number | null;
}

// Apply all active filters
function applyFilters(sales: Sale[], filters: FilterState): Sale[] {
  return sales.filter((sale) => {
    // Date range filter — compare ISO strings (lexicographic sort works for ISO-8601 dates)
    if (filters.startDate && sale.createdAt < filters.startDate) return false;
    if (filters.endDate) {
      // End date is inclusive — compare against end of day
      const endDayInclusive = filters.endDate + 'T23:59:59.999Z';
      if (sale.createdAt > endDayInclusive) return false;
    }
    if (filters.productId !== null && sale.productId !== filters.productId) return false;
    if (filters.mopId !== null && sale.mopId !== filters.mopId) return false;
    if (filters.createdById !== null && sale.createdById !== filters.createdById) return false;
    return true;
  });
}
```

**Date comparison note:** `sale.createdAt` is an ISO-8601 string (e.g., `"2026-06-25T10:30:00.000Z"`) from the backend serializer. Date inputs return `"YYYY-MM-DD"` strings. Lexicographic comparison of ISO strings is correct because `"2026-06-25" < "2026-06-25T10:30:00.000Z"` holds true — the date prefix sorts before the datetime. For the end-date inclusive comparison, append `T23:59:59.999Z` to capture the full day. [ASSUMED — confirm createdAt format matches ISO serializer output; verified in serializeSale: `.toISOString()`]

---

## Pattern 5: AuditDrawer Adaptation for DashboardPage

**Current behavior:** `AuditDrawer` reads `openAuditSaleId` from `useSalesEditStore` (Zustand). It is designed to live inside SalesPage and be opened by the Zustand store action.

**For DashboardPage:** The admin table needs to open AuditDrawer per-row. Two approaches:

**Option A — Push to Zustand store (preferred, zero component changes):**
```typescript
// DashboardPage admin table — Audit button onClick
const { openAuditDrawer } = useSalesEditStore();
// In the action cell:
<button onClick={() => openAuditDrawer(row.original.id)}>Audit</button>
// Then render <AuditDrawer /> at DashboardPage level — it reads from the same store
```

**Option B — Prop-based saleId (requires AuditDrawer refactor):**
Add `saleId?: number` prop to AuditDrawer; use prop if provided, fall back to Zustand store.

**Recommendation:** Option A. Zero changes to AuditDrawer. `useSalesEditStore` is already imported everywhere and the store is a singleton. DashboardPage simply calls `openAuditDrawer(id)` and renders `<AuditDrawer />` the same way SalesPage does. [VERIFIED: AuditDrawer.tsx reads from `useSalesEditStore`; `openAuditDrawer` action must exist in salesEditStore]

---

## Pattern 6: PATCH /api/users/:id/username — New Endpoint

**Pattern follows existing usersRouter conventions exactly:**

```typescript
// In users.ts — add after the existing PATCH /:id
usersRouter.patch(
  '/:id/username',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid user ID'),
    body('username')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Username must be 2–100 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }

    const targetId = Number(req.params.id);
    const username = (req.body.username as string).trim();
    const organizationId = 1; // hard-coded until multi-tenant

    // D-21: uniqueness check excluding self (prisma $extends active override — isActive: undefined for admin targets)
    const conflict = await prisma.user.findFirst({
      where: {
        username,
        organizationId,
        NOT: { id: targetId },
        isActive: undefined, // override $extends — check ALL users, active + inactive
      },
    });
    if (conflict) {
      res.status(409).json({ error: 'USERNAME_TAKEN' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: targetId, organizationId },
      data: { username },
      select: {
        id: true, username: true, role: true,
        canEdit: true, isActive: true,
        organizationId: true, createdAt: true, updatedAt: true,
      },
    });
    res.json(updated);
  },
);
```

**Routing order note:** Express matches routes in registration order. `/:id/username` must be registered BEFORE `/:id` to avoid the `:id` param capturing `"username"` as a user ID and routing to the wrong handler. [ASSUMED — this is standard Express behavior; verify route registration order in users.ts when implementing]

---

## Pattern 7: React Query for Admin Summary

```typescript
// queryKey follows existing naming patterns in the codebase
const { data: summary, isLoading: summaryLoading } = useQuery({
  queryKey: ['admin-summary'],
  queryFn: () => api.get<AdminSummary>('/admin/summary').then((r) => r.data),
  staleTime: 5 * 60 * 1000, // 5 minutes — summary data doesn't need to be real-time
});
```

**staleTime rationale:** The summary endpoint runs Prisma aggregations on every call. A 5-minute stale time prevents hammering the endpoint on every tab switch while still giving reasonably fresh data for an admin dashboard. The filterable table uses the existing `['sales']` query which stays fresh per the existing pattern. [ASSUMED — no explicit staleTime policy in existing codebase; 5 minutes is a reasonable default for summary data]

---

## Pattern 8: UsersPage — Following ProductsPage Exactly

The UsersPage implementation is a direct blueprint copy from ProductsPage:

| ProductsPage | UsersPage |
|---|---|
| `useQuery(['products'])` | `useQuery(['users'])` |
| `pendingToggleId` (product toggle) | `pendingToggleId` (canEdit toggle) |
| `setModalTarget(product)` | `setModalTarget(user)` |
| `ProductModal` (name + price form) | `UserModal` (username form only) |
| "Add Product" button | "Invite Moderator" button |
| `toggleMutation` (active toggle) | `canEditMutation` + `resetPasswordMutation` |
| `StatusBadge active={product.isActive}` | `StatusBadge active={user.isActive}` |

**Additional actions vs ProductsPage:** UsersPage has two extra mutations (canEdit toggle, reset password). Each gets its own `pending[Action]Id` state to track per-row loading independently.

**canEdit column:** Only render the Toggle button when `user.role === 'moderator'`. For admin rows, show a dash or nothing in the actions column for canEdit. [VERIFIED: D-19 — "shown only for moderators"]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering (SVG) | Custom SVG paths | Recharts BarChart / LineChart | Axis scaling, ticks, tooltip, responsiveness are non-trivial |
| CSV serialization | String concatenation | `@json2csv/plainjs` Parser | Edge cases: embedded commas, quotes, newlines in cells; RFC 4180 quoting |
| Date-based grouping in Prisma | JS `.reduce()` on all rows | `$queryRaw` with `DATE()` | More efficient; avoids pulling all field data into summary handler |
| Decimal arithmetic in frontend | `parseFloat(sale.priceSnapshot)` | Server-side Prisma aggregation | Floating-point precision loss — CLAUDE.md Rule 6 |
| Session invalidation | Custom token blacklist | Existing `DELETE FROM sessions` SQL | Already implemented; Session store manages this correctly |

---

## Common Pitfalls

### Pitfall 1: ResponsiveContainer Collapses to Zero Height
**What goes wrong:** Chart renders as an invisible 0×0 element.
**Why it happens:** `ResponsiveContainer height="100%"` reads height from the DOM parent. If the parent is an unsized flex/grid container, it measures 0px.
**How to avoid:** Wrap the ResponsiveContainer in a `<div>` with an explicit height (Tailwind `h-64` or inline `style={{ height: 256 }}`). The `width="100%"` can be fluid, but height must be explicit.
**Warning signs:** Chart component mounts but nothing appears in the DOM despite non-empty data.

### Pitfall 2: Prisma groupBy Date Grouping Fails
**What goes wrong:** Using `groupBy({ by: ['createdAt'] })` produces one group per unique timestamp — effectively no grouping.
**Why it happens:** `createdAt` is a `DateTime` column with millisecond precision. Two rows created at different milliseconds are in different groups.
**How to avoid:** Use `$queryRaw` with `DATE(createdAt)` for day-level grouping.
**Warning signs:** trendData array has as many entries as total rows.

### Pitfall 3: BigInt from $queryRaw Not JSON-Serializable
**What goes wrong:** `res.json(trendData)` throws `TypeError: Do not know how to serialize a BigInt`.
**Why it happens:** MySQL `COUNT(*)` returns `BIGINT`; Prisma `$queryRaw` maps this to JS `bigint`. `JSON.stringify` has no BigInt handler.
**How to avoid:** Map `Number(row.count)` on every `$queryRaw` result before returning from the route handler.
**Warning signs:** 500 error on the summary endpoint with the BigInt serialization message.

### Pitfall 4: Soft-Delete Filter Not Overridden in Summary Queries
**What goes wrong:** totalCount returns only active rows; voided rows are silently excluded.
**Why it happens:** `$extends softDeleteFilter` injects `status: 'active'` as default on every `sale.findMany`, `sale.count`, and `sale.aggregate` call.
**How to avoid:** All summary queries must include `status: { in: ['active', 'void'] }` (or explicit `status: 'active'` for revenue-only). Verify `prisma.sale.count` and `prisma.sale.aggregate` are also intercepted by the `$extends` — they may not be (only `findMany` and `findFirst` are in the current extension).
**Warning signs:** totalCount does not match the row count visible in the admin table.

**Critical check:** Look at `prisma.ts` — the current `$extends` only intercepts `findMany` and `findFirst`. `count` and `aggregate` are NOT intercepted. This means `prisma.sale.count(...)` does NOT have the soft-delete filter applied automatically — but it also means you do NOT need to explicitly override it. However, to be safe and explicit (per CLAUDE.md Rule 8), always add `status: { in: ['active', 'void'] }` to make intent clear. [VERIFIED: prisma.ts $extends block only covers findMany/findFirst for sale model]

### Pitfall 5: Express Route Order — /:id/username vs /:id
**What goes wrong:** `PATCH /api/users/5/username` matches the `PATCH /:id` handler with `req.params.id = "5"` and `"/username"` appended to the path (or causes a 404).
**Why it happens:** Express evaluates routes in registration order. If `PATCH /:id` is registered before `PATCH /:id/username`, the `:id` segment captures `"5"` and `/username` is unmatched.
**How to avoid:** Register `PATCH /:id/username` BEFORE `PATCH /:id` in users.ts.
**Warning signs:** Username PATCH calls return 400 (validation: "Invalid user ID") or route to the wrong handler.

### Pitfall 6: AuditDrawer Requires salesEditStore Actions to Exist
**What goes wrong:** `useSalesEditStore().openAuditDrawer` is undefined; clicking Audit button throws.
**Why it happens:** If `openAuditDrawer` was not added to the store during Phase 3, Option A (Zustand push) won't work.
**How to avoid:** Verify `salesEditStore.ts` exports `openAuditDrawer(saleId: number)` and `closeAuditDrawer()`. If absent, add them before DashboardPage implementation.
**Warning signs:** TypeScript error on `openAuditDrawer` property at compile time.

### Pitfall 7: @json2csv/plainjs transforms vs fields Sanitization Order
**What goes wrong:** Sanitized values get double-quoted or the `'` prefix is escaped by the CSV serializer.
**Why it happens:** If sanitization runs on the raw value and the CSV serializer wraps the result in quotes, the `'` may appear inside a quoted cell — `"'=CMD"`. This is still safe (injection only works outside quotes) but looks odd.
**How to avoid:** Use `transforms` (pre-processing applied before field extraction) rather than `formatters` (post-processing). The `transforms` option receives the full row object and returns a transformed row — sanitize values here before the Parser writes them to CSV. The `fields[].value` function approach (a getter function) is an alternative: apply sanitization inside the value getter. Both work.
**Warning signs:** CSV opens with visible `'` in cells that didn't start with injection characters, or injection characters are not prefixed.

---

## Code Examples

### Summary Endpoint — Full Route Handler Pattern

```typescript
// packages/backend/src/routes/admin.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/requireRole.js';

export const adminRouter = Router();
adminRouter.use(requireRole('admin'));

adminRouter.get('/summary', async (req, res) => {
  const organizationId = req.session.organizationId!;

  // Note: prisma.sale.count and prisma.sale.aggregate are NOT intercepted by $extends softDeleteFilter
  // (only findMany/findFirst are). Add explicit status filter for clarity (CLAUDE.md Rule 8).
  const [totalCount, revenueResult, productBreakdown, mopBreakdown, rawTrend] =
    await Promise.all([
      prisma.sale.count({
        where: { organizationId, status: { in: ['active', 'void'] } },
      }),
      prisma.sale.aggregate({
        _sum: { priceSnapshot: true },
        where: { organizationId, status: 'active' },
      }),
      prisma.sale.groupBy({
        by: ['productNameSnapshot'],
        _count: { _all: true },
        _sum: { priceSnapshot: true },
        where: { organizationId, status: { in: ['active', 'void'] } },
        orderBy: { _count: { productNameSnapshot: 'desc' } },
      }),
      prisma.sale.groupBy({
        by: ['mopNameSnapshot'],
        _count: { _all: true },
        where: { organizationId, status: { in: ['active', 'void'] } },
        orderBy: { _count: { mopNameSnapshot: 'desc' } },
      }),
      prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE(createdAt) AS date, COUNT(*) AS count
        FROM sales
        WHERE organizationId = ${organizationId}
          AND status IN ('active', 'void')
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `,
    ]);

  res.json({
    totalCount,
    totalRevenue: (revenueResult._sum.priceSnapshot ?? 0).toFixed(2),
    trendData: rawTrend.map((r) => ({
      date: typeof r.date === 'string' ? r.date : r.date.toString().slice(0, 10),
      count: Number(r.count), // BigInt → number (safe for internal tool row counts)
    })),
    productBreakdown: productBreakdown.map((r) => ({
      name: r.productNameSnapshot,
      count: r._count._all,
      revenue: (r._sum.priceSnapshot ?? 0).toFixed(2),
    })),
    mopBreakdown: mopBreakdown.map((r) => ({
      name: r.mopNameSnapshot,
      count: r._count._all,
    })),
  });
});
```

### app.ts — Mount adminRouter

```typescript
// Add this line in app.ts protectedRouter block (after catalogRouter line)
// Source: CONTEXT.md D-22; app.ts line 97 shows existing pattern
import { adminRouter } from './routes/admin.js';
// ...
protectedRouter.use('/admin', adminRouter); // admin-only (adminRouter mounts requireRole internally)
```

### UserModal — Username Uniqueness Error Display

```typescript
// react-hook-form pattern matching ProductModal
const { register, handleSubmit, setError, formState: { errors } } = useForm<{ username: string }>({
  defaultValues: { username: user?.username ?? '' },
});

const onSubmit = async (data: { username: string }) => {
  try {
    await api.patch(`/users/${user.id}/username`, { username: data.username });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    onClose();
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 409) {
      // D-21 — inline error in modal, not page-level alert
      setError('username', { message: 'Username already taken' });
    }
  }
};
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|---|---|---|
| Recharts v2.x (2022–2023) | Recharts 3.9.0 (2024–2025) | Same component API, better TypeScript types, performance improvements. No breaking changes for BarChart/LineChart/ResponsiveContainer. |
| `json2csv` (legacy monorepo) | `@json2csv/plainjs` 7.x (scoped packages) | Scoped packages replaced legacy `json2csv` npm package. Import from `@json2csv/plainjs`, not `json2csv`. |
| Prisma `$use` middleware | Prisma `$extends` (Prisma 7) | `$use` removed in Prisma 7. Project already uses `$extends` correctly. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `withBOM` option in @json2csv/plainjs v7 may behave differently from manual BOM prepend | Pattern 2 | Low — manual BOM prepend is always correct; worst case is double-BOM if withBOM is also enabled |
| A2 | `openAuditDrawer(saleId)` action exists in salesEditStore.ts from Phase 3 | Pattern 5 | Medium — if absent, Option A requires a store edit before the component can work |
| A3 | `staleTime: 5 * 60 * 1000` is appropriate for admin summary | Pattern 7 | Low — only affects how stale summary data can be; adjustable with no architecture impact |
| A4 | `createdAt` ISO string comparison is lexicographically safe for date-range filtering | Pattern 4 | Low — ISO-8601 strings are designed to sort correctly as strings |
| A5 | MySQL `DATE(createdAt)` returns string in `YYYY-MM-DD` format via Prisma $queryRaw | Pattern 3 | Medium — if MySQL returns a Date object, the `.toString().slice(0, 10)` fallback in the map handles it |
| A6 | Recharts 3.x API is backward-compatible with v2 component names and props used here | Pattern 1 | Low — the components (BarChart, LineChart, etc.) are stable across v2→v3; verified via current docs |

---

## Open Questions

1. **salesEditStore `openAuditDrawer` action**
   - What we know: AuditDrawer reads `openAuditSaleId` from the store; `closeAuditDrawer` is confirmed in AuditDrawer.tsx
   - What's unclear: Whether `openAuditDrawer(saleId)` action exists — AuditDrawer.tsx uses `openAuditSaleId` and `closeAuditDrawer` but doesn't show how the drawer is opened
   - Recommendation: Planner should include a task to verify `salesEditStore.ts` exports `openAuditDrawer`; add it if missing

2. **InviteModal — response shape from POST /api/auth/invite-generate**
   - What we know: The endpoint exists (CONTEXT.md D-17, app.ts auth routes)
   - What's unclear: Whether the response is `{ inviteUrl: string }` or `{ token: string }` requiring frontend to construct the URL
   - Recommendation: Planner should read `auth.ts` invite-generate handler to confirm response shape before writing InviteModal

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `recharts` | ADMIN-11 charts | Not installed | — | Install via npm |
| `@json2csv/plainjs` | ADMIN-07/09 CSV export | Not installed | — | Install via npm |
| MySQL (running) | Admin summary $queryRaw | Assumed running | 8.4 | — |
| Node.js | Backend build | Yes | n/a | — |

**Missing with install step needed:**
- `recharts@3.9.0` — `npm install recharts` in `packages/frontend`
- `@json2csv/plainjs@7.0.6` — `npm install @json2csv/plainjs` in `packages/frontend`

---

## Project Constraints (from CLAUDE.md)

All constraints must be honored. Relevant constraints for Phase 4:

| Constraint | Phase 4 Implication |
|---|---|
| Rule 1: express-session over JWT | Reset password session invalidation already implemented — do not introduce any token-based auth |
| Rule 3/8: Soft-delete only + filter enforcement | All summary queries must include explicit `status: { in: [...] }` — even if `count`/`aggregate` don't auto-filter |
| Rule 4: Price snapshot | productBreakdown and mopBreakdown use `productNameSnapshot`/`mopNameSnapshot`, never join to products/mops table |
| Rule 6: DECIMAL(10,2), never Float | `_sum.priceSnapshot` → `.toFixed(2)` → returned as string. Never parseFloat on frontend for revenue display |
| Rule 9: Backend enforces RBAC | `adminRouter` mounts `requireRole('admin')` at router level. `usersRouter` already has it. No new per-route guards needed. |
| Rule 10: Pessimistic UI | canEdit toggle and reset-password buttons disabled during in-flight mutations. pendingToggleId pattern. |

---

## Sources

### Primary (HIGH confidence)
- `packages/backend/src/routes/users.ts` — existing patterns for PATCH endpoint, 409 error, requireRole at router level [VERIFIED in this session]
- `packages/backend/src/routes/sales.ts` — serializeSale pattern, status override pattern, $transaction pattern [VERIFIED]
- `packages/backend/src/lib/prisma.ts` — $extends interceptors (findMany/findFirst only — count/aggregate NOT intercepted) [VERIFIED]
- `packages/backend/prisma/schema.prisma` — Sale model field names: priceSnapshot (Decimal), productNameSnapshot, mopNameSnapshot, createdByUsername, lastEditedByUsername [VERIFIED]
- `packages/frontend/src/pages/ProductsPage.tsx` — table + modal + pendingToggleId + useQuery/useMutation pattern [VERIFIED]
- npm registry — recharts@3.9.0, @json2csv/plainjs@7.0.6 [VERIFIED: npm view]

### Secondary (MEDIUM confidence)
- [recharts.github.io API docs](https://recharts.github.io/en-US/api/LineChart) — component props for LineChart, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip [CITED]
- [github.com/juanjoDiaz/json2csv README](https://github.com/juanjoDiaz/json2csv/blob/main/packages/plainjs/README.md) — Parser constructor, fields config, transforms option [CITED]
- [prisma.io aggregation docs](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing) — groupBy, _count, _sum syntax [CITED]
- [github.com/prisma/prisma/discussions/11692](https://github.com/prisma/prisma/discussions/11692) — groupBy by date-only requires raw query [CITED]

### Tertiary (LOW confidence)
- WebSearch results confirming recharts React 18 compatibility and @json2csv/plainjs browser-compatibility claims

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing packages verified in package.json; new packages verified on npm
- Recharts API: MEDIUM — verified via official API docs; component props confirmed
- @json2csv/plainjs API: MEDIUM — README verified; v7.0.6-specific behavior of `withBOM` is ASSUMED
- Prisma groupBy patterns: HIGH — verified via official docs and matches existing codebase patterns
- Date grouping ($queryRaw): HIGH — confirmed limitation via multiple Prisma GitHub issues
- Architecture patterns: HIGH — derived directly from reading existing source files

**Research date:** 2026-06-25
**Valid until:** 2026-07-25 (stable libraries; Prisma 7 API unlikely to change within 30 days)
