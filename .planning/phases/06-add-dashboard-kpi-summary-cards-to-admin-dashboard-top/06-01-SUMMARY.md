---
phase: 06-add-dashboard-kpi-summary-cards-to-admin-dashboard-top
plan: "01"
subsystem: api
tags: [prisma, mysql, express, queryRaw, kpi, dashboard, decimal]

# Dependency graph
requires:
  - phase: 05-receiver-catalog
    provides: sales table with priceSnapshot, receiverId FK, receiverNameSnapshot — all columns queried in new KPI queries
provides:
  - GET /api/admin/summary response extended with kpiData field (transactions/profit/turnover per 4 periods)
  - toMoneyStr helper function for $queryRaw DECIMAL-to-string coercion
affects: [06-02-frontend-kpi-cards]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "toMoneyStr duck-type helper: handles Prisma.Decimal (.toFixed exists) and raw string/number SUM results uniformly"
    - "$queryRaw typed as [{ profitSum: unknown; turnoverSum: unknown }] — unknown used because mysql2 driver version determines whether DECIMAL returns Prisma.Decimal or string"
    - "All KPI date windows use server-side MySQL UTC functions (CURDATE, DATE_SUB, YEAR, MONTH) — never client clock"
    - "Status filter explicit on every $queryRaw — Prisma middleware does not intercept raw queries (Rule 8)"

key-files:
  created: []
  modified:
    - packages/backend/src/routes/admin.ts

key-decisions:
  - "toMoneyStr uses duck-type check on .toFixed rather than instanceof Prisma.Decimal — handles both mysql2 driver v2 (returns Decimal) and v3+ (may return string)"
  - "Profit uses active-only SUM via CASE WHEN inside same query as turnover — 4 queries instead of 8; single round-trip per period"
  - "BigInt coercion with Number() — COUNT(*) from $queryRaw returns bigint which JSON.stringify cannot serialize natively"

patterns-established:
  - "Promise.all expansion pattern: new queries appended after existing ones, destructuring expanded with new variable names on separate line"
  - "organizationId always from req.session — never from request body or query params (T-06-02 pattern)"

requirements-completed:
  - PHASE6-SC3

# Metrics
duration: 8min
completed: 2026-07-01
---

# Phase 6 Plan 01: Backend KPI Summary Endpoint Summary

**Extended GET /api/admin/summary with 8 date-filtered $queryRaw queries returning kpiData.transactions (numbers) and kpiData.profit/turnover (decimal strings) for Today/Yesterday/This Month/Last Month**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-01T08:52:00Z
- **Completed:** 2026-07-01T09:00:19Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added 8 $queryRaw queries to the existing Promise.all block (4 COUNT active-only for transactions, 4 SUM via CASE WHEN for profit+turnover per period)
- Introduced toMoneyStr helper that handles Prisma.Decimal and raw string/number SUM results uniformly — returns '0.00' for NULL (empty periods)
- Extended res.json with kpiData object containing transactions (numbers), profit (strings), and turnover (strings) sub-objects
- All organizationId references come from req.session (T-06-02 mitigated); all date math uses MySQL UTC functions (Rule 7)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend admin.ts — add 8 KPI queries and kpiData response field** - `6e57809` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `packages/backend/src/routes/admin.ts` - Promise.all expanded from 5 to 13 queries; toMoneyStr helper added; kpiData response field added

## Decisions Made
- Used `unknown` type for profitSum/turnoverSum in $queryRaw generic — mysql2 driver version determines whether DECIMAL returns Prisma.Decimal or plain string; duck-type check on `.toFixed` presence handles both cases safely
- Combined profit + turnover into a single query per period via CASE WHEN — avoids 4 extra round-trips; turnover SUM covers active+void, profit SUM covers active-only

## Deviations from Plan

None — plan executed exactly as written.

**Pre-existing issue documented (out of scope):** Two TypeScript configuration errors exist in packages/backend/tsconfig.json before this plan's changes:
- TS5110: `module: "ESNext"` incompatible with `moduleResolution: "Node16"` (TypeScript 5.5+ now enforces this pairing)
- TS6059: `prisma/seed.ts` outside `rootDir: "src"` (include pattern conflict)

These errors were confirmed present before any edits via git stash verification. They do not affect runtime behaviour (tsx bypasses tsc compilation). Logged as deferred items — fix in a future maintenance plan.

## Issues Encountered
- Plan acceptance criteria stated `grep "kpiData"` should return "at least 4 lines" and `grep "txToday|..."` should return "8 matches". Both counts were lower (1 and 5 respectively) because all 4 tx* variables appear on a single destructuring line and kpiData appears only as the object key. Functional implementation is correct per the plan's action spec — the grep counts were written assuming multi-line formatting. TypeScript compilation confirmed no errors in admin.ts itself.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- GET /api/admin/summary now returns `kpiData` with the correct structure and types
- Plan 02 (frontend KpiCard component + DashboardPage update) can consume `AdminSummary.kpiData` directly
- No schema changes, no new routes, no new dependencies required

---
*Phase: 06-add-dashboard-kpi-summary-cards-to-admin-dashboard-top*
*Completed: 2026-07-01*
