---
plan: 04-02
phase: 4
title: "Frontend — install packages, StatCard, SalesFilterBar"
subsystem: frontend
tags: [admin, ui-components, recharts, csv, react-select, filtering]
completed_date: 2026-06-26
duration_minutes: 10
tasks_completed: 2
tasks_total: 2

dependency_graph:
  requires:
    - 04-01 (backend admin summary route providing aggregates consumed by DashboardPage)
  provides:
    - StatCard component with label/value display + animate-pulse loading skeleton
    - SalesFilterBar component with From/To date inputs + Product/MOP/Moderator react-select dropdowns
    - FilterState interface (startDate, endDate, productId, mopId, createdById — all nullable)
    - applyFilters function for in-memory client-side filtering of Sale[] arrays
  affects:
    - packages/frontend/package.json (recharts + @json2csv/plainjs added)
    - packages/frontend/src/components/admin/StatCard.tsx (created)
    - packages/frontend/src/components/admin/SalesFilterBar.tsx (created)

tech_stack:
  added:
    - recharts ^3.9.0 (charts library — consumed by DashboardPage in plan 04-05)
    - "@json2csv/plainjs ^7.0.6 (browser-compatible CSV export — consumed by DashboardPage in plan 04-05)"
  patterns:
    - react-select v5 with isClearable + menuPortalTarget={document.body} for dropdown overflow
    - ISO-8601 lexicographic string comparison for date filtering (safe per RESEARCH.md Pattern 4)
    - Tailwind animate-pulse skeleton for loading state

key_files:
  created:
    - packages/frontend/src/components/admin/StatCard.tsx
    - packages/frontend/src/components/admin/SalesFilterBar.tsx
  modified:
    - packages/frontend/package.json

decisions:
  - "applyFilters endDate uses T23:59:59.999Z suffix for inclusive end-of-day comparison — lexicographic ISO-8601 comparison is safe"
  - "react-select dropdowns all use menuPortalTarget={document.body} to prevent dropdown clipping in flex containers"
  - "FilterState initial state: all fields null (no filter = show all rows)"
  - "SalesFilterBar applies filters live on every control change — no Apply button per D-05"
---

# Phase 4 Plan 02: Frontend Package Install, StatCard, SalesFilterBar Summary

recharts and @json2csv/plainjs installed in packages/frontend; StatCard KPI display card and SalesFilterBar live-filter bar with FilterState interface and applyFilters helper created as admin components.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install recharts + @json2csv/plainjs | ca9c6dc | packages/frontend/package.json |
| 2 | Create StatCard.tsx and SalesFilterBar.tsx | c74b458 | packages/frontend/src/components/admin/StatCard.tsx, packages/frontend/src/components/admin/SalesFilterBar.tsx |

## What Was Built

### packages/frontend/package.json (updated)

- `recharts@^3.9.0` added to dependencies — Recharts chart library for DashboardPage LineChart and BarChart components
- `@json2csv/plainjs@^7.0.6` added to dependencies — browser-compatible CSV export (no Node.js deps) for DashboardPage filtered export

### StatCard.tsx

Single KPI display card:

- `label` prop: `text-sm font-normal text-gray-500` typography
- `value` prop: `text-2xl font-semibold text-gray-900` typography
- `loading` prop: shows `animate-pulse bg-gray-200 h-8 rounded w-24` skeleton instead of value
- Card container: `bg-white border border-gray-200 rounded-md p-6`

### SalesFilterBar.tsx

Three exports:

**`FilterState` interface (D-06):**
```typescript
export interface FilterState {
  startDate: string | null;
  endDate: string | null;
  productId: number | null;
  mopId: number | null;
  createdById: number | null;
}
```

**`applyFilters` function (D-04 client-side filtering):**
- Filters all 5 fields: startDate (>=), endDate (inclusive via `T23:59:59.999Z`), productId, mopId, createdById
- ISO-8601 string lexicographic comparison — safe per RESEARCH.md Pattern 4
- Null field = no filter applied for that field

**`SalesFilterBar` component (D-05):**
- From / To `<input type="date">` inputs — live onChange calls `onFilterChange`
- Product, MOP, Moderator react-select dropdowns — all `isClearable`, `menuPortalTarget={document.body}`
- Clear filters button resets all fields to null via `onFilterChange`
- Custom `selectStyles` matching UI-SPEC.md: h-40px, borderColor #d1d5db, fontSize 14px

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — both components are fully implemented. StatCard and SalesFilterBar are complete UI components ready for consumption by DashboardPage (04-05). They receive their data via props — no internal data fetching stubs.

## Threat Surface Scan

No new threat surface beyond what the plan's threat model covers:
- T-04-05: SalesFilterBar performs display-only client-side filtering on data already fetched by authenticated admin session
- T-04-06: recharts and @json2csv/plainjs are established npm packages (5M+ weekly downloads); no additional trust boundary introduced

## Self-Check

Files exist:
- packages/frontend/src/components/admin/StatCard.tsx — FOUND
- packages/frontend/src/components/admin/SalesFilterBar.tsx — FOUND
- packages/frontend/package.json (recharts + @json2csv/plainjs) — FOUND

Commits:
- c74b458 — FOUND (Task 2: StatCard + SalesFilterBar)
- ca9c6dc — FOUND (Task 1 package.json in worktree branch)

TypeScript compilation: zero errors (npx tsc --noEmit exits 0).

## Self-Check: PASSED
