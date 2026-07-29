---
phase: 11-add-created-at-column-to-admin-and-moderator-sheets-with-hum
verified: 2026-07-29T23:10:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Phase 11: Add "Created At" column to admin and moderator sheets with humanized date format Verification Report

**Phase Goal:** Add a "Created At" column to the moderator Sales sheet (mirroring the admin sheet's existing column, added in Phase 4), and reformat all date/time displays across both Sales sheets and the Audit Drawer to a humanized style (e.g. "July 29, 2026, 2:32 PM") — replacing the raw "YYYY-MM-DD HH:mm" format previously used in three separate local formatDateTime functions.
**Verified:** 2026-07-29T23:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Moderator `/sales` shows a "Created At" column, positioned before "Date Edited", humanized | ✓ VERIFIED | `SalesTable.tsx:61-73` — `accessorKey: 'createdAt'`, `header: 'Created At'`, renders `formatDateTime(sale.createdAt)`; column appears at line 62, before `updatedAt` column at line 75 |
| 2 | Every date/time on both Sales sheets and Audit Drawer renders as "Month D, YYYY, H:MM AM/PM" | ✓ VERIFIED | `dateTime.ts` formatter spot-checked with `2026-07-29T14:32:00.000Z` → produced `"July 29, 2026, 2:32 PM"` exactly matching spec. All 4 call sites (`SalesTable.tsx` createdAt/updatedAt, `AdminSalesTable.tsx` createdAt/updatedAt, `AuditDrawer.tsx` createdAt) use this shared formatter. Zero remaining `.replace('T', ' ').slice(0, 16)` occurrences in any of the three target files |
| 3 | Audit Drawer no longer shows trailing "UTC" text label | ✓ VERIFIED | `AuditDrawer.tsx:76-78` renders `{formatDateTime(entry.createdAt)}` only; `grep -c "} UTC"` returns 0 |
| 4 | All displayed timestamps remain raw UTC value — no timezone conversion applied | ✓ VERIFIED | `dateTime.ts` pins `timeZone: 'UTC'` in both `Intl.DateTimeFormat` calls (grep count = 2); no other timezone identifier used |
| 5 | Admin table's "never edited" em-dash behavior unchanged — still compares raw `updatedAt !== createdAt`, not formatted strings | ✓ VERIFIED | `AdminSalesTable.tsx:182` — `const hasEdits = updatedAt !== createdAt;` comparison untouched, only the display branch (`formatDateTime(updatedAt)`) changed |
| 6 | CSV export from admin sales table still succeeds and contains raw ISO-8601 createdAt/updatedAt (unchanged, machine-readable) | ✓ VERIFIED | `AdminSalesTable.tsx:44,46` — `createdAt: row.createdAt` and `updatedAt: row.updatedAt` write raw values into `sanitizedRows`, no `formatDateTime` call inside `downloadCSV` |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/frontend/src/lib/dateTime.ts` | Shared `formatDateTime(iso)` humanized UTC formatter | ✓ VERIFIED | Exists, exports `formatDateTime`, UTC-pinned twice, produces exact expected output format |
| `packages/frontend/src/components/sales/SalesTable.tsx` | New "Created At" column + humanized "Date Edited" | ✓ VERIFIED | Column added at correct position (line 62, before `updatedAt` at line 75); imports shared formatter (line 9); wired and rendering |
| `packages/frontend/src/components/admin/AdminSalesTable.tsx` | Humanized columns via shared formatter, local duplicate removed | ✓ VERIFIED | Local `function formatDateTime` (0 matches) removed; imports shared util (line 18); both call sites (lines 163, 185) use it |
| `packages/frontend/src/components/sales/AuditDrawer.tsx` | Humanized timestamp, no "UTC" suffix | ✓ VERIFIED | Imports shared util (line 6); renders `formatDateTime(entry.createdAt)` with no suffix text (line 77) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `SalesTable.tsx` | `lib/dateTime.ts` | `import { formatDateTime }` | ✓ WIRED | Line 9; used at lines 69 and 81 |
| `AdminSalesTable.tsx` | `lib/dateTime.ts` | `import { formatDateTime }` (replaces local def) | ✓ WIRED | Line 18; used at lines 163 and 185; local definition confirmed removed |
| `AuditDrawer.tsx` | `lib/dateTime.ts` | `import { formatDateTime }` | ✓ WIRED | Line 6; used at line 77 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `SalesTable.tsx` createdAt column | `sale.createdAt` | `Sale` prop passed from parent page, sourced from `GET /api/sales` (pre-existing, unchanged endpoint) | Yes — same field already flowing to `updatedAt`/other columns | ✓ FLOWING |
| `AdminSalesTable.tsx` createdAt/updatedAt columns | `row.createdAt` / `row.updatedAt` | `rows` prop, pre-existing endpoint, unchanged | Yes | ✓ FLOWING |
| `AuditDrawer.tsx` timestamp | `entry.createdAt` | `useQuery` → `GET /sales/:id/audit`, pre-existing endpoint, unchanged | Yes | ✓ FLOWING |

No new data sources were introduced by this phase — all three components consume fields (`createdAt`, `updatedAt`) that were already present and flowing through pre-existing, unmodified API endpoints. Only the display formatting changed.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `formatDateTime` produces expected humanized string | Node eval of the exact `dateTime.ts` logic against `2026-07-29T14:32:00.000Z` | `"July 29, 2026, 2:32 PM"` | ✓ PASS |
| Frontend builds clean (tsc + vite) | `npm run build --workspace=@alejinput/frontend` | Exit 0, `✓ built in 412ms` | ✓ PASS |
| Column ordering (createdAt before updatedAt) in moderator table | `grep -n "accessorKey: 'createdAt'\|accessorKey: 'updatedAt'"` | line 62 < line 75 | ✓ PASS |
| No raw-slice remnants in any of the 3 target files | `grep -c "replace('T', ' ').slice(0, 16)"` across all 3 files | 0 matches in each | ✓ PASS |
| Out-of-scope files (`AdminShiftsPage.tsx`, `ShiftHistoryTable.tsx`) untouched, per D-03 | `grep -n formatDateTime` on both | Both retain their own independent local `formatDateTime`/formatting logic, not pointed at shared util, not reformatted | ✓ PASS |

### Requirements Coverage

Phase 11 uses phase-local requirement IDs (`PHASE11-SC1..SC4`), not v1 `REQ-IDs`. Confirmed these are NOT present in `.planning/REQUIREMENTS.md` (expected — grep returned no matches) and ARE tracked in `.planning/ROADMAP.md` line 229: `**Requirements**: PHASE11-SC1..SC4 (phase-local — new feature beyond v1 REQ-IDs; scope locked via CONTEXT.md decisions D-01 through D-05)`.

| Requirement | Source | Description | Status | Evidence |
|-------------|--------|-------------|--------|----------|
| PHASE11-SC1..SC4 | ROADMAP.md line 229, PLAN frontmatter | Created At column on moderator sheet + humanized formatting across both sheets and Audit Drawer, scope locked to 3 files per D-01..D-05 | ✓ SATISFIED | All observable truths above verified; no orphaned requirements — the single declared ID group is claimed by the sole plan (`11-01-PLAN.md`) and fully implemented |

No orphaned requirements found — ROADMAP.md's `PHASE11-SC1..SC4` group is claimed in full by `11-01-PLAN.md`'s `requirements:` frontmatter field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `SalesTable.tsx` | 176 | Stale hardcoded `minWidth: '1060px'` — sum of column `size` values is now 1200px after the 8th column (`createdAt`, size 140) was added, but the literal wasn't updated | ⚠️ Warning | Previously identified in `11-REVIEW.md` as WR-01, still unresolved in the current code. At container/viewport widths between ~1060px and ~1200px, `table-layout: fixed` will proportionally compress all 8 columns below their declared `size`, instead of the intended horizontal scroll behavior. Does not prevent the "Created At" column from existing or displaying correct data — it is a responsive-layout cosmetic issue, not a goal blocker. Does not affect any of the phase's observable truths (column exists, correct position, correct format, correct data) |

No blocker-severity anti-patterns found. WR-01 does not block phase goal achievement (the column exists, is positioned correctly, and displays humanized data — the layout compression only affects visual width proportions at specific viewport ranges, not data correctness or presence).

**This looks like an outstanding review item, not a scope regression.** If the team wants this closed before considering the phase fully done, the fix is a one-line change already specified in `11-REVIEW.md` WR-01 (`minWidth: '1200px'`). Since it does not affect any must-have truth, artifact, or key link, it is reported here as an informational carryover rather than a gap.

### Human Verification Required

None. All must-haves were verifiable via static analysis (grep), the shared formatter's exact output was validated via direct execution of its logic, and the build was verified to succeed. No visual, real-time, or external-service behavior requires manual confirmation beyond what's already covered by the deterministic checks above (the humanized string format is fully deterministic given `Intl.DateTimeFormat` with fixed options).

### Gaps Summary

No gaps. All 6 must-have truths verified, all 4 required artifacts exist/substantive/wired, all 3 key links wired, requirements coverage complete with no orphans, build passes clean. One pre-existing, previously-flagged code review warning (WR-01, stale `minWidth`) remains open but does not block any observable truth — noted for awareness, not gating.

---

_Verified: 2026-07-29T23:10:00Z_
_Verifier: Claude (gsd-verifier)_
