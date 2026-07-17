# Phase 7: Moderator Shift Clock In/Out - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Moderators can clock in and out of shifts. While clocked in, their Sales Sheet resets to show only the current shift's rows, with a live count + revenue totals banner, and Add Row is gated on having an active shift. Moderators get a "Shift History" page listing their own past shifts. Admins get a new "Shifts" page: a date-scoped, tabbed view (one tab per moderator, Excel-sheet-tab style) showing every moderator's sales for a selected day, with a force-clock-out action on any still-open shift when viewing today.

No salary/pay computation is in scope — "per-shift-sal" in the phase slug is a truncation of "per-shift sales view" (confirmed against `STATE.md` §Roadmap Evolution), not payroll.

Delivers: new `Shift` model + `shiftId` FK on `Sale`, new `shiftsRouter` backend routes, moderator-side clock control + Shift History page, admin-side tabbed Shifts page with force-clock-out.

</domain>

<decisions>
## Implementation Decisions

### Shift ↔ Sales Association (schema)
- **D-01:** New `Shift` model: `id`, `organizationId`, `userId` (moderator), `clockInAt`, `clockOutAt` (nullable — null means still open), timestamps. One active (open) shift per moderator enforced server-side — a clock-in attempt while one is already open is rejected/no-ops into returning the existing open shift.
- **D-02:** `Sale.shiftId` — nullable FK to `Shift`. Nullable because all pre-Phase-7 sales rows have no shift context (accurate — they predate shift tracking). Every sale created going forward always has one, since Add Row requires an active shift (D-03). No backfill/placeholder shift needed.
- **D-03:** Add Row requires an active (open) shift. If not clocked in, the Add Row button is disabled/grayed with an explanatory tooltip (not hidden). Inline editing of already-existing rows is NOT gated by clock state — a moderator can still fix a cell on an old row after clocking out, subject to the existing Phase 3 edit-rights rules. Void is unaffected (admin-only already).
- **D-04:** Voided rows keep their original `shiftId` (full audit trail, shown with strikethrough per existing pattern) but are excluded from all shift totals (live banner, history, admin tabs) — count and revenue are active-only, consistent with the Phase 6 KPI active-only semantics for Transactions/Profit.
- **D-05:** Shifts are a moderator-only concept. Admins do not clock in/out. If an admin creates a sale directly (existing capability), its `shiftId` is null.
- **D-06:** No `AuditLog` schema changes. `Sale.shiftId` is sufficient for tracing which shift a sale belongs to — AUDIT-02/AUDIT-03 scope is untouched; clock in/out/force-close events are not written to the audit log.

### Clock In/Out Mechanics
- **D-07:** Clock In / Clock Out control lives in the sidebar, in `AuthenticatedLayout.tsx`, positioned above the username/logout block — moderator-only (not shown for admin role, mirrors the `MODERATOR_NAV` vs `ADMIN_NAV` split already in that file).
- **D-08:** Control shows a static clock-in time ("Clocked in at 9:03 AM") — no live-ticking elapsed timer, no client-side interval.
- **D-09:** Clocking IN is a single click, no confirmation. Clocking OUT shows a confirm dialog (same UX weight as the existing `VoidConfirmDialog.tsx` pattern — a new `ClockOutConfirmDialog` or similar).
- **D-10:** If a moderator closes their browser or their session expires while clocked in, the shift stays open indefinitely — no auto-close tied to logout or session expiry. It stays open until the moderator explicitly clocks out, or an admin force-closes it (D-16).

### Per-Shift View & Live Totals
- **D-11:** While clocked in, `SalesPage.tsx` resets to show ONLY rows belonging to the moderator's current active shift (`WHERE shiftId = currentShiftId`) — a true reset, not an add-on filter. Full history lives on the separate Shift History page (D-14).
- **D-12:** When NOT clocked in, `SalesPage.tsx` shows an empty/prompt state ("Clock in to start a shift") — no rows displayed, Add Row disabled per D-03.
- **D-13:** Live totals = count of active sales + sum of `priceSnapshot` for active sales, both scoped to the current shift. Displayed in a banner between the page header and the sales table (visual weight similar to `StatCard`). Updates via React Query invalidation on the moderator's own mutations (add row) — no interval polling needed since only the moderator can add to their own active shift (single-writer scenario).

