---
phase: 13-moderator-sales-sheet-tip-column
reviewed: 2026-09-23T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - packages/backend/prisma/schema.prisma
  - packages/backend/prisma/migrations/20260923120000_add-sale-tip/migration.sql
  - packages/backend/src/lib/tip.ts
  - packages/backend/src/lib/tip.check.ts
  - packages/backend/src/routes/sales.ts
  - packages/backend/src/routes/shifts.ts
  - packages/backend/src/routes/admin.ts
  - packages/shared/src/types/sale.ts
  - packages/frontend/src/lib/tip.ts
  - packages/frontend/src/components/sales/EditableCell.tsx
  - packages/frontend/src/components/sales/SalesTable.tsx
  - packages/frontend/src/components/sales/AddRowForm.tsx
  - packages/frontend/src/components/shift/ShiftTotalsBanner.tsx
  - packages/frontend/src/pages/SalesPage.tsx
  - packages/frontend/src/pages/AdminShiftsPage.tsx
  - packages/frontend/src/components/admin/StatCard.tsx
  - packages/frontend/src/pages/DashboardPage.tsx
  - packages/frontend/src/components/admin/AdminSalesTable.tsx
  - packages/frontend/src/components/admin/VoidRequestsTable.tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-09-23
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Reviewed the phase-13 tip-column diff (`git diff b291464..HEAD`) across backend money/validation logic, the sales/shifts/admin routes, and the frontend entry/display components. `parseTip` (backend) and `TIP_PATTERN`/`isZeroTip` (frontend) are well-designed, kept in sync, and cover the decision list (D-12..D-15) correctly — verified against the `tip.check.ts` assertions by hand-tracing the canonicalization logic (leading-zero stripping, `0.00`→`null`, 8-integer-digit ceiling, 2-decimal-max rejection). Money handling consistently uses `Prisma.Decimal`/`.toFixed(2)` (never JS float) across `shifts.ts`, `admin.ts`, and `sales.ts`, satisfying CLAUDE.md Rule 6. The audit-log-in-same-transaction rule (Rule 2) and RBAC checks (Rule 9) are respected in the new `tip` PATCH branch, which mirrors the existing `notes` pattern exactly, including the "skip write if canonically unchanged" optimization that avoids phantom audit rows.

No BLOCKER-level defects were found in the code phase 13 actually introduced. Two WARNINGs and two INFO items are below — one warning is a pre-existing defect (predates this phase) that the diff's hunks pass directly through unfixed, included here because the diff rewrites the exact buggy lines and a future reader tracing tip-revenue correctness will hit it immediately.

## Warnings

### WR-01: Turnover KPI is computed identically to Profit — voided sales never counted in Turnover

**File:** `packages/backend/src/routes/admin.ts:133-170`
**Issue:** The per-period `$queryRaw` blocks compute both `profitSum` and `turnoverSum` with the *same* `CASE WHEN status = 'active' THEN priceSnapshot + COALESCE(tip, 0) ELSE 0 END` expression:
```sql
SELECT
  SUM(CASE WHEN status = 'active' THEN priceSnapshot + COALESCE(tip, 0) ELSE 0 END) AS profitSum,
  SUM(CASE WHEN status = 'active' THEN priceSnapshot + COALESCE(tip, 0) ELSE 0 END) AS turnoverSum
FROM sales
WHERE organizationId = ${organizationId} AND status IN ('active', 'void') AND ...
```
The surrounding comment (line 127) states "profitSum = SUM WHERE active; turnoverSum = SUM WHERE active OR void", but the SQL for `turnoverSum` never actually includes void rows — it filters on `status = 'active'` exactly like `profitSum`. Every `kpiData.turnover.*` value returned to the dashboard is therefore identical to `kpiData.profit.*`, which is very likely not what admins see as "Turnover" (a figure meant to include voided transaction volume).

This bug predates phase 13 (confirmed via `git diff b291464..HEAD`: the pre-phase-13 version had the identical dual-`CASE WHEN status = 'active'` duplication, just without `+ COALESCE(tip, 0)`), so it is not a phase-13 regression. It is flagged here because phase 13 rewrote all four occurrences of these exact lines (to add tip) without noticing/fixing the pre-existing duplication, and because tip is now folded into both (still-wrong) sums.

