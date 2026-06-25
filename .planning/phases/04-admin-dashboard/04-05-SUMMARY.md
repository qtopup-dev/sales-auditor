---
plan: 04-05
phase: 4
title: "Frontend — DashboardPage full implementation"
subsystem: frontend
tags: [admin, dashboard, stats, charts, filtering, csv-export, void, audit]
completed_date: 2026-06-26
duration_minutes: 8
tasks_completed: 1
tasks_total: 1

dependency_graph:
  requires:
    - 04-01 (GET /api/admin/summary backend endpoint providing AdminSummary aggregates)
    - 04-02 (StatCard, SalesFilterBar, FilterState interface, applyFilters function)
    - 04-03 (SalesCharts, AdminSalesTable, downloadCSV function)
  provides:
    - DashboardPage: full admin hub covering ADMIN-01 through ADMIN-12
    - Stats banner: two StatCards for totalCount and totalRevenue (string, no float)
    - Three Recharts charts via SalesCharts (not affected by filter state per D-09)
    - Live client-side filter via SalesFilterBar + applyFilters in useMemo
    - AdminSalesTable receiving filteredRows; CSV export via downloadCSV(filteredRows)
    - AuditDrawer and VoidConfirmDialog rendered at page level (opened via Zustand)
  affects:
    - packages/frontend/src/pages/DashboardPage.tsx (replaced placeholder with full implementation)
    - packages/frontend/src/components/sales/VoidConfirmDialog.tsx (add admin-summary invalidation)

tech_stack:
  added: []
  patterns:
    - useQuery x5 (admin-summary, sales, products, mops, users) — all with queryKey arrays
    - useMemo for applyFilters(sales, filters) — filtered rows drive table + CSV
    - FilterState (5 nullable fields) via useState, passed to SalesFilterBar
    - VoidConfirmDialog Zustand pattern — openVoidDialog(id) opens; component handles API call
    - AdminSummary inline interface for typing admin-summary query response

key_files:
  created: []
  modified:
    - packages/frontend/src/pages/DashboardPage.tsx
    - packages/frontend/src/components/sales/VoidConfirmDialog.tsx

decisions:
  - "VoidConfirmDialog has no onConfirm prop — it manages void mutation internally; DashboardPage calls openVoidDialog(saleId) and VoidConfirmDialog handles the rest"
  - "admin-summary invalidation added to VoidConfirmDialog.onSuccess — safe no-op on SalesPage (no active observer = no network request); immediately refreshes stats on DashboardPage after void"
  - "Used User type from @alejinput/shared (has id + username) instead of local UserOption interface — no need for duplicate type declaration"
  - "revenueValue computed as local const to avoid invalid JSX comment in attribute position — string concat only per CLAUDE.md Rule 6"
  - "D-09 enforced: summary + charts use separate admin-summary query; only filteredRows (from applyFilters) drives AdminSalesTable and downloadCSV"
---

# Phase 4 Plan 05: Frontend DashboardPage Full Implementation Summary

DashboardPage.tsx replaced with full admin hub: stats banner (totalCount + totalRevenue via GET /api/admin/summary), three Recharts charts, SalesFilterBar live-filtering AdminSalesTable, CSV export from filtered rows, and AuditDrawer + VoidConfirmDialog at page level — completing ADMIN-01 through ADMIN-12.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Replace DashboardPage.tsx placeholder with full admin hub | d32dfdd | packages/frontend/src/pages/DashboardPage.tsx, packages/frontend/src/components/sales/VoidConfirmDialog.tsx |

## What Was Built

### DashboardPage.tsx (replaced)

The placeholder ("Dashboard coming in a future update.") was replaced with the complete admin hub:

**Page structure** (top to bottom):
- Page header: `flex items-center justify-between mb-6` with "Dashboard" h1 and "Export CSV" button
- Stats banner: `grid grid-cols-2 gap-6 mb-12` with two StatCard components
- SalesCharts: three Recharts charts (trend + product + MOP breakdown)
- SalesFilterBar: always-visible live filter (no Apply button)
- AdminSalesTable: read-only all-sales table receiving filteredRows
- AuditDrawer: rendered at page level, opened via `useSalesEditStore().openAuditDrawer(id)`
- VoidConfirmDialog: rendered at page level, opened via `openVoidDialog(saleId)`

