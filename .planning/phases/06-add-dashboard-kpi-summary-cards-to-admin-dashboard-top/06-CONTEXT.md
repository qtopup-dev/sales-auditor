# Phase 6: Add Dashboard KPI Summary Cards — Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Adds 3 time-period KPI summary cards (Transactions, Profit, Turnover) to the very top of the admin DashboardPage. Each card shows 4 time-period values: Today / Yesterday / This Month / Last Month. No schema changes — all data derived from the existing `sales` table by date filtering in UTC.

Delivers: extended `GET /api/admin/summary` backend response + new `KpiCard.tsx` frontend component + updated DashboardPage layout.

</domain>

<decisions>
## Implementation Decisions

### KPI Semantics (what each metric measures)
- **D-01:** **Transactions** = COUNT of active sales rows for the time period. Active only — voided rows are not counted as completed transactions.
  - [auto] Selected: count active-only — voided rows are corrective entries, not completed transactions.
- **D-02:** **Profit** = SUM of `priceSnapshot` WHERE `status = 'active'` for the time period. Revenue from completed (non-voided) sales.
  - [auto] Selected: active rows only — consistent with how `totalRevenue` is computed in the existing summary endpoint.
- **D-03:** **Turnover** = SUM of `priceSnapshot` WHERE `status IN ('active', 'void')` for the time period. Gross sales including voided entries — gives a distinct meaning from Profit.
  - [auto] Selected: active + void — this is the only way Turnover differs meaningfully from Profit; shows gross volume before corrections.

### Time Period Definitions (UTC — CLAUDE.md Rule 7)
- **D-04:** All four time periods are computed server-side using MySQL UTC date math:
  - **Today**: `DATE(CONVERT_TZ(createdAt, '+00:00', '+00:00'))` = CURDATE()
  - **Yesterday**: = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
  - **This Month**: createdAt >= first day of current calendar month (YEAR/MONTH of CURDATE())
  - **Last Month**: createdAt in previous calendar month
  - Use `$queryRaw` — same pattern as existing trendData query. All MySQL date functions operate on UTC values since the DB connection is configured `?timezone=UTC`.
  - [auto] Recommended: $queryRaw is already the proven pattern for date expressions; Prisma groupBy cannot group by expressions.

### Backend Approach
- **D-05:** Extend existing `GET /api/admin/summary` endpoint (`packages/backend/src/routes/admin.ts`) with a new `kpiData` field. No new route or file needed.
  - Response shape addition:
    ```json
    {
      "kpiData": {
        "transactions": { "today": 5, "yesterday": 8, "thisMonth": 42, "lastMonth": 61 },
        "profit":       { "today": "1250.00", "yesterday": "2000.00", "thisMonth": "12500.00", "lastMonth": "18300.00" },
        "turnover":     { "today": "1500.00", "yesterday": "2300.00", "thisMonth": "15000.00", "lastMonth": "21000.00" }
      }
    }
    ```
  - Add new `$queryRaw` queries to the existing `Promise.all` block — 8 new queries (count and sum per period, grouped by time window, per organizationId). All monetary values returned as strings (CLAUDE.md Rule 6 — Decimal.toFixed(2)).
  - [auto] Selected: extend existing endpoint — avoids extra fetch; planner keeps the existing parallel query structure.