**Fix:** `turnoverSum`'s CASE should use `status IN ('active', 'void')` (matching the outer WHERE) rather than `status = 'active'`:
```sql
SELECT
  SUM(CASE WHEN status = 'active' THEN priceSnapshot + COALESCE(tip, 0) ELSE 0 END) AS profitSum,
  SUM(priceSnapshot + COALESCE(tip, 0)) AS turnoverSum
FROM sales
WHERE organizationId = ${organizationId} AND status IN ('active', 'void') AND ...
```
(the outer `WHERE status IN ('active','void')` already scopes the rows, so `turnoverSum` can just sum unconditionally once profitSum's CASE keeps it active-only).

### WR-02: `tip.check.ts` self-check is not wired into any script, build step, or CI — will silently rot

**File:** `packages/backend/src/lib/tip.check.ts:1-4`, `packages/backend/package.json`
**Issue:** The file's own header says "This is the phase's one runnable check of the money/validation rules" and instructs `npx tsx packages/backend/src/lib/tip.check.ts` to run it manually. Verified: `packages/backend/package.json` has no `test` script at all, the repo root `package.json` has no `test` script either, and `.github/workflows/deploy.yml` only builds/deploys via SSH — it never runs this file. There's also no reference to `tip.check` anywhere else in the codebase. Because `packages/backend/tsconfig.json` has no `exclude` for it, `npm run build` (tsc) will still compile it into `dist/lib/tip.check.js` and ship it in the production image, even though nothing ever invokes it there either.
If `parseTip`'s regex or canonicalization logic is edited in the future (e.g. changing the decimal-digit ceiling), nothing will catch a regression — the assertions only run if a developer remembers the manual command.
**Fix:** Add a `"test": "tsx src/lib/tip.check.ts"` (or similar glob covering all `*.check.ts` files) script to `packages/backend/package.json`, and call it from `deploy.yml` (or a separate CI job) before `docker compose build`/deploy. At minimum, exclude it from the `tsc` build output (`"exclude": ["src/**/*.check.ts"]` in `tsconfig.json`) so it isn't shipped to production for no purpose.

## Info

### IN-01: `AddRowForm`'s column-width destructuring silently drops the real Actions-column width (pre-existing, touched by this diff)

**File:** `packages/frontend/src/components/sales/AddRowForm.tsx:30-32`, `packages/frontend/src/components/sales/SalesTable.tsx:11-99`
**Issue:** `SalesTable`'s header row has 9 `<th>` cells (Product, Price, Tip, MOP, Receiver, Notes, Created At, Date Edited, Actions), but `AddRowForm` destructures only 8 variables from the measured `columnWidths` array:
```ts
const [productW, priceW, tipW, mopW, receiverW, notesW, dateEditedW, actionsW] =
  columnWidths ?? DEFAULT_COLUMN_WIDTHS;
```
This means `dateEditedW` actually receives the "Created At" column's measured width, `actionsW` receives the "Date Edited" column's width, and the real Actions column's width (index 8) is dropped entirely — the Add Row form's own "Date Edited" and "Actions" cells will visually misalign with the table header by one column-width once real (non-fallback) `columnWidths` are measured.
Confirmed via `git diff` that this off-by-one predates phase 13 (the old code already destructured one fewer variable than the old 8-header-cell layout required); the tip diff only inserted `tipW` at the correct position, preserving the pre-existing misalignment rather than introducing a new one.
**Fix:** Add a 9th destructured variable (e.g. `createdAtW`) and use both `createdAtW` and a genuine `actionsW` in the two trailing placeholder cells, or drop the unused "Date Edited"/"Actions" placeholder cells from `AddRowForm` entirely since they render static content (`—`) that doesn't need to track a measured width.

### IN-02: Redundant `?? ''` before `sanitizeCell` calls in CSV export

**File:** `packages/frontend/src/components/admin/AdminSalesTable.tsx:43`
**Issue:** `tip: sanitizeCell(row.tip ?? '')` — `sanitizeCell` already does `String(value ?? '')` internally (line 27), so the `?? ''` here is a no-op (matches the pre-existing style used for `notes`/`lastEditedByUsername` on adjacent lines, so it's consistent with existing conventions, not a new pattern).
**Fix:** Non-blocking; `sanitizeCell(row.tip)` would be equivalent and slightly terser, but leaving it matches the file's existing style for nullable fields.

---

_Reviewed: 2026-09-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
