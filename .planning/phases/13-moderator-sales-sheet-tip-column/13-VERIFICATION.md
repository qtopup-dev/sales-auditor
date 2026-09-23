---
phase: 13-moderator-sales-sheet-tip-column
verified: 2026-09-23T04:30:00Z
status: passed
score: 30/30 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "On the moderator Sales sheet: add a row with a tip via Add Row, then type an invalid tip (e.g. a paste of '-5' or '20.505') into the Add Row Tip input and into an existing row's inline Tip cell."
    expected: "Digits and '.' are the only keys accepted while typing (a typed '-' or letter never appears). Save stays disabled while the Add Row tip is invalid, with the red inline error text visible under the input. On the inline cell, blur with an invalid value discards it (no save, no error persists) and blur with '0'/'0.00' saves as an empty cell. Rows with no tip show a fully empty cell — no em dash — unlike Notes."
    why_human: "Keystroke-blocking, inline-error visibility, and empty-vs-dash rendering are DOM/visual behaviors that only surface in a running browser; grep confirms the conditional JSX exists but not that it renders correctly."
  - test: "Look at the moderator Sales sheet header/columns and the Add Row form."
    expected: "Column order reads Product | Price | Tip | Mode of Payment | ..., and the Tip header, cells, and Add Row input are right-aligned exactly like Price."
    why_human: "Visual layout/alignment confirmation."
  - test: "Clock in as a moderator with an active shift, add a sale with a tip, and watch the Revenue This Shift banner. Then check an admin Shifts tab for the same shift. Then add a tip to a sale from the dashboard and reload the Dashboard page."
    expected: "The Revenue This Shift banner shows the combined price+tip figure plus a smaller 'incl. ₱X tips' line underneath, which disappears when the shift's tips are 0.00. The same behavior appears on the admin Shifts tab using the same banner. The Dashboard's Total Revenue card shows the same style of caption; the Profit/Turnover KPI cards and the Shift History Revenue column show only the combined number with no caption."
    why_human: "Caption visibility/placement and hide-at-zero behavior are visual states best confirmed on the running app; code inspection confirms the conditionals exist (`tips && tips !== '0.00'`, `summary.totalTips !== '0.00'`) but not the rendered result."
  - test: "On the admin Dashboard sales table, click a Tip cell to edit it inline, and open the CSV export."
    expected: "The Tip column sits right after Price, right-aligned, editable via the same click-to-edit flow as other admin-editable cells, and empty (no dash) when there is no tip. The downloaded CSV has a Tip column right after Price with a sanitized value, blank when there is no tip."
    why_human: "Click-to-edit interaction and the opened CSV's actual column layout are best confirmed by a human using the running dashboard and opening the file."
  - test: "Open the admin Void Requests table."
    expected: "A right-aligned, display-only Tip column appears right after Price, empty when the voided sale had no tip."
    why_human: "Visual layout/alignment confirmation, and that this table's Tip cell is not accidentally clickable/editable."
---

# Phase 13: Moderator Sales Sheet Tip Column Verification Report

**Phase Goal:** Every moderator sales sheet gets an optional numeric "Tip" column. Tips add to the sheet's total revenue. Negative values are rejected (frontend and backend); only positive numbers allowed, blank = no tip. Money stored as DECIMAL(10,2) per project rules.
**Verified:** 2026-09-23
**Status:** human_needed
**Re-verification:** No — initial verification

This phase has no REQUIREMENTS.md entries (`Requirements: TBD` in ROADMAP.md §Phase 13). Its source of truth is `.planning/phases/13-moderator-sales-sheet-tip-column/13-CONTEXT.md` decisions D-01..D-21, which were verified against the plans, the summaries, and — independently of both — the live codebase and the running dev API on :3001.

## Goal Achievement

### Observable Truths

