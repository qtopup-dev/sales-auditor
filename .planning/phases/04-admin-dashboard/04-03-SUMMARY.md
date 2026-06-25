---
plan: 04-03
phase: 4
title: "Frontend — SalesCharts and AdminSalesTable components"
subsystem: frontend
tags: [admin, ui-components, recharts, csv, react-table, charts, export]
completed_date: 2026-06-26
duration_minutes: 12
tasks_completed: 2
tasks_total: 2

dependency_graph:
  requires:
    - 04-01 (AdminSummary type from GET /api/admin/summary used as SalesCharts prop)
    - 04-02 (recharts and @json2csv/plainjs installed in packages/frontend)
  provides:
    - SalesCharts component (three Recharts charts in responsive grid with loading/empty states)
    - AdminSalesTable component (read-only react-table v8 with all ADMIN-02 columns)
    - downloadCSV function (UTF-8 BOM + injection sanitization, exported standalone)
  affects:
    - packages/frontend/src/components/admin/SalesCharts.tsx (created)
    - packages/frontend/src/components/admin/AdminSalesTable.tsx (created)

tech_stack:
  added: []
  patterns:
    - recharts ResponsiveContainer must have explicit h-64 parent — height="100%" reads from DOM parent (RESEARCH.md Pitfall 1)
    - @json2csv/plainjs pre-sanitize pattern — pre-process rows into Record<string, unknown>[] before parse() to avoid transforms generic type complexity
    - react-table v8 ColumnDef with accessorKey and custom cell renderers
    - UTF-8 BOM prepended to CSV Blob for correct Excel encoding (U+FEFF)
    - CSV formula injection prevention via sanitizeCell() checking injection-prefix chars

key_files:
  created:
    - packages/frontend/src/components/admin/SalesCharts.tsx
    - packages/frontend/src/components/admin/AdminSalesTable.tsx
  modified: []

decisions:
  - "Pre-sanitize CSV rows before Parser instead of using transforms option — @json2csv/plainjs transforms generic type requires return type T (Sale), conflicting with sanitized Record<string, unknown>"
  - "BOM written as literal U+FEFF character in source — same runtime value as \\uFEFF escape, confirms injection in Blob"
  - "Date Edited column shows dash when updatedAt === createdAt — avoids showing edit timestamp on freshly created rows"
  - "Void button hidden when sale.status === void — prevents re-voiding already voided rows"
---

# Phase 4 Plan 03: Frontend SalesCharts and AdminSalesTable Summary

Three Recharts charts (LineChart trend, BarChart product, BarChart MOP) in a responsive grid with loading/empty states, and a read-only react-table v8 AdminSalesTable with all 11 ADMIN-02 columns, Audit/Void actions, and a downloadCSV function with UTF-8 BOM and injection sanitization.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create SalesCharts.tsx | 45570e6 | packages/frontend/src/components/admin/SalesCharts.tsx (created) |
| 2 | Create AdminSalesTable.tsx | 0109870 | packages/frontend/src/components/admin/AdminSalesTable.tsx (created) |

## What Was Built

### SalesCharts.tsx

Three Recharts charts in a `grid grid-cols-1 md:grid-cols-3 gap-6 mb-12` responsive grid:

- **Sales Over Time** — `LineChart` with `dataKey="date"` on XAxis and `dataKey="count"` on Line; stroke `#2563eb`, strokeWidth 2, dot={false}
- **Sales by Product** — `BarChart` with angled XAxis labels (angle -30, textAnchor "end") and 40px bottom margin for label clearance
- **Sales by Payment Method** — `BarChart` identical structure with `dataKey="name"` and `dataKey="count"`

Each chart card:
- Container: `bg-white border border-gray-200 rounded-md p-4`
- Title: `text-sm font-normal text-gray-900 mb-3`
- Height wrapper: `<div className="h-64">` — MANDATORY for ResponsiveContainer to have non-zero height
- Empty state: "No data yet." vertically centered in h-64 via flex
- Loading state: `animate-pulse bg-gray-200 rounded h-64 w-full` skeleton per card

Props interface matches `AdminSummary` from GET /api/admin/summary (04-01).

