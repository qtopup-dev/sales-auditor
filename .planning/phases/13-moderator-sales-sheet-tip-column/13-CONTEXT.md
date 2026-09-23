# Phase 13: Moderator Sales Sheet Tip Column - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Add an optional per-row `tip` amount (DECIMAL(10,2), nullable) to sales rows. Moderators enter/edit it on their Sales sheet; admins see and edit it on their views. Tips add into every revenue figure in the app (except the per-product breakdown). Negative values are rejected on frontend and backend; blank = no tip.

</domain>

<decisions>
## Implementation Decisions

### Where Tips Count
- **D-01:** Every revenue figure becomes `price + tip` on active rows: moderator Revenue This Shift banner (`GET /api/shifts` live totals in `shifts.ts`), moderator Shift History revenue, admin Shifts tabs/history (`admin.ts` ~L315-342), dashboard Total Revenue (`admin.ts` ~L51-61), and the Profit/Turnover KPI raw queries (`admin.ts` ~L130-161). — **Reversibility:** costly — touches every revenue aggregate/raw SQL site.
- **D-02:** Dashboard per-product revenue breakdown stays **price-only** (a tip isn't product revenue). Chart total may be less than Total Revenue — accepted.
- **D-03:** Voided rows' tips are excluded from revenue exactly like their price (existing active-only rule).
- **D-04:** The Revenue This Shift banner (`ShiftTotalsBanner.tsx`) shows the combined total plus a smaller secondary line `incl. ₱X tips`. The admin Shifts tabs use the same component, so they get it too. Backend must therefore return a separate tips sum alongside the combined revenue (as a DECIMAL string).
- **D-05:** Dashboard Total Revenue card gets the same `incl. ₱X tips` caption (summary endpoint returns a `totalTips` string).
- **D-06:** Profit/Turnover KPI cards and the Shift History "Revenue" column show the combined number only — no tips caption.

### Entry & Editing
- **D-07:** The moderator enters a tip via an optional Tip input in `AddRowForm.tsx` **and** can edit it inline afterwards through `EditableCell` / the single-field PATCH (same flow as `notes`). `tip` is added to `ALLOWED_PATCH_FIELDS` in `sales.ts`.
- **D-08:** Every tip change writes an AuditLog entry (`fieldName: 'tip'`, old → new, `toFixed(2)` strings or empty for null) in the same transaction (CLAUDE.md Rule 2). Creation with a tip follows whatever the create path already does for other fields.
- **D-09:** Clearing the cell (blank) saves `null` and is logged as `tip: 350.00 → (empty)`, the same as clearing Notes.
- **D-10:** Edit permissions are the same as other cells: row owner + edit rights + active row for moderators, existing admin permissions for admins. No new permission logic (backend RBAC per Rule 9).
- **D-11:** Moderator sheet column order: `Product | Price | Tip | Mode of Payment | …`. Right-aligned like Price.

### Value Rules
- **D-12:** `0` (or `0.00`) is normalized to `null` (no tip) on both frontend and backend. There is only one representation of "no tip".
- **D-13:** Up to 2 decimals are allowed (e.g. `20.50`). More than 2 decimals is **rejected**, not rounded.
- **D-14:** No business cap. Reject only values above `99999999.99` (the DECIMAL(10,2) ceiling).
- **D-15:** Negatives and non-numeric values are rejected with a backend 400 (express-validator), whatever the frontend does. The frontend input accepts only digits and `.` (so `-` can't be typed). Pasted or invalid values show an inline error and aren't saved.
- **D-16:** Money handling per Rule 6: `Decimal @db.Decimal(10,2)` nullable column on `Sale`. The API returns `tip` as a string (`toFixed(2)`) or `null`, and sums never use JS float arithmetic.

### Admin Visibility
- **D-17:** The Tip column appears in `AdminSalesTable.tsx` right after Price, and admins can edit it inline under their existing permissions.
- **D-18:** The CSV export includes a Tip column after Price, passed through the existing `sanitizeCell` formula-injection sanitization.
- **D-19:** The per-shift sale list on `AdminShiftsPage.tsx` gets a Tip column after Price.
- **D-20:** The `VoidRequestsTable.tsx` shows Tip next to Price.
- **D-21:** Rows with no tip show an **empty cell** everywhere (tables), and an empty value in CSV.

### Claude's Discretion
- The exact prop and field name for the tips sub-value (`activeSalesTips`, `totalTips`, etc.) and how `ShiftTotalsBanner` renders the secondary line (it may hide the line when tips = 0.00).
- Whether the combined revenue is computed as `_sum` of both columns (added via Decimal) or with `SUM(priceSnapshot + COALESCE(tip,0))` in raw SQL. Either is fine if it's Decimal-safe.
- Where the tip parse/validate helper lives (shared package vs frontend-local).
- Migration mechanics: check whether the manual `db execute` + `migrate resolve` workaround from earlier phases is still needed.
- The inline error copy.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project rules
- `CLAUDE.md` — Critical Architecture Rules 2 (audit in same txn), 3 (soft-delete), 6 (DECIMAL money, strings from API), 8 (status filters), 9 (backend RBAC), 10 (pessimistic UI)
- `.planning/ROADMAP.md` §Phase 13 — phase goal
- `.planning/phases/12-moderator-void-requests/12-CONTEXT.md` — Void Requests table columns (D-05) that now gain Tip
- `.planning/phases/11-add-created-at-column-to-admin-and-moderator-sheets-with-hum/11-CONTEXT.md` — column ordering precedent for moderator/admin sheets

No external specs. Requirements are fully captured in the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/backend/src/routes/sales.ts`: `serializeSale` (money via `toFixed(2)`), `ALLOWED_PATCH_FIELDS` + per-field PATCH with AuditLog writes (the `notes` branch ~L520 is the closest analog for a nullable field), and the create route (~L177-247).
- `packages/frontend/src/components/sales/AddRowForm.tsx`, `EditableCell.tsx`, `SalesTable.tsx`: add-row form, inline cell edit, and moderator columns.
- `packages/frontend/src/components/shift/ShiftTotalsBanner.tsx`: revenue banner, including the `addThousandsSep` string formatting (no float).
- `packages/frontend/src/components/admin/AdminSalesTable.tsx`: admin columns + CSV export with `sanitizeCell`.

### Established Patterns
- Revenue sums use `prisma.sale.aggregate({ _sum: { priceSnapshot } })` (`shifts.ts` ~L119/153, `admin.ts` ~L53/61/315) and `$queryRaw` SUM CASE for KPIs (`admin.ts` ~L130-161, handled by `toMoneyStr`). **All of these must include the tip (D-01), except the product breakdown groupBy (D-02).**
- Dashboard revenue label uses string-regex thousands separators (`DashboardPage.tsx` ~L106), never float.
- Active-only revenue: `status: 'active'` filters stay unchanged.

### Integration Points
- `packages/backend/prisma/schema.prisma` `model Sale`: add `tip Decimal? @db.Decimal(10, 2)`.
- Shared Sale type(s) in `packages/shared` / frontend types: add `tip: string | null`.
- `packages/frontend/src/pages/SalesPage.tsx`, `AdminShiftsPage.tsx`, `DashboardPage.tsx`, `components/shift/ShiftHistoryTable.tsx`, `components/admin/VoidRequestsTable.tsx`, `components/admin/SalesCharts.tsx` (types only).

</code_context>

<specifics>
## Specific Ideas

- The banner secondary line reads like `incl. ₱350.00 tips` under the main `₱12,500.00` figure.
- Audit entries for tips look like `tip: 350.00 → (empty)` when cleared.

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within the phase scope.

</deferred>

---

*Phase: 13-moderator-sales-sheet-tip-column*
*Context gathered: 2026-09-23*
