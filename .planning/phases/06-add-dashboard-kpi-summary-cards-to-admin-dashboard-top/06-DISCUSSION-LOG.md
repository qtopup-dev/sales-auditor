# Phase 6: Add Dashboard KPI Summary Cards — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 06-add-dashboard-kpi-summary-cards-to-admin-dashboard-top
**Mode:** --auto (all areas auto-resolved with recommended defaults)
**Areas discussed:** KPI Semantics, Backend Approach, Frontend Component, Page Layout

---

## KPI Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Transactions = COUNT(active) | Count only completed (non-voided) sales per period | ✓ |
| Transactions = COUNT(active + void) | Count all rows regardless of status | |
| Profit = SUM(priceSnapshot active) | Revenue from completed sales only | ✓ |
| Profit = SUM(priceSnapshot all) | Gross revenue including voided | |
| Turnover = SUM(priceSnapshot active+void) | Gross sales volume including voided — distinct from Profit | ✓ |
| Turnover = same as Profit | Alias for revenue with no distinction | |

**User's choice:** [auto] Recommended defaults — gives each KPI distinct meaning; Transactions = active count, Profit = active revenue, Turnover = gross revenue including void.
**Notes:** KPI definitions sourced from STATE.md Roadmap Evolution note. Exact business semantics to be confirmed by user if different.

---

## Backend Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing summary endpoint | Add `kpiData` field to GET /api/admin/summary response | ✓ |
| New dedicated KPI endpoint | GET /api/admin/kpi-summary as a separate route | |

**User's choice:** [auto] Extend existing — avoids extra round-trip, consistent with existing data fetch pattern in DashboardPage.
**Notes:** 8 new `$queryRaw` queries added to the existing `Promise.all`. BigInt coercion and Decimal.toFixed(2) patterns replicated from existing queries.

---

## Frontend Component

| Option | Description | Selected |
|--------|-------------|----------|
| New KpiCard.tsx component | Dedicated component: KPI name + 2×2 grid of 4 period values | ✓ |
| Extend existing StatCard | Add optional `periods` prop to StatCard | |
| Inline in DashboardPage | No new component — render period grid inline | |

**User's choice:** [auto] New component — StatCard is a clean 1-value primitive; KpiCard has different layout concerns. Separation is the right call.
**Notes:** KpiCard visual style mirrors StatCard (bg-white, border, rounded-md, p-6) for consistency.

---

## Page Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Add KPI section above existing StatCards | 3 KPI cards at very top; existing 2 StatCards remain below | ✓ |
| Replace existing StatCards with KPI cards | Remove all-time StatCards; KPI cards only | |
| Add KPI cards below charts | New section after SalesCharts | |

**User's choice:** [auto] Add above, keep existing — "add to top" per phase goal; all-time totals provide complementary context.
**Notes:** KPI section: `grid grid-cols-3 gap-6 mb-8` above existing `grid grid-cols-2 gap-6 mb-12`.

---

## Claude's Discretion

- Exact sub-period label text (Today / Yesterday / This Month / Last Month — or abbreviated forms)
- Visual accent colors per KPI type (count vs. currency)
- 2×2 grid ordering within KpiCard
- Whether to add sparkline mini-chart in card (deferred — not required)

## Deferred Ideas

- KPI sparkline chart within each card — future enhancement
- This-week / last-week periods — not in spec
- Real-time KPI polling — v2
