---
phase: 13-moderator-sales-sheet-tip-column
plan: 02
subsystem: api
tags: [prisma, decimal, express, react-query, mysql]

# Dependency graph
requires:
  - phase: 13-moderator-sales-sheet-tip-column (plan 01)
    provides: Nullable sales.tip DECIMAL(10,2) column, Sale.tip shared type, parseTip validation
provides:
  - "activeSalesTips on GET /api/shifts/current, combined (price+tip) activeSalesRevenue on /current and /history"
  - "totalTips + combined totalRevenue on GET /api/admin/summary; product breakdown stays price-only"
  - "Tip-inclusive KPI SQL (priceSnapshot + COALESCE(tip, 0)) across all 8 Profit/Turnover period sums"
  - "activeSalesTips + Decimal-summed activeSalesRevenue + per-sale tip on GET /api/admin/shifts tabs"
  - "ShiftTotalsBanner tips prop rendering incl. PxX tips secondary line, wired on moderator sheet and admin Shifts tabs"
  - "StatCard caption prop, wired to totalTips on the dashboard Total Revenue card"
  - "Tip column on AdminShiftsPage per-shift sale list, right after Price"
affects: [13-03-admin-tables]

# Actuals (#2632)
actuals:
  tokens: 4932
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Decimal accumulator loop replaces JS float accumulator for multi-shift-session sums (admin.ts tab loop): let x = new Prisma.Decimal(0); x = x.add(...)"
    - "Secondary caption line pattern (incl. PxX tips) shared between ShiftTotalsBanner and StatCard — both use the same addThousandsSep-style string-regex formatting, hidden when the value is '0.00'"

key-files:
  created: []
  modified:
    - packages/backend/src/routes/shifts.ts
    - packages/backend/src/routes/admin.ts
    - packages/frontend/src/components/shift/ShiftTotalsBanner.tsx
    - packages/frontend/src/pages/SalesPage.tsx
    - packages/frontend/src/pages/AdminShiftsPage.tsx
    - packages/frontend/src/components/admin/StatCard.tsx
    - packages/frontend/src/pages/DashboardPage.tsx

key-decisions:
  - "Combined revenue computed via Prisma.Decimal.add() at the JS layer (shifts.ts, admin.ts summary/shifts) and via SQL priceSnapshot + COALESCE(tip, 0) at the raw-SQL KPI layer (admin.ts) — both Decimal-safe per CLAUDE.md Rule 6, matching the plan's Claude's Discretion note"
  - "activeSalesTips/totalTips secondary sums returned alongside the combined total specifically so the frontend never has to subtract or parse floats to derive the tips-only caption"
  - "Product breakdown groupBy (admin.ts) intentionally left untouched — D-02 keeps it price-only even though every other revenue site changed"

patterns-established:
  - "incl. PxX {label} secondary-line convention for any StatCard/ShiftTotalsBanner-style figure that has a sub-component worth calling out — hidden at zero, reuses the parent's thousands-separator helper"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-06, D-16, D-19, D-21]

