---
phase: 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal
plan: 03
subsystem: api
tags: [prisma, express, sales, shifts, rbac]

# Dependency graph
requires:
  - phase: 07 (plan 01, parallel wave)
    provides: Shift model + Sale.shiftId nullable FK in schema.prisma (merged separately)
provides:
  - POST /api/sales enforces D-03 (moderator must have an open shift) and D-05 (admin sales always shiftId: null)
  - GET /api/sales?shiftId=<id> ownership-checked shift-scoped query for the moderator Sales Sheet view (D-11)
  - serializeSale now returns shiftId (number | null)
affects: [07-plan-for-shifts-router, sales-page-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Active-shift lookup replicates the existing FK-lookup pattern (product/mop/receiver) inside the same $transaction as the sale insert and audit write"
    - "Ownership-checked query scoping: verify resource ownership (shift.userId) before using a client-supplied id to scope a list query — same discipline as row-level RBAC on mutation endpoints"

key-files:
  created: []
  modified:
    - packages/backend/src/routes/sales.ts

key-decisions:
  - "shiftId is never accepted from POST /api/sales request body — always derived server-side from tx.shift.findFirst against the caller's own session (T-07-07 mitigation)"
  - "Active-shift lookup and NO_ACTIVE_SHIFT rejection is gated on req.session.role === 'moderator' only — admins retain pre-Phase-7 behavior of creating sales with shiftId: null unconditionally (D-05)"

patterns-established:
  - "Pattern: ownership-checked optional query-scope param — validate shape (Number.isInteger, >=1) -> 400, fetch resource -> 404 if missing, check ownership (non-admin && not owner) -> 403, then apply to where clause"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-07-18
---

# Phase 07 Plan 03: Sales router shiftId stamping + ownership-checked shift scoping Summary

**POST /api/sales now stamps shiftId from the moderator's active shift (400 NO_ACTIVE_SHIFT if none open) while admin-created sales remain shiftId: null; GET /api/sales?shiftId= adds a 403-enforced ownership check so moderators cannot read another moderator's shift-scoped sales.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-18T17:33:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `serializeSale` returns `shiftId: number | null` in every sale response
- `POST /api/sales` performs an active-shift lookup (`tx.shift.findFirst({ clockOutAt: null })`) inside the existing transaction, gated on `req.session.role === 'moderator'`; throws `400 NO_ACTIVE_SHIFT` if no shift is open, otherwise stamps the new row's `shiftId`
- Admin-created sales are unaffected — `shiftId` stays `null` for admins exactly as before (D-05)
- `GET /api/sales?shiftId=<id>` is now a real, ownership-checked server-side query scope: validates the param is a positive integer (400), confirms the shift exists in-org (404), and rejects non-owning moderators (403) before scoping the `sales.findMany` where clause — satisfies threat T-07-06
- `GET /api/sales` with no `shiftId` param is completely unchanged in behavior (same where clause, same ordering)

## Task Commits

Each task was committed atomically:

1. **Task 1: sales.ts — shiftId at creation (role-gated), shiftId in serializer, ownership-checked GET scoping** - `cfc6eb1` (feat)

_Note: single-task plan; no plan-metadata commit is created in worktree mode (orchestrator handles that after merge)._

## Files Created/Modified
- `packages/backend/src/routes/sales.ts` - Added `shiftId` to `serializeSale`'s param type and return object; rewrote `GET /` handler to add ownership-checked optional `shiftId` query-scoping; inserted active-shift lookup + `NO_ACTIVE_SHIFT` rejection into the `POST /` transaction body, gated on moderator role, and added `shiftId` to the `tx.sale.create` data object

## Decisions Made
- `shiftId` is derived exclusively server-side from the caller's own session inside the transaction — never read from `req.body` (matches the existing `ALLOWED_PATCH_FIELDS` allowlist discipline used elsewhere in this file)
- The active-shift lookup query uses `clockOutAt: null` as the "open shift" marker, matching the shift-lifecycle contract defined by the parallel Plan 07-01 schema (`Shift.clockOutAt` nullable)

## Deviations from Plan

None - plan executed exactly as written. All three edits (EDIT 1 serializer, EDIT 2 GET handler, EDIT 3 POST transaction body) were applied verbatim per the plan's `<action>` spec.

## Issues Encountered

**Known integration point (expected per parallel-wave design, not a defect):** This plan runs in an isolated git worktree in parallel with Plan 07-01, which adds the `Shift` model and the nullable `Sale.shiftId` FK to `schema.prisma` in a *different* worktree. This worktree's copy of `schema.prisma` does not yet have those changes, so:
- `npx tsc --noEmit` in `packages/backend` currently reports 7 type errors, ALL of which trace directly to the missing `Shift` model / `Sale.shiftId` field (`Property 'shift' does not exist...`, `Property 'shiftId' is missing...`, `Object literal may only specify known properties, and 'shiftId' does not exist...`). No other/unrelated type errors were introduced.
- These errors are expected to resolve automatically once this branch is merged with Plan 07-01's schema + migration and `npx prisma generate` is re-run against the merged schema.
- Verified this is the sole cause by running `npx prisma generate` locally (using a copied `.env`, not committed) against the current unmodified schema and confirming the resulting error set only references `shift`/`shiftId` — no errors in files this plan didn't touch.
- Grep-based acceptance criteria (all 5 patterns: `shiftId: sale.shiftId`, `NO_ACTIVE_SHIFT`, `req.session.role === 'moderator'`, `shift.userId !== req.session.userId`, `tx.shift.findFirst`) all pass with exactly 1 match each, confirming the code matches the plan's `<interfaces>` spec precisely.

## Next Phase Readiness
- `packages/backend/src/routes/sales.ts` is ready to merge with Plan 07-01's schema changes; no further edits to this file are anticipated for Phase 7's sales-side integration
- Frontend Sales Sheet (a later plan) can call `GET /api/sales?shiftId=<own-shift-id>` for the per-shift view and `POST /api/sales` will naturally enforce the active-shift gate for moderators
- Full `tsc --noEmit` clean pass and end-to-end curl verification (per this plan's `<verification>` section) should be re-run by the orchestrator after the wave merge, once both Plan 07-01 and Plan 07-03 changes are combined

---
*Phase: 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: packages/backend/src/routes/sales.ts
- FOUND: cfc6eb1 (task commit)
- FOUND: 07-03-SUMMARY.md
