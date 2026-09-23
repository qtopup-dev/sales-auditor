---
phase: 13-moderator-sales-sheet-tip-column
plan: 01
subsystem: sales
tags: [prisma, mysql, express-validator, react-hook-form, tanstack-react-table]

# Dependency graph
requires:
  - phase: 03-sales-core
    provides: sales.ts route (serializeSale, ALLOWED_PATCH_FIELDS, notes PATCH branch), SalesTable/EditableCell/AddRowForm components
provides:
  - Nullable sales.tip DECIMAL(10,2) column, live and migrated
  - parseTip — single backend source of tip validation/normalization rules
  - tip in serializeSale, ALLOWED_PATCH_FIELDS, create + PATCH validation, audited PATCH branch
  - Sale.tip: string | null shared type
  - Frontend tip.ts (TIP_PATTERN, TIP_ERROR, isZeroTip, blockNonTipKeys)
  - Editable, right-aligned Tip column on the moderator Sales sheet (Add Row + inline edit)
affects: [13-02-revenue-totals, 13-03-admin-tables]

# Actuals (#2632)
actuals:
  tokens: 6038
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Money-field PATCH branch: parseTip normalizes, canonical-value comparison skips no-op writes/audits, audit old/new via .toFixed(2)/'' (mirrors the notes branch but with money-specific normalization)"
    - "Frontend/backend regex parity: TIP_PATTERN (frontend) and parseTip's internal regex (backend) both source from the same D-13/D-14/D-15 rule and are commented to stay in sync"

key-files:
  created:
    - packages/backend/prisma/migrations/20260923120000_add-sale-tip/migration.sql
    - packages/backend/src/lib/tip.ts
    - packages/backend/src/lib/tip.check.ts
    - packages/frontend/src/lib/tip.ts
  modified:
    - packages/backend/prisma/schema.prisma
    - packages/backend/src/routes/sales.ts
    - packages/shared/src/types/sale.ts
    - packages/frontend/src/components/sales/EditableCell.tsx
    - packages/frontend/src/components/sales/SalesTable.tsx
    - packages/frontend/src/components/sales/AddRowForm.tsx

key-decisions:
  - "Tip PATCH reuses the exact same permission/ownership checks as notes (D-10) — no new RBAC code, just a new field branch after the existing canMutate check"
  - "0 / 0.00 normalizes to null at both parseTip (backend) and isZeroTip (frontend) so there is only one representation of 'no tip' (D-12)"
  - "Canonical-value comparison in the PATCH tip branch (parseTip(rawValue) vs sale.tip?.toFixed(2)) skips the write+audit entirely when unchanged, preventing phantom audit rows like '20.5' vs '20.50'"

patterns-established:
  - "Digit/decimal-only keystroke filter (blockNonTipKeys) shared between AddRowForm and EditableCell via packages/frontend/src/lib/tip.ts — first numeric-only input pattern in this codebase"

requirements-completed: [D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14, D-15, D-16, D-21]

coverage:
  - id: D1
    description: "sales.tip DECIMAL(10,2) NULL column applied to the live MySQL DB, Prisma client regenerated, migrate status up to date"
    verification:
      - kind: other
        ref: "npx prisma migrate status (from packages/backend) — Database schema is up to date!"
        status: pass
    human_judgment: false
  - id: D2
    description: "parseTip normalizes/validates tip strings per D-12..D-15 (0/0.00 -> null, >2 decimals rejected, >99999999.99 rejected, negatives/non-numeric rejected)"
    verification:
      - kind: unit
        ref: "packages/backend/src/lib/tip.check.ts — assert-based check, prints 'tip checks passed'"
        status: pass
    human_judgment: false
  - id: D3
    description: "PATCH /api/sales/:id tip branch validates, normalizes, writes, and audits a tip edit (fieldName 'tip', toFixed(2) old/new) in the existing transaction, using the existing permission gates"
    verification:
      - kind: e2e
        ref: "13-01-PLAN.md Task 1 <verify> automated e2e block — TRACER OK (PATCH 20.5->\"20.50\", -5/20.505/abc -> 400, 0 -> null, both audit rows present)"
        status: pass
    human_judgment: false
  - id: D4
    description: "POST /api/sales accepts an optional tip, validated/normalized the same way as PATCH, stored on create"
    verification:
      - kind: e2e
        ref: "13-01-PLAN.md Task 2 <verify> automated e2e block — CREATE OK (tip \"15\" -> \"15.00\", \"0.00\" -> null, -1/1.234 -> 400)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Moderator sheet Tip column (Product | Price | Tip | Mode of Payment order, right-aligned) editable via Add Row and inline PATCH, blocking non-numeric keystrokes, showing an inline error on invalid input, and rendering empty (no dash) when there is no tip"
    verification: []
    human_judgment: true
    rationale: "Keystroke blocking, inline error rendering, right-alignment, and empty-cell display are visual/interaction behaviors best confirmed by a human looking at the running Sales sheet rather than inferred from a curl-based e2e check."