coverage:
  - id: D1
    description: "Every active-row revenue figure (Revenue This Shift, moderator Shift History, admin Shifts tabs, dashboard Total Revenue, Profit/Turnover KPIs) equals SUM(priceSnapshot + tip), computed via Prisma.Decimal.add() or SQL COALESCE — never JS float"
    verification:
      - kind: e2e
        ref: "13-02-PLAN.md Task 1 <verify> automated e2e block — REVENUE OK (tip 15 raises totalTips by exactly 15.00 and totalRevenue by exactly price+15.00)"
        status: pass
      - kind: other
        ref: "Static gate: grep -c 'priceSnapshot + COALESCE(tip, 0)' admin.ts == 8, grep -c 'THEN priceSnapshot ELSE' == 0, grep -c 'Number(agg' == 0 — STATIC OK"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dashboard per-product revenue breakdown stays SUM(priceSnapshot) only, no tip"
    verification:
      - kind: other
        ref: "Static gate: grep -A4 \"by: ['productNameSnapshot']\" admin.ts | grep -c tip == 0 — STATIC OK"
        status: pass
    human_judgment: false
  - id: D3
    description: "Voided rows contribute neither price nor tip to any revenue figure — existing status:'active' filters unchanged"
    verification:
      - kind: e2e
        ref: "13-02-PLAN.md Task 1 <verify> e2e block — voiding the test sale returns totalTips/totalRevenue to their exact pre-create baseline"
        status: pass
    human_judgment: false
  - id: D4
    description: "Revenue This Shift banner (moderator sheet + every admin Shifts tab) shows the combined total plus an incl. PxX tips line fed by activeSalesTips, hidden at 0.00"
    verification: []
    human_judgment: true
    rationale: "Visual rendering of the secondary caption line (font size, hide-at-zero behavior, placement under the main figure) is best confirmed by a human looking at the running Sales sheet and admin Shifts tabs rather than inferred from a curl-based e2e check."
  - id: D5
    description: "Dashboard Total Revenue card shows an incl. PxX tips caption from totalTips; Profit/Turnover KPI cards and Shift History Revenue column show the combined number only, no caption"
    verification: []
    human_judgment: true
    rationale: "Caption visibility on one specific StatCard vs its absence on KPI cards is a visual layout check best confirmed by a human on the running dashboard."
  - id: D6
    description: "AdminShiftsPage per-shift sale list has a right-aligned Tip column after Price, empty when there is no tip"
    verification:
      - kind: other
        ref: "Static gate: grep -n '>Price</th>|>Tip</th>|>MOP</th>' AdminShiftsPage.tsx shows strictly increasing line order — UI OK"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-09-23
status: complete
---

# Phase 13 Plan 02: Shift and Dashboard Revenue Totals Summary

**Every active-row revenue figure (shift banners, admin Shifts tabs, dashboard Total Revenue, Profit/Turnover KPIs) now includes tips via Decimal-safe math, with a separate `incl. ₱X tips` caption and a Tip column on the admin per-shift sale list**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 7

## Accomplishments
- `shifts.ts` `/current` and `/history` now return `activeSalesRevenue` as price+tip (Prisma.Decimal `.add()`), with `/current` also returning a separate `activeSalesTips` sum
- `admin.ts` `/summary` returns combined `totalRevenue` and a new `totalTips` string; the per-product breakdown groupBy is untouched (stays price-only per D-02)
- All 8 Profit/Turnover KPI raw-SQL sums (4 periods × 2 columns) changed from `priceSnapshot` to `priceSnapshot + COALESCE(tip, 0)`, keeping the existing `status = 'active'`/`'active','void'` guards verbatim
- `admin.ts` `/shifts` per-shift tab aggregation replaced its JS float accumulator (`Number(agg._sum...)`) with two `Prisma.Decimal` accumulators (`activeRevenue`, `activeTips`), and each serialized sale now carries `tip: string | null`
- `ShiftTotalsBanner` gained an optional `tips?: string` prop rendering an `incl. ₱X tips` secondary line (hidden at `'0.00'`), wired on the moderator Sales sheet (`SalesPage.tsx`) and every admin Shifts tab (`AdminShiftsPage.tsx`)
- `StatCard` gained an optional `caption?: string` prop, wired only to the dashboard's Total Revenue card via a `totalTips`-derived `tipsCaption` — Profit/Turnover KPI cards and Shift History stay caption-free (D-06)
- `AdminShiftsPage.tsx` per-shift sale table gained a right-aligned Tip column between Price and MOP, rendering an empty cell when `sale.tip` is `null`
- Verified end-to-end against the dev API on :3001: the revenue e2e (`REVENUE OK`) confirmed a 15.00 tip raises `totalTips`/`totalRevenue` by the exact expected deltas and voiding restores both to baseline; static grep gates for both tasks (`STATIC OK`, `UI OK`) and `tsc --noEmit` passed for both packages