### AdminSalesTable.tsx

Read-only react-table v8 table with 11 columns (ADMIN-02):

| Column | Size | Notes |
|--------|------|-------|
| Product | 160px | productNameSnapshot |
| Price | 100px | priceSnapshot displayed right-aligned as string — no parseFloat (CLAUDE.md Rule 6) |
| MOP | 140px | mopNameSnapshot |
| Receiver | 140px | receiver |
| Notes | minSize 120px | line-clamp-2 truncation with title attribute |
| Created By | 120px | createdByUsername |
| Created At | 140px | ISO to "YYYY-MM-DD HH:mm" via formatDateTime |
| Last Edited By | 120px | lastEditedByUsername or "—" |
| Date Edited | 140px | shows "—" when updatedAt === createdAt (never edited) |
| Status | 90px | Active badge (green-100/green-800) or Void badge (red-100/red-700) |
| Actions | 120px | Void button (active only) + Audit button |

Row behavior:
- Voided rows: `bg-red-50 hover:bg-red-100` tinting
- Void button hidden when `sale.status === 'void'`
- Audit button calls `openAuditDrawer(sale.id)` from `useSalesEditStore` (ADMIN-12)

### downloadCSV (exported standalone)

Security: pre-sanitizes all text fields with `sanitizeCell()` before CSV serialization:
- Checks `['=', '-', '+', '@', '\t', '\r']` prefix characters
- Prepends `'` to any cell starting with these characters
- Prevents formula injection when CSV is opened in Excel/Sheets

Export mechanics:
- Pre-processes `Sale[]` into `Record<string, unknown>[]` for clean `@json2csv/plainjs` Parser call
- Uses `Parser({ fields })` with label/value field mappings for all 10 D-12 columns
- Prepends UTF-8 BOM character (U+FEFF) to Blob before download
- Filename: `sales-export-{YYYY-MM-DD}.csv`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Refactored CSV transforms to pre-sanitize pattern**
- **Found during:** Task 2 TypeScript verification
- **Issue:** `@json2csv/plainjs` `transforms` option is typed `Transform<TRaw, T>` where `T = Sale`; the transform return type `Record<string, unknown>` is not assignable to `Sale`. Also `parser.parse(rows)` rejected `Sale[]` because `Sale` lacks an index signature.
- **Fix:** Pre-sanitize rows into `Record<string, unknown>[]` before Parser; removed transforms option. Achieves identical security outcome (all injection-prefix cells sanitized before CSV output) with clean TypeScript types.
- **Files modified:** packages/frontend/src/components/admin/AdminSalesTable.tsx
- **Commit:** 0109870 (included in Task 2 commit — no separate commit needed)

## Known Stubs

None — both components are fully implemented and receive all data via props. No internal data fetching stubs. AdminSalesTable and SalesCharts are ready for consumption by DashboardPage (04-05).

## Threat Surface Scan

No new threat surface beyond the plan's threat model:
- T-04-07 (CSV formula injection): mitigated via sanitizeCell() with INJECTION_PREFIXES check on all text fields before Parser serialization
- T-04-08 (CSV information disclosure): accepted — admin-only page, data already in browser memory
- T-04-09 (sync parse DoS): accepted — internal tool, manageable dataset

## Self-Check

Files exist:
- packages/frontend/src/components/admin/SalesCharts.tsx — FOUND
- packages/frontend/src/components/admin/AdminSalesTable.tsx — FOUND

Commits:
- 45570e6 — Task 1 SalesCharts
- 0109870 — Task 2 AdminSalesTable

TypeScript compilation: zero errors (npx tsc --noEmit exits 0 — verified twice).

Acceptance criteria verified:
- SalesCharts: h-64 appears 5 times, ResponsiveContainer 8 times, "No data yet." 3 times, animate-pulse skeleton present, md:grid-cols-3 present
- AdminSalesTable: downloadCSV exported, INJECTION_PREFIXES defined, openAuditDrawer(sale.id) called, parseFloat only in comment (not called), bg-red-50 voided tinting, line-clamp-2 for Notes, updatedAt !== createdAt logic present, BOM present

## Self-Check: PASSED