### Frontend Component
- **D-06:** New `KpiCard.tsx` component at `packages/frontend/src/components/admin/KpiCard.tsx`.
  - Props: `label: string`, `periods: { today, yesterday, thisMonth, lastMonth }` (string for money, number for counts), `loading?: boolean`, `isCurrency?: boolean` (to prepend ₱ symbol).
  - Layout: card header (label, same style as StatCard's gray-500 text), then 2×2 grid inside — Today / Yesterday / This Month / Last Month, each as a sub-label + value pair.
  - Visual style: matches existing StatCard pattern (bg-white, border border-gray-200, rounded-md, p-6). Sub-period labels in text-xs text-gray-400; values in text-lg font-semibold text-gray-900.
  - Loading state: animate-pulse skeleton per value slot (4 skeletons).
  - [auto] Selected: new component — StatCard is 1-value and should stay reusable; KpiCard is a distinct 4-value layout.

### Page Layout
- **D-07:** New KPI section goes at the VERY TOP of DashboardPage, ABOVE the existing 2 StatCards.
  - Layout: 3 KPI cards in a single row (`grid grid-cols-3 gap-6 mb-8`) — Transactions | Profit | Turnover.
  - Existing 2 StatCards (Total Sales, Total Revenue) remain below the KPI section — they provide all-time totals which complement the period-specific KPIs.
  - The KPI section uses the same `admin-summary` query key — no new React Query key; data comes from the same `useQuery(['admin-summary'])` call, now with `kpiData` included.
  - [auto] Selected: add above, keep existing — "add to top" not "replace"; all-time totals are still useful dashboard context.

### Claude's Discretion
- Exact sub-period label text ("Today" / "Yesterday" / "This Month" / "Last Month" — or abbreviated)
- Whether Transactions card uses a different accent color (e.g., blue for count vs. green for currency) to visually distinguish metric types
- Exact 2×2 grid order (Today top-left, Yesterday top-right, This Month bottom-left, Last Month bottom-right — or a 1×4 row within the card)
- Whether to add a Recharts sparkline to each KPI card (scope risk — keep as discretion, not required)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture — non-negotiable locked decisions
- `CLAUDE.md` §Critical Architecture Rules — Rule 6 (DECIMAL money → string, never float), Rule 7 (UTC everywhere — MySQL, Prisma connection, Node process), Rule 8 (soft-delete filter — override explicitly in date-windowed queries).

### Phase 6 goal and KPI specification
- `.planning/STATE.md` §Roadmap Evolution — "Phase 6 added: Transactions, Profit, Turnover each showing yesterday's, today's, last month's, and this month's values" — authoritative KPI list.

### Existing backend to extend (DO NOT replace — extend only)
- `packages/backend/src/routes/admin.ts` — Full file. Phase 6 adds 8 new `$queryRaw` queries to the existing `Promise.all` and a `kpiData` field to the `res.json` response. Do not restructure existing queries.

### Existing frontend to extend
- `packages/frontend/src/pages/DashboardPage.tsx` — Full file. Phase 6 adds KPI section above the existing StatCard grid. `AdminSummary` interface must be extended with `kpiData` field. `useQuery(['admin-summary'])` is reused.
- `packages/frontend/src/components/admin/StatCard.tsx` — Reference for visual style that `KpiCard.tsx` must match.

### Prisma/MySQL date query pattern (precedent)
- `packages/backend/src/routes/admin.ts` — `rawTrend` $queryRaw block (lines 57–64). Date-filtered queries follow this same pattern: $queryRaw with inline organizationId binding, DATE() expressions, BigInt coercion via Number().

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StatCard.tsx` — Visual reference for `KpiCard.tsx`. Same card shell (bg-white, border, rounded-md, p-6); KpiCard extends the pattern to 4 values.
- `useQuery(['admin-summary'])` in `DashboardPage.tsx` — Already fetches summary; just extend the response shape and consume `kpiData`.
- `AdminSummary` interface in `DashboardPage.tsx` (lines 18–24) — Extend with `kpiData: { transactions: KpiPeriods, profit: KpiPeriods, turnover: KpiPeriods }`.
- Existing `Promise.all` in `admin.ts` — Add new queries to this array; no structural change needed.

### Established Patterns
- Server-side Decimal math: `(value ?? 0).toFixed(2)` for all monetary aggregates — Prisma's `_sum` returns Decimal; `.toFixed(2)` produces string. Replicate exactly.
- BigInt coercion: MySQL COUNT(*) returns bigint; `Number(r.count)` before JSON serialization — same applies to any new COUNT queries.
- UTC date queries via `$queryRaw`: use DATE() and DATE_SUB(CURDATE(), INTERVAL N DAY) — proven in trendData query.

### Integration Points
- `DashboardPage.tsx` line 105: existing StatCard grid — new KPI grid goes ABOVE this block.
- `DashboardPage.tsx` line 40: `useQuery<AdminSummary>` — `AdminSummary` interface needs `kpiData` field; no new query needed.
- `admin.ts` line 29: `Promise.all([...])` — add new queries here.
- `admin.ts` line 67: `res.json({...})` — add `kpiData` key here.

</code_context>

<specifics>
## Specific Ideas

- KPI card sub-period values should show ₱ prefix for Profit and Turnover (isCurrency flag on KpiCard).
- Transactions card shows integer counts; no currency formatting needed.
- "This Month" means current calendar month from the 1st day through today, not a rolling 30-day window. Same for "Last Month" = previous complete calendar month.
- The note from STATE.md lists the time periods in order: "yesterday's, today's, last month's, and this month's" — the UI may reorder these more intuitively (e.g., Today first, then Yesterday, then This Month, then Last Month).
- No separate staleTime change needed — 5-minute cache on admin-summary is appropriate for KPI data too.

</specifics>

<deferred>
## Deferred Ideas

- KPI sparkline chart embedded in each card — out of scope for this phase; keep as future enhancement.
- This-week / last-week time periods — not in the specified KPI set; add in a future phase if needed.
- Real-time KPI refresh (e.g., polling every 60s) — v2; 5-minute staleTime is sufficient for v1 internal tool.

</deferred>

---

*Phase: 06-add-dashboard-kpi-summary-cards-to-admin-dashboard-top*
*Context gathered: 2026-07-01*