duration: 45min
completed: 2026-09-23
status: complete
---

# Phase 13 Plan 01: Moderator Sales Sheet Tip Column Summary

**Nullable sales.tip DECIMAL(10,2) column, applied to the live DB, with backend parseTip validation/normalization, audited PATCH edits, and an editable right-aligned Tip column on the moderator sheet (Add Row + inline edit)**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2 completed
- **Files modified:** 10 (4 created, 6 modified)

## Accomplishments
- Applied the `sales.tip DECIMAL(10,2) NULL` migration to the live MySQL DB via the project's manual `db execute` + `migrate resolve` workflow, and regenerated the Prisma client
- Added `parseTip` (backend) as the single source of tip validation/normalization rules, with a runnable assert-based check (`tip.check.ts`) covering all null/canonical/throw cases from the plan
- Wired `tip` through `serializeSale`, `ALLOWED_PATCH_FIELDS`, create validation/data, and a new audited PATCH branch that mirrors the `notes` pattern but adds money-specific canonicalization and no-op-write skipping
- Added `Sale.tip: string | null` to the shared type
- Added the editable, right-aligned Tip column between Price and Mode of Payment on `SalesTable.tsx`, an `AddRowForm.tsx` Tip input, and tip-aware behavior in `EditableCell.tsx` (digit/`.`-only keystrokes, inline validation error, 0-to-blank normalization, empty-cell rendering with no dash)
- Verified end-to-end against the dev API on :3001: the tracer PATCH flow (`TRACER OK`) and the create flow (`CREATE OK`) both passed, including 400s for negative/non-numeric/over-precision tips and correct audit rows

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): tip column -> migration applied -> validated, audited PATCH -> serialized -> editable Tip cell** - `3dbab20` (feat)
2. **Task 2: Add Row tip entry + input rules (digits/'.' only, inline error, 0->blank, right-align, empty render)** - `abaf6e7` (feat)

## Files Created/Modified
- `packages/backend/prisma/schema.prisma` - added `tip Decimal? @db.Decimal(10, 2)` to `model Sale`
- `packages/backend/prisma/migrations/20260923120000_add-sale-tip/migration.sql` - additive `ALTER TABLE sales ADD COLUMN tip DECIMAL(10, 2) NULL`
- `packages/backend/src/lib/tip.ts` - `parseTip(raw): string | null`, the single backend source of tip value rules
- `packages/backend/src/lib/tip.check.ts` - runnable assert check of `parseTip` (`tip checks passed`)
- `packages/backend/src/routes/sales.ts` - `tip` in `serializeSale`, `ALLOWED_PATCH_FIELDS`, create validation/destructure/data, PATCH `tip` branch with audit, create-path validation
- `packages/shared/src/types/sale.ts` - `tip: string | null`
- `packages/frontend/src/lib/tip.ts` - `TIP_PATTERN`, `TIP_ERROR`, `isZeroTip`, `blockNonTipKeys`
- `packages/frontend/src/components/sales/EditableCell.tsx` - `'tip'` field union, tip-specific derived state, blur validation/discard, right-aligned tip input branch, invalidate `current-shift`/`admin-summary` on success
- `packages/frontend/src/components/sales/SalesTable.tsx` - Tip column (`accessorKey: 'tip'`) after Price, table `minWidth` raised to `1160px`
- `packages/frontend/src/components/sales/AddRowForm.tsx` - `tip` form field, Tip input block between Price and MOP, `tipW` column width slot, submit normalizes zero tip to blank

## Decisions Made
- Tip PATCH reuses the exact same permission/ownership checks as `notes` (D-10) — no new RBAC logic was added, only a new field branch inside the existing transaction after the existing `canMutate` check
- `0` / `0.00` normalizes to `null` at both `parseTip` (backend) and `isZeroTip` (frontend), keeping a single representation of "no tip" (D-12)
- The PATCH `tip` branch compares canonical values (`parseTip(rawValue)` vs `sale.tip?.toFixed(2) ?? ''`) before writing, skipping the write and audit entirely when unchanged — prevents phantom audit rows from equivalent representations like `"20.5"` vs `"20.50"`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The dev API on :3001 was already running as the user's own long-lived dev server at task start (per project memory), so per the plan's Task 1 step 10 instruction, a second instance was not started — the running server picked up all code changes via `tsx --watch`, confirmed by a manual health check before running the tracer.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `Sale.tip`, the generated Prisma client's `tip` field, and the shared `Sale.tip: string | null` type are all in place for Plan 13-02 (revenue totals, which reads `sale.tip`/`_sum.tip`) and Plan 13-03 (admin tables, which render `Sale.tip`)
- No blockers identified

---
*Phase: 13-moderator-sales-sheet-tip-column*
*Completed: 2026-09-23*

## Self-Check: PASSED