### Shift History (moderator) & Admin Shifts (oversight)
- **D-14:** New "Shift History" item added to `MODERATOR_NAV` in `AuthenticatedLayout.tsx` — own page, moderator sees only their own past shifts. Each row: date, clock-in time, clock-out time (or "Still open"), duration, active-sales count, active-sales revenue.
- **D-15:** New "Shifts" item added to `ADMIN_NAV` — a single admin oversight page (`AdminShiftsPage.tsx`) that replaces the need for any separate/deferred admin oversight feature. Structure:
  - **Date selector** at the top, defaults to today.
  - For the selected date: a row of tabs across the top of the table, Excel-sheet-tab style — one tab per moderator who had at least one shift starting that date. Moderators with no shift that day get no tab (not shown as empty).
  - If a moderator clocked in/out multiple times on the same date, all their sales for that date are merged into ONE tab/sheet (not split per clock session).
  - Each tab shows the same live count + revenue totals banner the moderator sees on their own sheet (D-13), plus the row list.
  - Row columns match the moderator's own Sales Sheet view: Product, Price, MOP, Receiver, Notes, Date Edited, Status — no "Created By" column (redundant; the tab itself identifies the moderator).
  - **Read-only** — no Void or Audit buttons on this page. Admin uses the existing `DashboardPage` all-sales table or `SalesPage` for those actions.
- **D-16:** Force-close: when viewing today's date and a moderator's shift is still open, that moderator's tab shows a "Force Clock Out" button, gated behind a confirm dialog (same pattern as D-09). Calls a new endpoint that sets `clockOutAt = now()` on that shift on the admin's behalf.
- **D-17:** While viewing today's date, `AdminShiftsPage` polls on an interval (30-60s) to reflect other moderators' live activity — different from the moderator's own mutation-only refetch (D-13), since the admin isn't the one causing the mutations they're watching. Polling is not needed for past (non-today) dates — that data is static.

