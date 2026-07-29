# Phase 11: Add "Created At" column to admin and moderator sheets with humanized date format - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a "Created At" column to the moderator Sales sheet (the admin Sales sheet already has one, added in Phase 4). Reformat all date/time displays across both Sales sheets and the Audit Drawer to a humanized style ("July 29, 2026, 2:32 PM") — replacing the current raw "YYYY-MM-DD HH:mm" format used in three separate local `formatDateTime` functions.

</domain>

<decisions>
## Implementation Decisions

### Date Format
- **D-01:** All date/time displays across the Sales sheets (moderator `SalesTable.tsx`, admin `AdminSalesTable.tsx`) and the Audit Drawer (`AuditDrawer.tsx`) use a humanized format with long month name, e.g. `July 29, 2026, 2:32 PM`. Time-of-day is always included — never date-only — to preserve precision needed for the audit trail and edit history.
- **D-02:** Timezone remains UTC internally (unchanged — CLAUDE.md Rule 7). The UI drops the explicit "UTC" label/suffix currently shown in the Audit Drawer (`entry.createdAt.replace('T', ' ').slice(0, 16)} UTC`). No conversion to viewer-local timezone.

### Scope
- **D-03:** This phase touches ONLY: `packages/frontend/src/components/sales/SalesTable.tsx` (moderator), `packages/frontend/src/components/admin/AdminSalesTable.tsx` (admin), `packages/frontend/src/components/sales/AuditDrawer.tsx`. Explicitly OUT of scope for this phase: `ShiftHistoryTable.tsx`, `AdminShiftsPage.tsx`, `UsersPage.tsx`, `SalesFilterBar.tsx` — their date formatting is untouched (see Deferred Ideas).

### Moderator "Created At" Column
- **D-04:** Add a new "Created At" column to the moderator `SalesTable.tsx`, positioned immediately before "Date Edited" (mirrors the admin table's column order: ...Notes, Created At, Date Edited, Actions).
- **D-05:** Column reads from `Sale.createdAt`, which already exists on the Prisma schema and is already returned by `GET /api/sales` — no backend or schema change needed for this column.

### Claude's Discretion
- Exact time format details (12-hour vs 24-hour clock) — no preference stated; default to 12-hour with AM/PM unless research finds an established pattern elsewhere in the app.
- Whether to introduce one shared date-formatting utility (e.g. in `packages/shared` or a frontend lib) to replace the 3 duplicated local `formatDateTime` functions (`AdminSalesTable.tsx`, `AdminShiftsPage.tsx`, and the raw inline formatting in `SalesTable.tsx`/`AuditDrawer.tsx`), vs. updating each file in place. Note: `AdminShiftsPage.tsx`'s own `formatDateTime` is out of scope for reformatting (D-03) but could still be pointed at a new shared util if one is created — planner's call.
- CSV export values in `AdminSalesTable.tsx` (lines ~48-50) currently write raw `createdAt`/`updatedAt` ISO strings into exported rows. Whether to humanize these too or keep CSV exports as raw ISO for machine-readability was not discussed — planner may choose either, consistent with the existing CSV formula-injection sanitization rule (CLAUDE.md).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture Rules
- `CLAUDE.md` §Critical Architecture Rules, Rule 7 (UTC everywhere) — storage/connection timezone is UTC; this phase only changes display formatting, never the stored value or the DB/Prisma timezone config.
- `CLAUDE.md` §Tech Choices — CSV export row (`@json2csv/plainjs`, formula injection sanitization) — relevant if CSV date columns are reformatted.

### Prior Phase Decisions
- `.planning/phases/03-sales-core/03-CONTEXT.md` D-12/D-13 — Audit Drawer original design: read-only, newest-first, shows timestamp (UTC) + username + action + field changed + old/new value. This phase changes only the timestamp's display format.
- `.planning/phases/04-admin-dashboard/04-CONTEXT.md` D-03/D-12 — Admin Sales table column order (established in Phase 4, includes existing "Created At") and matching CSV column list. This phase's moderator column placement mirrors D-03's order.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None directly reusable as-is — all three date-formatting call sites (`AdminSalesTable.tsx` `formatDateTime`, `SalesTable.tsx` inline `.replace('T', ' ').slice(0, 16)`, `AuditDrawer.tsx` inline `.replace('T', ' ').slice(0, 16)} UTC`) duplicate the same raw-ISO-slice logic independently. No shared utility exists yet (see Claude's Discretion).

### Established Patterns
- `Sale.createdAt` and `Sale.updatedAt` are already part of the `Sale` type (`@alejinput/shared`) and already returned by `GET /api/sales` — confirmed via `packages/backend/prisma/schema.prisma` (`createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`).
- Admin table's "Date Edited" column already handles the "never edited" case by comparing `updatedAt !== createdAt` and showing `—` — moderator table's existing "Date Edited" cell does the equivalent via `sale.lastEditedById` check. Both patterns should be preserved when reformatting.

### Integration Points
- `packages/frontend/src/components/sales/SalesTable.tsx` — `columns` array (`ColumnDef<Sale>[]`), insert new `accessorKey: 'createdAt'` column before the `updatedAt` column (~line 60).
- `packages/frontend/src/components/admin/AdminSalesTable.tsx` — `formatDateTime()` (line 20) is the function to update/replace; also used at lines 167 and 189, and feeds CSV export values at lines 48/50.
- `packages/frontend/src/components/sales/AuditDrawer.tsx` — inline formatting at line 76, feeding the audit entry timestamp display.

</code_context>

<specifics>
## Specific Ideas

- Target format string given by the user: `"July 29, 2026"` (date portion) — combined with the Time-of-day decision (D-01), the full display becomes `"July 29, 2026, 2:32 PM"`.
- User explicitly named this format applies to "the audit logs and edited at" in addition to the new Created At column — i.e., every date/time shown on the Sales sheets and Audit Drawer, not just the new column.

</specifics>

<deferred>
## Deferred Ideas

- App-wide date format consistency — extending the humanized format to Shift History table, Users page, and Admin Shifts page. User chose "Sales scope only" for this phase (D-03); a future phase could extend the humanized format app-wide.

</deferred>

---

*Phase: 11-add-created-at-column-to-admin-and-moderator-sheets-with-hum*
*Context gathered: 2026-07-29*