## Task Commits

Each task was committed atomically:

1. **Task 1: Every revenue figure includes tips (shifts + admin endpoints), Decimal-safe** - `39d7289` (feat)
2. **Task 2: `incl. ₱X tips` captions + admin shift Tip column** - `9510fe7` (feat)

## Files Created/Modified
- `packages/backend/src/routes/shifts.ts` - `/current` and `/history` aggregate `tip` alongside `priceSnapshot`; combined revenue via `Prisma.Decimal.add()`; `/current` adds `activeSalesTips`
- `packages/backend/src/routes/admin.ts` - `/summary` adds `totalTips` + combined `totalRevenue`; 8 KPI raw-SQL sums add `+ COALESCE(tip, 0)`; `/shifts` tab loop replaces float accumulator with Decimal accumulators and adds `tip` to `serializeSaleForAdminShifts`
- `packages/frontend/src/components/shift/ShiftTotalsBanner.tsx` - optional `tips?: string` prop, secondary `incl. ₱X tips` line hidden at `'0.00'`
- `packages/frontend/src/pages/SalesPage.tsx` - `CurrentShiftWithTotals.activeSalesTips`, passed to `ShiftTotalsBanner`
- `packages/frontend/src/pages/AdminShiftsPage.tsx` - `AdminShiftTab.activeSalesTips`, `AdminShiftSaleRow.tip`, `tips` prop on banner, Tip `<th>`/`<td>` after Price
- `packages/frontend/src/components/admin/StatCard.tsx` - optional `caption?: string` prop rendered under the value
- `packages/frontend/src/pages/DashboardPage.tsx` - `AdminSummary.totalTips`, derived `tipsCaption`, passed only to the Total Revenue `StatCard`

## Decisions Made
- Combined revenue is computed via `Prisma.Decimal.add()` at the JS aggregate layer (`shifts.ts`, `admin.ts` summary/shifts) and via SQL `priceSnapshot + COALESCE(tip, 0)` at the raw-SQL KPI layer — both Decimal-safe (CLAUDE.md Rule 6), matching the plan's "Claude's Discretion" note that either approach was acceptable
- `activeSalesTips`/`totalTips` are returned as separate fields alongside the combined total specifically so the frontend never subtracts or parses floats to derive the tips-only caption — pure string pass-through end to end
- Product breakdown groupBy in `admin.ts` was intentionally left untouched per D-02, even though every other revenue aggregate in the file changed

## Deviations from Plan

### Auto-fixed Issues

None - both tasks matched the plan's `<action>` steps exactly.

### Note on a pre-existing grep false-positive

The plan's Task 2 acceptance criteria expects `grep -c 'parseFloat\|Number(' ShiftTotalsBanner.tsx` to return `0`. It returns `1` — but the single match is a pre-existing code comment already in the file before this plan (`// Pure string concat — NEVER parseFloat/Number() (CLAUDE.md Rule 6)`), not an actual `parseFloat`/`Number()` call. No JS float arithmetic exists in the file; this is a grep-gate false positive against documentation text, not a Rule 6 violation. Not treated as a deviation requiring a fix.

## Issues Encountered

None. The user's dev server (API :3001 via `tsx --watch`) was already running at task start; confirmed it picked up the backend changes (via `totalTips` appearing in a live `/admin/summary` response) before running the e2e verification block. No second dev instance was started.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All backend revenue endpoints and frontend caption/column wiring for tips are complete; `13-03-admin-tables` (which touches `AdminSalesTable.tsx` and `VoidRequestsTable.tsx`) can proceed independently — no shared files with this plan
- Two coverage items (D4, D5) are marked `human_judgment: true` for visual confirmation of the caption rendering on the running app (banner secondary line placement, StatCard caption presence/absence) — recommended for `/gsd-verify-work`
- No blockers identified

---
*Phase: 13-moderator-sales-sheet-tip-column*
*Completed: 2026-09-23*

## Self-Check: PASSED