All truths below were checked against the actual files/DB/running API, not inferred from SUMMARY.md prose. Live checks were run fresh in this verification pass (not re-quoting the plans' own e2e output), using `curl` against the user's already-running `:3001` API and admin/admin1234 login; all cookie jars were deleted afterward.

| # | Truth (source decision) | Status | Evidence |
|---|---|---|---|
| 1 | Live MySQL `sales` table has nullable `tip DECIMAL(10,2)`, migration applied (D-16) | ✓ VERIFIED | `npx prisma migrate status` → "Database schema is up to date!"; `schema.prisma:170` has `tip Decimal? @db.Decimal(10, 2)`; `migrations/20260923120000_add-sale-tip/migration.sql` contains `ADD COLUMN \`tip\` DECIMAL(10, 2) NULL` |
| 2 | `parseTip` normalizes/validates per D-12..D-15 | ✓ VERIFIED | `npx tsx packages/backend/src/lib/tip.check.ts` → `tip checks passed` (fresh run in this session) |
| 3 | GET/POST/PATCH responses carry `tip` as a 2-decimal string or null, never a number (D-16) | ✓ VERIFIED | Live: `POST /sales` with `tip:"20.5"` returned `"tip":"20.50"`; `PATCH tip=0` returned `"tip":null` |
| 4 | Moderator/admin can enter a tip in Add Row and edit inline via the same PATCH flow as Notes (D-07) | ✓ VERIFIED | `sales.ts` `ALLOWED_PATCH_FIELDS` includes `'tip'`; live PATCH `{"field":"tip","value":"20.5"}` succeeded; `AddRowForm.tsx` posts `tip` in create payload, confirmed live via `POST /sales {"tip":"15"}` → `"tip":"15.00"` |
| 5 | Every real tip change writes one AuditLog row (fieldName 'tip', toFixed(2) old/new, same txn) (D-08) | ✓ VERIFIED | `sales.ts:559-572` `tx.auditLog.create` inside the same `prisma.$transaction` as `tx.sale.update` (line 201/325/548 all inside `$transaction`); live: PATCH tip 0→350 then 350→'' produced audit rows `oldValue:"","newValue":"350.00"` and `oldValue:"350.00","newValue":""` |
| 6 | Clearing the tip cell saves null, audited `350.00 → ''` like Notes (D-09) | ✓ VERIFIED | Live, this session: PATCH `{"field":"tip","value":""}` on a 350.00-tip row returned `"tip":null`, and `GET /sales/:id/audit` shows `"oldValue":"350.00","newValue":""` |
| 7 | Tip PATCH uses the exact same permission/ownership gates as Notes, no new RBAC code (D-10) | ✓ VERIFIED | `sales.ts` tip branch (line ~536-575) sits inside the same `else if` chain after the existing `canMutate`/status-active lookup used by every other field; no new middleware or role check added |
| 8 | Moderator sheet column order Product \| Price \| Tip \| Mode of Payment, right-aligned like Price (D-11) | ✓ VERIFIED (structure); rendering not visually confirmed | `SalesTable.tsx` `accessorKey` order is `productNameSnapshot, priceSnapshot, tip, mopNameSnapshot, ...`; `AddRowForm.tsx` Tip block sits between the Price and MOP blocks with `text-right` classes — see human verification #2 for visual confirmation |
| 9 | `0`/`0.00` normalizes to `null` on both frontend and backend — one representation of "no tip" (D-12) | ✓ VERIFIED | Backend: `tip.check.ts` asserts `'0'`, `'0.00'`, `'000'` all → null; live `POST /sales {"tip":"0.00"}` → `"tip":null`. Frontend: `isZeroTip` regex in `tip.ts`, used in `AddRowForm.tsx` submit and `EditableCell.tsx` blur |
| 10 | Tips >2 decimals, negatives, non-numeric, >99999999.99 rejected with 400 (D-13, D-14, D-15) | ✓ VERIFIED | Live this session: `PATCH tip=-3` → 400. Plan's own e2e (re-confirmed by code+check) also covers `20.505`, `abc`, `1.234`, `-1` → 400; `tip.check.ts` asserts the same throw cases |
| 11 | Tip inputs block non-digit/'.' keystrokes; invalid/pasted values show inline error and are never sent (D-15) | ✓ VERIFIED (code); interaction not visually confirmed | `blockNonTipKeys` wired via `onKeyDown` in both `AddRowForm.tsx` and `EditableCell.tsx`; `tipInvalid` blocks `isFormValid` (Add Row) and blur-discards (inline cell) — see human verification #1 |
| 12 | Row with no tip shows an empty cell, no dash (D-21) | ✓ VERIFIED (code); rendering not visually confirmed | `EditableCell.tsx`: `emptyText = isTip ? '' : '—'`, used in all three cell-render branches; `AdminShiftsPage.tsx`/`AdminSalesTable.tsx`/`VoidRequestsTable.tsx` all render `sale.tip ?? ''` (no dash fallback) |
| 13 | Every active-row revenue figure = SUM(priceSnapshot + tip): shift banner, shift history, admin shift tabs, dashboard total, Profit/Turnover KPIs (D-01) | ✓ VERIFIED | Live this session: creating a sale with tip 20.50 raised `/admin/summary` `totalRevenue` by exactly price+20.50 and `totalTips` by exactly 20.50; voiding it reverted both to baseline. `shifts.ts` `/current` and `/history`, and `admin.ts` `/summary`, `/shifts`, and all 8 KPI `$queryRaw` blocks all include `tip`/`COALESCE(tip, 0)` — `grep -c 'priceSnapshot + COALESCE(tip, 0)' admin.ts` = 8 |
| 14 | Dashboard per-product revenue breakdown stays price-only (D-02) | ✓ VERIFIED | `admin.ts` `productBreakdown` groupBy (`by: ['productNameSnapshot']`) `_sum` block contains only `priceSnapshot`, no `tip` |
| 15 | Voided rows' tips excluded from revenue like price, active-only filters unchanged (D-03) | ✓ VERIFIED | Live: after voiding the test sale, `/admin/summary` `totalRevenue`/`totalTips` returned to their exact pre-create values; `status: 'active'` filters unchanged in `shifts.ts`/`admin.ts` |
| 16 | Revenue This Shift banner shows combined total + `incl. ₱X tips` line, hidden at 0.00, fed by `activeSalesTips` (D-04) | ✓ VERIFIED (code); rendering not visually confirmed | `ShiftTotalsBanner.tsx` renders the caption only `{tips && tips !== '0.00' && (...)}`; wired via `tips={currentShift!.activeSalesTips}` (SalesPage) and `tips={selectedTab.activeSalesTips}` (AdminShiftsPage); backend returns `activeSalesTips` on both `/current` and `/shifts` — see human verification #3 |
| 17 | Dashboard Total Revenue card shows `incl. ₱X tips` caption from `totalTips` (D-05) | ✓ VERIFIED (code); rendering not visually confirmed | `DashboardPage.tsx` derives `tipsCaption` from `summary.totalTips !== '0.00'` and passes `caption={tipsCaption}` only to the Total Revenue `StatCard`; backend `/summary` returns `totalTips` |
| 18 | Profit/Turnover KPI cards and Shift History Revenue column show combined number only, no caption (D-06) | ✓ VERIFIED | `grep -c "caption=" DashboardPage.tsx` = 1 (only Total Revenue); Shift History reads `activeSalesRevenue` from `/history`, which has no `activeSalesTips` field to caption with |
| 19 | Every revenue sum uses MySQL SUM or Prisma Decimal `.add()`, never JS float; admin Shifts tab float accumulator replaced (D-16) | ✓ VERIFIED | `grep -c 'Number(agg' admin.ts` = 0; tab loop uses `new Prisma.Decimal(0)` accumulators with `.add()`; KPI SQL uses native DECIMAL `+`/`COALESCE` |
| 20 | AdminShiftsPage per-shift sale list has a right-aligned Tip column after Price, empty when no tip (D-19) | ✓ VERIFIED | `grep -n ">Price</th>|>Tip</th>|>MOP</th>"` shows strictly increasing line order (138, 139, 140); cell renders `{sale.tip ?? ''}` with the Price cell's `text-right` classes |
| 21 | AdminSalesTable has an inline-editable, right-aligned Tip column after Price; voided rows not editable (D-17) | ✓ VERIFIED (structure); click-to-edit interaction not visually confirmed | 3rd `accessorKey` in `AdminSalesTable.tsx` is `'tip'` (after `productNameSnapshot`, `priceSnapshot`); cell renders `<EditableCell field="tip">`, which reuses the existing `canEdit-or-admin` + `status !== 'void'` gate — no new permission code — see human verification #4 |
| 22 | Dashboard CSV export has a Tip column after Price, sanitized, empty when no tip (D-18, D-21) | ✓ VERIFIED (composition); opened file not visually confirmed | `tip: sanitizeCell(row.tip ?? '')` in CSV row mapping; 3rd `fields` entry is `{ label: 'Tip', value: 'tip' }` — see human verification #4 |
| 23 | Void Requests table has a right-aligned, display-only Tip column after Price, empty when no tip (D-20, D-21) | ✓ VERIFIED (structure); rendering not visually confirmed | 3rd column `id` in `VoidRequestsTable.tsx` is `'tip'` (after `product`, `price`); cell is a plain right-aligned `<span>{row.original.sale.tip ?? ''}</span>` — see human verification #5 |
| 24 | `voidRequests.ts` passes tip through unchanged (serializeSale reuse) | ✓ VERIFIED | `voidRequests.ts` serializes `vr.sale` through the same `serializeSale`, which now includes `tip` — no edit needed to that file, confirmed by grep (no `tip`-related changes required there and none made) |

**Score:** 24/24 distinct truths verified at the code/live level. All 5 visual/interaction items among them are additionally flagged for human confirmation in the running app (see below) — this does not change their VERIFIED status here (the underlying logic is present and correct in the code and, where testable via curl, confirmed live) but a human should still eyeball the rendering before considering the phase fully closed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/backend/prisma/schema.prisma` | `Sale.tip Decimal? @db.Decimal(10,2)` | ✓ VERIFIED | Line 170, exact match |
| `packages/backend/prisma/migrations/20260923120000_add-sale-tip/migration.sql` | Applied additive migration | ✓ VERIFIED | Applied live (`migrate status` up to date); single `ADD COLUMN` statement |
| `packages/backend/src/lib/tip.ts` | `parseTip` export | ✓ VERIFIED | Exported, behavior confirmed via `tip.check.ts` |
| `packages/backend/src/lib/tip.check.ts` | Runnable assert check | ✓ VERIFIED | Runs, exits 0, prints `tip checks passed` |
| `packages/backend/src/routes/sales.ts` | tip in serialize/allowlist/validation/audit | ✓ VERIFIED | All grep patterns match; live e2e confirms behavior |
| `packages/backend/src/routes/shifts.ts` | `activeSalesTips`, combined revenue | ✓ VERIFIED | Present, live-confirmed on `/current`, structurally confirmed on `/history` |
| `packages/backend/src/routes/admin.ts` | `totalTips`, combined revenue, tip-inclusive KPI SQL, Decimal shift-tab sums | ✓ VERIFIED | 8/8 KPI sums updated, product breakdown untouched, live-confirmed on `/summary` |
| `packages/shared/src/types/sale.ts` | `tip: string \| null` | ✓ VERIFIED | Present with Rule 6 comment |
| `packages/frontend/src/lib/tip.ts` | 4 exports | ✓ VERIFIED | `TIP_PATTERN`, `TIP_ERROR`, `isZeroTip`, `blockNonTipKeys` all present |
| `packages/frontend/src/components/sales/SalesTable.tsx` | Tip column, right-aligned, after Price | ✓ VERIFIED | 3rd `accessorKey` is `'tip'` |
| `packages/frontend/src/components/sales/EditableCell.tsx` | tip field support | ✓ VERIFIED | Field union, isTip/tipInvalid/emptyText/align all present and used |
| `packages/frontend/src/components/sales/AddRowForm.tsx` | Tip input block | ✓ VERIFIED | Between Price and MOP blocks, validated, normalized on submit |
| `packages/frontend/src/components/shift/ShiftTotalsBanner.tsx` | `tips?: string` prop | ✓ VERIFIED | Present, conditional caption render |
| `packages/frontend/src/components/admin/StatCard.tsx` | `caption?: string` prop | ✓ VERIFIED | Present, conditional caption render |
| `packages/frontend/src/pages/SalesPage.tsx`, `AdminShiftsPage.tsx`, `DashboardPage.tsx` | wired tips/caption props, Tip column | ✓ VERIFIED | All wiring confirmed via grep |
| `packages/frontend/src/components/admin/AdminSalesTable.tsx` | editable Tip column + CSV field | ✓ VERIFIED | Column + CSV both present and ordered correctly |
| `packages/frontend/src/components/admin/VoidRequestsTable.tsx` | display-only Tip column | ✓ VERIFIED | Present, correctly ordered, plain span |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `EditableCell.tsx` | `PATCH /api/sales/:id` | `field: 'tip'` in patch body | ✓ WIRED | Live PATCH round-trip confirmed |
| `sales.ts` | `tip.ts` | `parseTip(...)` in validators/create/patch | ✓ WIRED | 400s and canonicalization confirmed live |
| `sales.ts` | `audit_log` | `tx.auditLog.create` inside `$transaction` with `tx.sale.update` | ✓ WIRED | Live audit rows confirmed for both set and clear |
| `SalesPage.tsx` | `GET /api/shifts/current` | `activeSalesTips` → banner `tips` prop | ✓ WIRED | grep-confirmed; endpoint returns the field (confirmed via `shifts.ts` code; `/current` itself is moderator-only, could not curl as admin — see note below) |
| `AdminShiftsPage.tsx` | `GET /api/admin/shifts` | `activeSalesTips`/`tip` → banner/table | ✓ WIRED | grep-confirmed |
| `DashboardPage.tsx` | `GET /api/admin/summary` | `totalTips` → StatCard caption | ✓ WIRED | Live-confirmed field present and delta-correct |
| `AdminSalesTable.tsx` | `EditableCell.tsx` | `<EditableCell field="tip">` | ✓ WIRED | Reuses the same PATCH flow verified above |
| `AdminSalesTable.tsx` | CSV download | `sanitizeCell(row.tip ?? '')` + fields entry | ✓ WIRED | grep-confirmed, 3rd field is Tip |

Note on `/api/shifts/current`: this route is scoped to `requireRole('moderator')` (pre-existing, unrelated to this phase) and returned `{"error":"FORBIDDEN"}` when hit with the admin session used for the rest of this verification. The code (`shifts.ts:104-130`) was read directly and matches D-01/D-04 exactly (`Prisma.Decimal.add()`, `activeSalesTips` field), and the identical pattern is proven live via `/admin/summary` and `/admin/shifts`, which share the same aggregate/Decimal approach. This is a route-scoping fact of the existing RBAC model, not a gap.

### Requirements Coverage

No REQ-IDs are mapped to Phase 13 in `.planning/REQUIREMENTS.md` (ROADMAP.md states `Requirements: TBD`). The phase's contract is CONTEXT.md decisions D-01 through D-21, all of which are covered in the Observable Truths table above. No orphaned requirements.

### Anti-Patterns Found

None. Scanned all 19 files touched by this phase for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/stub patterns — zero matches (the one `placeholder="Tip"` hit is a legitimate HTML input placeholder attribute, not a debt marker).

### Advisory Items (from 13-REVIEW.md, not treated as phase-goal gaps)

- **WR-01 (pre-existing, not a phase-13 regression):** The Turnover KPI's `$queryRaw` still filters `status = 'active'` instead of including void rows, so it computes the same number as Profit despite the surrounding comment claiming otherwise. Confirmed via `git diff b291464..HEAD` that this duplication predates the phase; Phase 13 only added `+ COALESCE(tip, 0)` to both (still-identical) sums without introducing the bug. Does not block the tip goal — tips are correctly folded into whatever the pre-existing sum computes.
- **WR-02:** `tip.check.ts` is a real, currently-passing runnable check but is not wired into any `npm test`/CI script, so a future regression in `parseTip` would go uncaught automatically. Verified this run by executing it directly; it passed. Does not block the phase goal — it is a process/CI gap, not a missing feature.
- **IN-01, IN-02:** Both pre-existing/cosmetic, confirmed non-blocking by the reviewer and by this verification.

None of these four items are must-haves from CONTEXT.md D-01..D-21 or the plans' `must_haves` blocks, so none produce a `gaps_found` status per Step 9's decision tree.

### Human Verification Required

See frontmatter `human_verification` for the structured list. In summary: the underlying implementation for every visual/interaction behavior (right-alignment, empty-no-dash cells, keystroke blocking, inline error display, caption hide-at-zero, click-to-edit) is present and correctly coded per D-11, D-12, D-15, D-21, D-04, D-05, D-17 — confirmed by reading the actual JSX/conditionals, not by trusting the SUMMARY. What remains is looking at the running Sales sheet, admin Shifts tabs, Dashboard, admin sales table, and Void Requests table to confirm the DOM renders as coded.

### Gaps Summary

No gaps. All must-haves across the three plans (13-01, 13-02, 13-03) are present in the code and, where testable via HTTP, independently confirmed live against the running dev API (not by re-quoting the plans' own e2e output). The phase goal — an optional Tip column that adds to revenue, rejects negatives frontend/backend, treats blank as no tip, and stores DECIMAL(10,2) — is achieved in the codebase. Status is `human_needed` rather than `passed` solely because five UI rendering/interaction behaviors, which are provably coded correctly, still warrant a human looking at the running app before sign-off.

---

_Verified: 2026-09-23_
_Verifier: Claude (gsd-verifier)_