### Claude's Discretion
- Exact banner/tab visual styling details (spacing, exact Tailwind classes) beyond matching StatCard/existing patterns
- Exact backend route shape for `shiftsRouter` (e.g. `POST /api/shifts/clock-in`, `POST /api/shifts/clock-out`, `GET /api/shifts/current`, `GET /api/shifts/history`, `GET /api/admin/shifts?date=`, `POST /api/admin/shifts/:id/force-clock-out`) — planner may adjust exact paths/shapes as long as behavior matches the decisions above
- Whether the admin date selector is a native date input, a calendar picker component, or simple prev/next day arrows
- Exact polling interval within the 30-60s range
- Whether `ShiftHistoryPage` uses `@tanstack/react-table` or a simpler list — precedent favors react-table v8 given every other tabular view in the app uses it

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture — non-negotiable locked decisions
- `CLAUDE.md` §Critical Architecture Rules — Rule 2 (audit log same transaction — N/A here per D-06, but still governs Sale mutations), Rule 3 (soft-delete only — Shift has no delete concept but Sale's status handling must remain untouched), Rule 5 (organizationId on every business table — new `Shift` model must have it), Rule 6 (DECIMAL/string money for all shift revenue totals), Rule 7 (UTC everywhere — critical for "which date does this shift belong to" logic), Rule 9 (backend enforces RBAC — one-active-shift and admin-only force-close must be server-enforced, not just UI).
- `.planning/STATE.md` §Roadmap Evolution — "Phase 7 added: Moderator shift clock-in/clock-out system with per-shift sales view, shift history tab, and live shift totals" — confirms scope; no salary/payroll mentioned anywhere in `REQUIREMENTS.md` or `PROJECT.md`.
- `.planning/ROADMAP.md` §Phase 7 — goal marked `[To be planned]`, depends on Phase 6, 0 plans so far.

### Existing schema to extend (DO NOT restructure existing models)
- `packages/backend/prisma/schema.prisma` — Full file. Add `Shift` model (with `organizationId`, `userId`, `clockInAt`, `clockOutAt`) and a nullable `shiftId` FK + relation on the `Sale` model. Follow the exact style of existing models (Receiver model added in Phase 5 is the closest precedent for "add a new model + FK to Sale").

### Existing backend to reference
- `packages/backend/src/routes/sales.ts` — GET/POST/PATCH sales routes; POST handler needs to set `shiftId` from the moderator's active shift at creation time (transactional, same pattern as receiverId lookup added in Phase 5).
- `packages/backend/src/routes/admin.ts` — Precedent for `$queryRaw` UTC date-window queries (used for Phase 6 KPI Today/Yesterday/This Month/Last Month) — the admin Shifts page's date-scoped query follows the same UTC date-matching approach.
- `packages/backend/src/middleware/requireRole.ts` — Apply `requireRole('admin')` at router level for admin-only shift endpoints (force-close, admin shifts-by-date), same as `usersRouter`/`adminRouter` precedent.

### Existing frontend to reference
- `packages/frontend/src/layouts/AuthenticatedLayout.tsx` — Full file. Add clock in/out control above the username/logout block (moderator-only); add "Shift History" to `MODERATOR_NAV` and "Shifts" to `ADMIN_NAV`.
- `packages/frontend/src/pages/SalesPage.tsx` — Full file. Add shift-gating for Add Row (D-03), shift-scoped query (D-11), empty state (D-12), and totals banner (D-13).
- `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` — Visual/interaction pattern reference for the new clock-out confirm dialog (D-09) and force-clock-out confirm dialog (D-16).
- `packages/frontend/src/components/admin/StatCard.tsx` — Visual reference for the live totals banner (D-13) and per-tab totals on the admin Shifts page (D-15).
- `packages/frontend/src/components/admin/AdminSalesTable.tsx` — Reference for a read-only `@tanstack/react-table` v8 table rendering sales rows — closest precedent for each moderator's tab sheet on `AdminShiftsPage` (read-only, D-15).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VoidConfirmDialog.tsx` — pattern to clone for clock-out and force-clock-out confirm dialogs.
- `StatCard.tsx` — visual pattern to clone for the live totals banner.
- `AdminSalesTable.tsx` — read-only react-table v8 pattern to reuse for each admin Shifts tab's sheet.
- `Modal.tsx` — shared modal wrapper, available if any shift UI needs a modal beyond a confirm dialog.
- `$queryRaw` UTC date-window pattern from `admin.ts` (Phase 6 KPI queries) — directly reusable for "which shifts belong to date X" queries.
- `react-select`, `@tanstack/react-table` v8, `@tanstack/react-query` v5 — already installed, no new deps needed.

### Established Patterns
- organizationId scoping on every new table/query.
- Snapshot-at-creation philosophy: `shiftId` is set once at Sale creation and never changes, same as productId/mopId/receiverId snapshots.
- Pessimistic UI updates — clock in/out button disables during its own round-trip, same as every other mutation in the app.
- requireRole('admin') at router level for admin-only routes.
- React Query key + invalidation pattern: mutation success invalidates the relevant query key (e.g. `['current-shift']`, `['sales']`).

### Integration Points
- `AuthenticatedLayout.tsx` — sidebar insertion point above username/logout; nav array additions.
- `SalesPage.tsx` — Add Row button gating, query scoping, new totals banner section.
- `app.ts` — mount new `shiftsRouter` on `protectedRouter` (moderator + admin shift endpoints, following the `adminRouter`/`usersRouter` mounting precedent).
- `schema.prisma` — new `Shift` model + `Sale.shiftId` FK addition (creates a new migration).

</code_context>

<specifics>
## Specific Ideas

- The admin Shifts page tab bar is explicitly meant to feel like Excel sheet tabs at the bottom/top of a spreadsheet — one tab per moderator, switching tabs swaps the visible sheet below.
- "The same shift (for example, July 18 shift)" — the user thinks of a "shift" at the admin oversight level as a calendar-day grouping covering the whole day's coverage across all moderators, even though each moderator's underlying `Shift` record is still an individual clock-in/clock-out session. The admin page's date selector is what reconciles this: it groups/filters individual shift records by the calendar date they started on.
- Force-close was originally going to be a bare minimal list (moderator name + button); the user redirected this into being folded directly into the tabbed Shifts page instead — no separate minimal-list page needed.

</specifics>

<deferred>
## Deferred Ideas

- Admin editing or voiding rows directly from the `AdminShiftsPage` — use the existing `DashboardPage` all-sales table or `SalesPage` instead (D-15 keeps this page read-only).
- Charts/analytics comparing moderators' shift performance — not requested, would be a future phase.
- Shift-based audit trail (logging clock-in/out/force-close as audited events) — explicitly declined (D-06); `Sale.shiftId` is considered sufficient.
- Auto-closing shifts on logout/session expiry — explicitly declined (D-10); shifts stay open indefinitely until explicit action.

</deferred>

---

*Phase: 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal*
*Context gathered: 2026-07-18*
