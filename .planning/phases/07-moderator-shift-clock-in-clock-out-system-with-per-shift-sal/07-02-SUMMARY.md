---
phase: 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal
plan: 02
subsystem: api
tags: [express, prisma, typescript, shifts, race-condition, decimal]

# Dependency graph
requires:
  - phase: 07-01
    provides: shifts table, Prisma Shift model, openLock DB-level race guard, sales.shiftId FK column
provides:
  - shiftsRouter mounted at /api/shifts — clock-in (race-safe no-op), clock-out (own-shift-only), current (live totals), history (per-shift totals)
  - Shift and ShiftWithTotals shared TypeScript types exported from @alejinput/shared
  - Sale shared type extended with shiftId: number | null
affects:
  - 07-04 through 07-08 (frontend ClockControl, ShiftTotalsBanner, ShiftHistoryPage all consume these endpoints and shared types)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "P2002 catch-and-refetch pattern for race-safe create-or-return-existing endpoints (clock-in)"
    - "Own-resource-only mutation: shift to act on is always derived from req.session, never from request body/params (T-07-04)"
    - "Prisma aggregate/groupBy for Decimal-safe totals instead of JS-side summing (CLAUDE.md Rule 6)"

key-files:
  created:
    - packages/shared/src/types/shift.ts
    - packages/backend/src/routes/shifts.ts
  modified:
    - packages/shared/src/types/sale.ts
    - packages/shared/src/types/index.ts
    - packages/backend/src/app.ts

key-decisions:
  - "shiftsRouter mounts with no router-level requireRole — open to any authenticated user; admin-vs-moderator distinction is frontend-only (D-05), backed by the fact that organizationId/userId always come from req.session so no cross-user access is possible regardless of caller role"
  - "GET /api/shifts/current returns null (200) rather than 404 when not clocked in, matching the frontend's useQuery<CurrentShift | null> contract"

patterns-established:
  - "Race-safe create-or-return: attempt create, catch P2002, re-fetch and return the winning row instead of erroring — reusable for any other 'at most one active X' resource"

requirements-completed: []

# Metrics
duration: ~12min
completed: 2026-07-17
---

# Phase 07 Plan 02: Shift Clock In/Out API Summary

**shiftsRouter with race-safe clock-in (P2002 catch), own-shift-only clock-out, and Decimal-derived live/historical totals via Prisma aggregate/groupBy — mounted at /api/shifts**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-17T17:52:00Z (approx.)
- **Completed:** 2026-07-17T18:04:42Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `Shift` and `ShiftWithTotals` types added to `@alejinput/shared`; `Sale` type extended with `shiftId: number | null`
- `shiftsRouter` implements all four moderator-facing endpoints exactly per plan:
  - `POST /clock-in` — race-safe via DB-level `openLock` unique index + P2002 catch-and-refetch; no-ops (200) if already clocked in (D-01)
  - `POST /clock-out` — closes only the caller's own open shift, looked up entirely from `req.session` (T-07-04, no shiftId accepted from request body)
  - `GET /current` — returns `null` when not clocked in, else shift + `activeSalesCount`/`activeSalesRevenue` computed via `prisma.sale.aggregate` (Decimal-safe, CLAUDE.md Rule 6)
  - `GET /history` — caller's own past shifts newest-first, each annotated with totals via `prisma.sale.groupBy`
- `shiftsRouter` mounted on `protectedRouter` at `/shifts` in `app.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared types — shift.ts, sale.ts (add shiftId), index.ts barrel export** - `3b6d3a1` (feat)
2. **Task 2: shiftsRouter (clock-in, clock-out, current, history) + app.ts wiring** - `4a4b4af` (feat)

**Plan metadata:** (docs commit follows, applied by orchestrator after wave merge — this plan ran in worktree mode)

## Files Created/Modified

- `packages/shared/src/types/shift.ts` - `Shift` and `ShiftWithTotals` interfaces
- `packages/shared/src/types/sale.ts` - added `shiftId: number | null` field
- `packages/shared/src/types/index.ts` - barrel export for `Shift`, `ShiftWithTotals`
- `packages/backend/src/routes/shifts.ts` - `shiftsRouter` with clock-in/clock-out/current/history
- `packages/backend/src/app.ts` - import + mount `shiftsRouter` at `/api/shifts`

## Decisions Made

None beyond what the plan specified — plan's exact code blocks were used verbatim for both tasks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Copied generated Prisma client into worktree to unblock `tsc --noEmit`**
- **Found during:** Task 2 verification (`npx tsc --noEmit` in packages/backend)
- **Issue:** This worktree had no `packages/backend/src/generated/prisma/` directory (gitignored, Prisma-generated, not checked out by git — same class of issue as the `.env` files noted in Plan 01's summary). Without it, `tsc` failed with `Cannot find module '../generated/prisma/client.js'`, which cascaded into ~20 unrelated implicit-`any` errors across `admin.ts`, `auth.ts`, `catalog.ts`, and the new `shifts.ts` (all downstream of the unresolved Prisma types, not real bugs in those files).
- **Fix:** Copied `packages/backend/src/generated/prisma/` from the main working directory (`D:\project\custom projects\alejinput\packages\backend\src\generated\prisma`) into this worktree's identical path. No source files were modified by this fix — it only materializes a gitignored, machine-generated artifact that `prisma generate` would otherwise produce.
- **Files modified:** None (copied `src/generated/prisma/*`, which is gitignored and not committed)
- **Verification:** Re-ran `npx tsc --noEmit` in `packages/backend` — exits clean (0 errors) after the copy, confirming the prior errors were all attributable to the missing generated client, not to `shifts.ts` or `app.ts`.
- **Committed in:** N/A (gitignored artifact, not committed — matches how the main repo also excludes this directory from git)

---

**Total deviations:** 1 auto-fixed (1 blocking — missing gitignored generated artifact in a fresh worktree)
**Impact on plan:** No source-code impact. Plan's exact specified code was implemented verbatim in both tasks with zero logic deviations.

## Issues Encountered

Same worktree-isolation issue as Plan 01: gitignored generated/build artifacts (here, the Prisma client under `src/generated/`) are not present in a fresh worktree checkout. Resolved by copying from the main working directory, consistent with the precedent set in Plan 01's summary for `.env` files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `POST /api/shifts/clock-in`, `POST /api/shifts/clock-out`, `GET /api/shifts/current`, `GET /api/shifts/history` are all implemented and mounted; `Shift`/`ShiftWithTotals` types available from `@alejinput/shared` for frontend consumption.
- Plans 07-04 through 07-08 (frontend ClockControl, ShiftTotalsBanner, ShiftHistoryPage) can now build against these endpoints and shared types.
- No blockers. Runtime verification (curl against a live server) was not performed in this worktree session — TypeScript compilation and static acceptance-criteria greps (P2002 presence, route paths, totals fields, app.ts mount) all pass; the plan's manual curl verification steps are deferred to integration/manual testing since no dev server/DB session was started during this execution.

---
*Phase: 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: packages/shared/src/types/shift.ts
- FOUND: packages/backend/src/routes/shifts.ts
- FOUND: commit 3b6d3a1 (Task 1)
- FOUND: commit 4a4b4af (Task 2)