**Queries:**
- `['admin-summary']` — AdminSummary aggregates from GET /api/admin/summary; staleTime 5 min; NOT affected by filter state (D-09)
- `['sales']` — all Sale rows; passed through `applyFilters(sales, filters)` to get `filteredRows`
- `['products']`, `['mops']`, `['users']` — catalog data for filter bar dropdowns

**D-09 compliance:** `summary` and `loading` from `admin-summary` query drive StatCard and SalesCharts; `filteredRows` (client-side filtered `sales`) drives AdminSalesTable and `downloadCSV(filteredRows)`. The two data paths are fully independent.

**CLAUDE.md Rule 6 compliance:** `totalRevenue` is concatenated as `'₱' + summary.totalRevenue` (pure string concat); no `parseFloat` anywhere in the file.

### VoidConfirmDialog.tsx (bug fix)

Added `queryClient.invalidateQueries({ queryKey: ['admin-summary'] })` to `onSuccess` callback alongside the existing `['sales']` invalidation. This ensures the stats banner and charts refresh immediately after an admin voids a row from DashboardPage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] VoidConfirmDialog missing admin-summary invalidation**
- **Found during:** Task 1 — reading VoidConfirmDialog.tsx before implementing DashboardPage
- **Issue:** VoidConfirmDialog handles its own void mutation and invalidates `['sales']`, but NOT `['admin-summary']`. The plan's success criteria requires "success invalidates sales + admin-summary queries". Without this fix, the stats banner and charts would show stale data for up to 5 minutes after a void.
- **Fix:** Added `queryClient.invalidateQueries({ queryKey: ['admin-summary'] })` to VoidConfirmDialog's `onSuccess` callback. This is a no-op on SalesPage (no active observer for admin-summary = no network request fired); on DashboardPage it triggers an immediate refetch.
- **Files modified:** packages/frontend/src/components/sales/VoidConfirmDialog.tsx
- **Commit:** d32dfdd (included in Task 1 commit)

**2. [Rule 1 - Bug] Removed invalid JSX comment inside JSX attributes**
- **Found during:** Task 1 — first write attempt
- **Issue:** Initial draft included `{/* ... */}` as a JSX expression between props (invalid TSX syntax that would cause a compilation error)
- **Fix:** Moved the comment to a pre-computed const (`revenueValue`) above the JSX return
- **Files modified:** packages/frontend/src/pages/DashboardPage.tsx
- **Commit:** d32dfdd

**3. [Scope adjustment] Removed voidMutation from DashboardPage**
- **Reason:** After reading VoidConfirmDialog.tsx, confirmed it accepts no `onConfirm` prop and handles the void API call internally. The plan's template included `voidMutation` for a hypothetical `onConfirm` prop that doesn't exist. DashboardPage simply calls `openVoidDialog(saleId)` and VoidConfirmDialog does the rest.
- **Impact:** Cleaner DashboardPage — no duplicate mutation logic.

## Known Stubs

None — DashboardPage is fully implemented. All queries are wired to real API endpoints. All component props receive real data. No hardcoded empty values flow to rendered output.

## Threat Surface Scan

All threat surface introduced by this plan is covered by the existing threat model:

- **T-04-13** (GET /api/admin/summary info disclosure): mitigated — requireAuth + requireRole('admin') on the route; 401/403 on unauthenticated or non-admin sessions
- **T-04-14** (void action tampering): mitigated — POST /api/sales/:id/void enforced server-side with requireRole('admin'); VoidConfirmDialog is UI convenience only
- **T-04-15** (CSV download info disclosure): accepted — admin-only page; internal tool; data already in browser memory

No new network endpoints, auth paths, or file access patterns beyond what the plan covers.

## Self-Check

Files exist:
- packages/frontend/src/pages/DashboardPage.tsx — FOUND
- packages/frontend/src/components/sales/VoidConfirmDialog.tsx — FOUND (modified)

Commits:
- d32dfdd — FOUND (Task 1: DashboardPage + VoidConfirmDialog fix)

TypeScript compilation: zero errors (npx tsc --noEmit exits 0 — verified in task).

Acceptance criteria verified (all 12 PASS):
- Placeholder removed — PASS
- admin-summary query key present — PASS
- applyFilters(sales, filters) in useMemo — PASS
- downloadCSV(filteredRows) — PASS
- StatCard x3 occurrences (>= 2 required) — PASS
- SalesCharts — PASS
- SalesFilterBar — PASS
- AdminSalesTable — PASS
- AuditDrawer — PASS
- openVoidDialog — PASS
- No parseFloat — PASS
- TypeScript exits 0 — PASS

## Self-Check: PASSED
