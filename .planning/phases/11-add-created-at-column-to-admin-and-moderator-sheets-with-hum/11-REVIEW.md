---
phase: 11-add-created-at-column-to-admin-and-moderator-sheets-with-hum
reviewed: 2026-07-29T22:36:23Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - packages/frontend/src/lib/dateTime.ts
  - packages/frontend/src/components/sales/SalesTable.tsx
  - packages/frontend/src/components/admin/AdminSalesTable.tsx
  - packages/frontend/src/components/sales/AuditDrawer.tsx
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-07-29T22:36:23Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the new shared `formatDateTime` utility (`dateTime.ts`) and the three call sites it was wired into for Phase 11 (`SalesTable.tsx`, `AdminSalesTable.tsx`, `AuditDrawer.tsx`). The formatter itself is correct and UTC-pinned per CLAUDE.md Rule 7, and the "drop the trailing UTC label" behavior in `AuditDrawer.tsx` was cross-checked against `11-DISCUSSION-LOG.md` — it is a deliberate, user-approved decision, not a regression, so it is not flagged below.

One genuine layout bug was found: `SalesTable.tsx`'s hardcoded table `minWidth` was not updated when the new "Created At" column was inserted, so the declared minimum width no longer matches the sum of declared column sizes. The remaining findings are minor robustness/consistency notes with no immediate user-facing impact.

## Warnings

### WR-01: Stale table `minWidth` after adding the "Created At" column

**File:** `packages/frontend/src/components/sales/SalesTable.tsx:176`
**Issue:** The table uses `table-layout: fixed` with an explicit `minWidth: '1060px'`. Before this phase, `1060` was exactly the sum of the 7 columns' declared `size` values (200+100+180+160+160+140+120). This phase inserted a new `createdAt` column with `size: 140` (line 62-73), bringing the true sum to `1200`, but the `minWidth` literal on line 176 was left at `1060`.

Because `table-layout: fixed` derives column widths from the header row's cell widths relative to the table's own width, at viewport/container widths between ~1060px and ~1200px the browser will proportionally compress all 8 columns to fit inside the stale 1060px floor instead of triggering the intended horizontal scroll (the `overflow-auto` wrapper on line 175 only kicks in once content exceeds the declared minimum). This means the two new date columns (and every other column) can render narrower than their declared `size`, contrary to the component's own stated design intent (comment at lines 125-128: column `size` values define "the initial layout ratio").

**Fix:**
```tsx
// SalesTable.tsx:176
<table className="w-full border-collapse" style={{ minWidth: '1200px', tableLayout: 'fixed' }}>
```
(1200 = 200 + 100 + 180 + 160 + 160 + 140 + 140 + 120, matching the current 8 column `size` values.)

## Info

### IN-01: `formatDateTime` has no guard against invalid/empty ISO input

**File:** `packages/frontend/src/lib/dateTime.ts:5-17`
**Issue:** `new Date(iso)` silently produces an `Invalid Date` for a malformed or empty string, and `Intl.DateTimeFormat.prototype.format()` throws a `RangeError: Invalid time value` when called on an `Invalid Date`. All current call sites pass a `Sale.createdAt`/`updatedAt` or `AuditEntry.createdAt` that the shared `Sale`/`AuditEntry` types guarantee as non-null strings from the API, so this is not currently reachable, and the phase's own threat model (T-11-01) explicitly accepts this risk as equivalent to the pre-existing `.replace().slice()` behavior it replaced. Noting only as a defensive-coding opportunity for future call sites.
**Fix:** Optional — wrap in a try/catch or validate `!isNaN(date.getTime())` before formatting, returning a fallback string (e.g. `'—'`) instead of letting the `RangeError` propagate to a render crash if a future caller ever passes untrusted/optional input.

### IN-02: Two separate `Intl.DateTimeFormat` instantiations per call

**File:** `packages/frontend/src/lib/dateTime.ts:6-17`
**Issue:** `formatDateTime` constructs two `Intl.DateTimeFormat` instances (one for the date part, one for the time part) on every call, and this function is invoked once per visible row/column across three components. This is purely a minor simplification opportunity, not a performance concern (out of v1 review scope) — flagged only as a code-quality note.
**Fix:** Could be combined into a single `Intl.DateTimeFormat` call using `month/day/year/hour/minute` options together and reformatted with a custom separator via `formatToParts`, but the current two-call approach is also perfectly readable; no action required.

### IN-03: Duplicate, divergent "has this row been edited" logic between the two sales tables

**File:** `packages/frontend/src/components/sales/SalesTable.tsx:80` and `packages/frontend/src/components/admin/AdminSalesTable.tsx:182`
**Issue:** `SalesTable.tsx` determines whether to show a "Date Edited" value using `sale.lastEditedById` truthiness, while `AdminSalesTable.tsx` uses `updatedAt !== createdAt` string comparison. Cross-checked against `packages/backend/src/routes/sales.ts` (lines 351, 423, 483, 532, 598) — every mutation path (update and void) sets `lastEditedById` in the same call that changes `updatedAt`, so the two checks currently agree in practice. However, this is two independent implementations of the same business rule; if a future backend code path ever updates a sale without setting `lastEditedById` (or vice versa), the moderator and admin sheets would silently disagree on whether a row shows as "edited."
**Fix:** Consider consolidating to a single shared predicate (e.g. a `hasBeenEdited(sale)` helper in a shared lib) used by both tables, so the two sheets can't drift apart. Not required for this phase — `AdminSalesTable.tsx`'s `updatedAt !== createdAt` comparison was explicitly required to stay unchanged by `11-01-PLAN.md`.

---

_Reviewed: 2026-07-29T22:36:23Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
