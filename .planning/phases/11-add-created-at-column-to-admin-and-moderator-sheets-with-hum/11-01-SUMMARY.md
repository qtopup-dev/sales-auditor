---
phase: 11-add-created-at-column-to-admin-and-moderator-sheets-with-hum
plan: 01
subsystem: ui
tags: [react, typescript, tanstack-table, intl-datetimeformat]

# Dependency graph
requires:
  - phase: 04-admin-dashboard
    provides: AdminSalesTable.tsx with existing "Created At" column pattern (accessorKey, header, size shape mirrored for moderator table)
  - phase: 03-sales-core
    provides: AuditDrawer.tsx read-only audit entry list with timestamp display
provides:
  - Shared UTC-pinned humanized date/time formatter (packages/frontend/src/lib/dateTime.ts)
  - "Created At" column on moderator Sales sheet (SalesTable.tsx), mirroring admin sheet column order
  - Humanized "Date Edited" display on both moderator and admin Sales sheets
  - Humanized Audit Drawer timestamps with the trailing "UTC" label removed
affects: [future phases touching Sales sheets, Audit Drawer, or app-wide date formatting]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Shared frontend lib/dateTime.ts for UI-facing UTC-pinned Intl.DateTimeFormat date/time formatting, following the existing lib/shiftTime.ts Intl.DateTimeFormat convention but without timezone conversion"]

key-files:
  created:
    - packages/frontend/src/lib/dateTime.ts
  modified:
    - packages/frontend/src/components/sales/SalesTable.tsx
    - packages/frontend/src/components/admin/AdminSalesTable.tsx
    - packages/frontend/src/components/sales/AuditDrawer.tsx

key-decisions:
  - "Single shared formatDateTime(iso) utility replaces three duplicated raw-ISO-slice formatters, per CONTEXT.md discretion note"
  - "CSV export in AdminSalesTable.tsx keeps raw ISO createdAt/updatedAt values unchanged — machine-readable export intentionally independent of UI display format"
  - "Audit Drawer 'UTC' suffix label fully removed, not relabeled, per D-02"

patterns-established:
  - "packages/frontend/src/lib/dateTime.ts: formatDateTime(iso) — UTC-pinned, humanized 'Month D, YYYY, H:MM AM/PM' format for all Sales sheet and Audit Drawer timestamp displays"

requirements-completed: [PHASE11-SC1, PHASE11-SC2, PHASE11-SC3, PHASE11-SC4]

# Metrics
duration: 10min
completed: 2026-07-29
---

# Phase 11 Plan 01: Add Created At column and humanize date formatting Summary

**Shared UTC-pinned formatDateTime(iso) utility replaces three duplicated raw-ISO-slice date formatters; moderator Sales sheet gains a "Created At" column matching the admin sheet's existing layout.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-29T14:19:00Z (approx)
- **Completed:** 2026-07-29T14:29:12Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Created `packages/frontend/src/lib/dateTime.ts` exporting `formatDateTime(iso)`, pinned to `timeZone: 'UTC'` in both `Intl.DateTimeFormat` calls, producing e.g. "July 29, 2026, 2:32 PM"
- Added a new "Created At" column to the moderator `SalesTable.tsx`, positioned immediately before "Date Edited" — closing the gap where the admin sheet had this column and the moderator sheet did not
- Replaced all three duplicated raw-ISO-slice formatters (`SalesTable.tsx` inline, `AdminSalesTable.tsx` local function, `AuditDrawer.tsx` inline) with the single shared `formatDateTime` utility
- Removed the trailing "UTC" text label from the Audit Drawer timestamp display
- Preserved existing business logic unchanged: moderator "never edited" check (`sale.lastEditedById`), admin "never edited" check (`hasEdits = updatedAt !== createdAt` raw-string comparison), and CSV export raw ISO values

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared humanized date formatter and add "Created At" column to moderator SalesTable** - `e248be7` (feat)
2. **Task 2: Point AdminSalesTable and AuditDrawer at the shared formatter** - `2f82b83` (refactor)

**Plan metadata:** (pending — this commit)

## Files Created/Modified
- `packages/frontend/src/lib/dateTime.ts` - New shared `formatDateTime(iso)` UTC-pinned humanized date/time formatter
- `packages/frontend/src/components/sales/SalesTable.tsx` - Added "Created At" column before "Date Edited"; both now use `formatDateTime`
- `packages/frontend/src/components/admin/AdminSalesTable.tsx` - Removed local `formatDateTime` duplicate, imports shared util; CSV export and `hasEdits` comparison unchanged
- `packages/frontend/src/components/sales/AuditDrawer.tsx` - Uses shared `formatDateTime`; removed trailing "UTC" label

## Decisions Made
- Followed plan's discretion guidance: introduced one shared `dateTime.ts` utility rather than updating three files independently, matching the existing `shiftTime.ts` precedent pattern (but UTC-pinned instead of Asia/Manila-converted)
- Left CSV export values as raw ISO strings (unchanged) — decision explicitly called out in the plan as independent of the UI display format change

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria greps passed on first attempt; `npm run build --workspace=@alejinput/frontend` succeeded after both tasks with no TypeScript errors.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. This is a frontend-only display formatting change; no backend, schema, or environment changes.

## Next Phase Readiness

- Sales sheets (moderator and admin) and Audit Drawer now share a single date formatting utility — any future phase extending humanized formatting app-wide (e.g. Shift History table, Users page, Admin Shifts page — deferred per CONTEXT.md) can reuse `packages/frontend/src/lib/dateTime.ts` directly
- No blockers or concerns for subsequent phases

---
*Phase: 11-add-created-at-column-to-admin-and-moderator-sheets-with-hum*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: packages/frontend/src/lib/dateTime.ts
- FOUND: packages/frontend/src/components/sales/SalesTable.tsx
- FOUND: packages/frontend/src/components/admin/AdminSalesTable.tsx
- FOUND: packages/frontend/src/components/sales/AuditDrawer.tsx
- FOUND: .planning/phases/11-add-created-at-column-to-admin-and-moderator-sheets-with-hum/11-01-SUMMARY.md
- FOUND commit: e248be7
- FOUND commit: 2f82b83
