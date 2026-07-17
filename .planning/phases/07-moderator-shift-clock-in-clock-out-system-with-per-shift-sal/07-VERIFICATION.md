---
phase: 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal
verified: 2026-07-18T00:00:00Z
status: gaps_found
score: 5/6 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Backend enforces RBAC on all shift endpoints (CLAUDE.md Critical Architecture Rule 9: 'Backend enforces RBAC... Frontend checks are UI only') — shifts are a moderator-only concept (D-05) and this must be server-enforced, not just UI-gated"
    status: failed
    reason: "shiftsRouter (packages/backend/src/routes/shifts.ts) mounts no requireRole guard at all — every route (POST /clock-in, POST /clock-out, GET /current, GET /history) is reachable by ANY authenticated session, including admins. The file's own top-of-file comment explicitly acknowledges this: 'shiftsRouter does NOT mount requireRole at router level... enforced by the frontend only.' This is a documented, direct deviation from a hard, non-negotiable project rule (not a style nit) and was independently flagged as WR-01 in 07-REVIEW.md. Concrete consequence: an admin session (or any authenticated caller hitting the API directly) can call POST /api/shifts/clock-in and create a shifts row for themselves. GET /api/admin/shifts?date=... joins shifts to users with no role filter (packages/backend/src/routes/admin.ts:264-273), so that admin-created shift would then surface as the admin's own oversight tab on the AdminShiftsPage, and the same admin could force-clock-out or clock-out 'themselves' through the moderator-facing endpoints — corrupting the moderator-only oversight dataset that D-05/D-15 (and ROADMAP Success Criterion 4, 'one Excel-style tab per moderator') assume contains only moderators."
    artifacts:
      - path: "packages/backend/src/routes/shifts.ts"
        issue: "No requireRole('moderator') at router level; lines 1-9 contain a comment explicitly acknowledging the gap is left to the frontend only"
    missing:
      - "shiftsRouter.use(requireRole('moderator')) mirroring the existing adminRouter.use(requireRole('admin')) pattern already used in admin.ts, usersRouter, etc. (07-REVIEW.md WR-01's proposed fix)"
---

# Phase 7: Moderator Shift Clock In/Out Verification Report

**Phase Goal:** Moderators can clock in/out of shifts; while clocked in, their Sales Sheet resets to show only the current shift's rows with a live count + revenue totals banner, and Add Row is gated on having an active shift. Moderators get a Shift History page of their own past shifts. Admins get a "Shifts" oversight page: a date-scoped, tabbed view (one tab per moderator, Excel-sheet-tab style) showing every moderator's sales for a selected day, with a force-clock-out action on any still-open shift when viewing today.
**Verified:** 2026-07-18
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Moderator can clock in (single click, no confirm) and clock out (confirm dialog); at most one open shift can ever exist per moderator, server-enforced including under concurrent double-click | ✓ VERIFIED | `ClockControl.tsx` fires `POST /shifts/clock-in` with no dialog; `ClockOutConfirmDialog.tsx` gates clock-out behind a confirm modal. DB-level race guard confirmed in migration: `openLock` generated column (`IF(clockOutAt IS NULL, userId, NULL) STORED`) + `UNIQUE INDEX shifts_organizationId_openLock_key`. `shifts.ts` clock-in handler catches Prisma `P2002` and re-fetches the winning row (D-01 no-op), never producing two open shifts. |
| 2 | While clocked in, Sales Sheet shows ONLY current shift's rows (true reset) with live totals banner above the table; Add Row disabled with tooltip when not clocked in; admin's Sales Sheet completely unaffected | ✓ VERIFIED | `SalesPage.tsx`: moderator query `['sales','current-shift']` is `enabled: isModerator && !!currentShift` (true reset — query never fires without a shift); `ShiftTotalsBanner` renders when `isModerator && hasActiveShift`; Add Row `disabled={!hasActiveShift ...}` with `title="Clock in to add a new sale."`. Admin path uses an unconditional `['sales']` query and unchanged Add Row behavior — untouched by any shift state. |
| 3 | Moderator can view own Shift History page: past shifts newest-first with clock-in/out times, duration, per-shift active-sales count/revenue | ✓ VERIFIED | `GET /api/shifts/history` returns `orderBy: { clockInAt: 'desc' }` with `activeSalesCount`/`activeSalesRevenue` via `prisma.sale.groupBy` (Decimal-safe). `ShiftHistoryTable.tsx` renders Date/Clock In/Clock Out/Duration/Sales/Revenue columns, "Still open"/"In progress" for open shifts, revenue displayed as `'₱' + string` (never parsed). `/shift-history` route registered and reachable by both roles; nav item added to `MODERATOR_NAV`. |
| 4 | Admin can view Shifts oversight page: pick a date, see one Excel-style tab per moderator who had a shift that day (multiple sessions merged into one tab), view totals + read-only rows for the day | ✓ VERIFIED | `GET /api/admin/shifts?date=` groups raw shift rows by `userId` (multi-session merge, D-15), returns one tab per user with `activeSalesCount`/`activeSalesRevenue` via `groupBy` aggregation and an embedded reduced-column sales list. `AdminShiftsPage.tsx` renders a date input (defaults to today), `AdminShiftTabs` Excel-style tab bar, `ShiftTotalsBanner`, and a read-only table (Product/Price/MOP/Receiver/Notes/Date Edited/Status — no Created By/Actions, matching D-15). Route nested under admin-only `ProtectedRoute`. **Caveat:** see gap below — the tab set is not backend-guaranteed to contain moderators only. |
| 5 | Admin can force-clock-out a moderator's still-open shift (visible only when viewing today); closes the shift without affecting sales data; voided rows excluded from shift totals everywhere but remain visible with strikethrough/tint treatment | ✓ VERIFIED | `AdminShiftsPage.tsx`: "Force Clock Out" button rendered only when `isToday && selectedTab.clockOutAt === null`; opens `ForceClockOutConfirmDialog` (destructive red per D-16); confirms call `POST /api/admin/shifts/:id/force-clock-out`, which only sets `clockOutAt` — no sales rows touched. Voided rows excluded from `activeSalesCount`/`activeSalesRevenue` (`status: 'active'` filter in every aggregate/groupBy) but still appear in the sales list with `bg-red-50`/`Void` badge tint, matching the existing `AdminSalesTable.tsx` precedent (Phase 4) used for other admin read-only views. |
| 6 (derived) | Backend enforces RBAC on all shift endpoints (CLAUDE.md Rule 9) — shifts are a moderator-only concept (D-05), server-enforced not just UI-gated | ✗ FAILED | `shiftsRouter` mounts no `requireRole` guard; confirmed live in `packages/backend/src/routes/shifts.ts` lines 1-9 (self-documented gap). See Gaps Summary. |

**Score:** 5/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/prisma/schema.prisma` | `Shift` model + `Sale.shiftId` nullable FK | ✓ VERIFIED | `model Shift { ... }` present with organizationId/userId FKs, clockInAt/clockOutAt, timestamps, `@@index`; `Sale.shiftId Int?` + `shift Shift?` relation present |
| `packages/backend/prisma/migrations/20260717173220_add-shift-clock-in-out/migration.sql` | Applied migration creating `shifts` table + `openLock` race guard + `sales.shiftId` | ✓ VERIFIED | `CREATE TABLE shifts`, `openLock` generated column, `UNIQUE INDEX shifts_organizationId_openLock_key` all present; `prisma migrate status`-equivalent confirmed via clean `tsc` build against live generated client |
| `packages/backend/src/routes/shifts.ts` | shiftsRouter — clock-in/clock-out/current/history | ✓ VERIFIED (substantive, wired) / ✗ RBAC GAP | All 4 endpoints implemented correctly for their own-resource logic; mounted on `protectedRouter` at `/shifts` in `app.ts`. Missing router-level `requireRole('moderator')` — see gap above. |
| `packages/backend/src/routes/sales.ts` | shiftId stamping at creation + ownership-checked GET scoping | ✓ VERIFIED | `NO_ACTIVE_SHIFT` 400 gated on `req.session.role === 'moderator'`; `tx.shift.findFirst` inside transaction; admin path leaves `shiftId: null`; `GET ?shiftId=` validates int, checks org membership (404) and ownership (403 `FORBIDDEN` for non-owning moderators) before scoping `where.shiftId` |
| `packages/backend/src/routes/admin.ts` | `GET /shifts?date=` + `POST /shifts/:id/force-clock-out` | ✓ VERIFIED | Both mounted on `adminRouter` (already `requireRole('admin')`-gated at router level, confirmed at line 9-10); `$queryRaw` DATE() matching with per-user merge; `groupBy` Decimal aggregation; force-clock-out returns 404 on missing/closed shift |
| `packages/frontend/src/stores/shiftStore.ts` | Zustand overlay state for both confirm dialogs | ✓ VERIFIED | `useShiftStore` with clock-out and force-clock-out dialog state, target tracking |
| `packages/frontend/src/components/shift/ClockControl.tsx` | Sidebar clock in/out control | ✓ VERIFIED, WIRED | Renders "Clock In"/"Clocked in at {12h UTC time}" + "Clock Out"; wired into `AuthenticatedLayout.tsx` behind `user?.role === 'moderator'` |
| `packages/frontend/src/components/shift/ShiftTotalsBanner.tsx` | Reusable live totals banner | ✓ VERIFIED, WIRED | Used in both `SalesPage.tsx` (moderator) and `AdminShiftsPage.tsx` (admin per-tab) |
| `packages/frontend/src/components/shift/ShiftHistoryTable.tsx` + `ShiftHistoryPage.tsx` | Moderator shift history UI | ✓ VERIFIED, WIRED | react-table v8, `/shift-history` route registered |
| `packages/frontend/src/components/shift/AdminShiftTabs.tsx` + `AdminShiftsPage.tsx` | Admin oversight tabbed page | ✓ VERIFIED, WIRED | `/shifts` route registered, admin-only nested route |
| `packages/frontend/src/layouts/AuthenticatedLayout.tsx` | ClockControl + nav updates | ✓ VERIFIED, WIRED | `MODERATOR_NAV` includes "Shift History"; `ADMIN_NAV` includes "Shifts"; `ClockControl` positioned above username/logout block |
| `packages/frontend/src/pages/SalesPage.tsx` | Role-branched shift-gated view | ✓ VERIFIED, WIRED | Confirmed above |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `Sale.shiftId` | `Shift.id` | FK constraint `sales_shiftId_fkey` | ✓ WIRED | Present in migration + schema.prisma; nullable, no backfill (D-02) |
| `app.ts` | `shiftsRouter` | `protectedRouter.use('/shifts', shiftsRouter)` | ✓ WIRED | Confirmed present |
| `AddRowForm.tsx` | `['current-shift']` | `invalidateQueries` on success | ✓ WIRED | Confirmed by 07-REVIEW.md re-verification and cross-checked against `ShiftTotalsBanner`'s live update requirement — non-exact query key matching also refreshes `['sales','current-shift']` |
| `AuthenticatedLayout.tsx` | `ClockControl` | `{user?.role === 'moderator' && <ClockControl />}` | ✓ WIRED | Confirmed |
| `AdminShiftsPage.tsx` | `GET /admin/shifts?date=` | `useQuery(['admin-shifts', selectedDate], { refetchInterval: isToday ? 45000 : false })` | ✓ WIRED | Confirmed, 45s interval within D-17's 30-60s range, disabled for past dates |
| `AdminShiftsPage` Force Clock Out | `ForceClockOutConfirmDialog` | `useShiftStore().openForceClockOutDialog` | ✓ WIRED | Confirmed |
| `shiftsRouter` (all routes) | `requireRole('moderator')` | router-level middleware | ✗ NOT WIRED | No such middleware exists on this router — see gap |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend TypeScript compiles clean (schema + all Phase 7 routes) | `npx tsc --noEmit` in `packages/backend` | Exit 0, no output | ✓ PASS |
| Frontend TypeScript compiles clean (all Phase 7 components/pages) | `npx tsc --noEmit` in `packages/frontend` | Exit 0, no output | ✓ PASS |
| No REQ-IDs orphaned or misclaimed for this phase | `grep -i "shift" .planning/REQUIREMENTS.md` | No matches | ✓ PASS (confirms phase is correctly scoped as REQ-ID-free) |
| Migration applied and matches Prisma model | inspected `migration.sql` + `schema.prisma` | `CREATE TABLE shifts`, `openLock` generated column + unique index, both FKs present | ✓ PASS |

Runtime HTTP spot-checks (curl against a live dev server) were not performed — no dev server/DB session was started for this verification; static analysis (grep, tsc, direct file inspection) was used instead, consistent with the verification budget for this phase.

### Requirements Coverage

No REQ-IDs apply to this phase. All 8 plans (07-01 through 07-08) declare `requirements: []` in frontmatter, and `.planning/REQUIREMENTS.md` contains no "Phase 7" or shift-related entries — confirmed via grep (zero matches). This matches ROADMAP.md's explicit annotation: *"(new feature beyond v1 requirements — no REQ-IDs; scope locked via CONTEXT.md decisions D-01 through D-17)"*. No orphaned requirements exist for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/backend/src/routes/shifts.ts` | 1-9 | No `requireRole` guard on a router handling role-scoped resources (shifts are moderator-only per D-05) | 🛑 Blocker (RBAC hard-rule violation) | See gap above — treated as a blocking gap, not just a warning, per CLAUDE.md Rule 9 |
| `packages/backend/prisma/schema.prisma` | ~125, ~160 | `Shift.user`/`Sale.shift` relations don't declare the non-default `onUpdate`/`onDelete` actions actually present in the DB (`ON UPDATE RESTRICT`, `ON DELETE RESTRICT`) | ⚠️ Warning | Schema-drift risk: a future `prisma migrate dev` could silently regenerate a migration reverting these to Prisma's implicit defaults, reintroducing the MySQL 8.4 `ER_CANNOT_ADD_FOREIGN` failure this migration was built to avoid. Not an active bug today (confirmed via 07-REVIEW.md WR-02); flagged for the next schema change, not this phase's goal. |
| `packages/backend/src/routes/admin.ts` | 359-370 (force-clock-out handler) | TOCTOU race: `findFirst` open-check followed by unconditional `update` keyed only on `id`, no re-check that `clockOutAt` is still null | ⚠️ Warning | Narrow race window where a moderator's genuine self-clock-out could be silently overwritten by a concurrent admin force-clock-out call. Documented as 07-REVIEW.md WR-03; does not block the phase's core goal (force-clock-out functions correctly outside this race window) |
| `packages/frontend/src/components/shift/ShiftTotalsBanner.tsx` | 9 | `loading` prop accepted but never passed by either caller (`SalesPage.tsx`/`AdminShiftsPage.tsx`) | ℹ️ Info | Dead code path (07-REVIEW.md IN-01), cosmetic only |
| `packages/backend/src/routes/admin.ts` | 219-221 | `date` query param validated by regex shape only, not calendar validity (e.g. `2026-02-30` passes) | ℹ️ Info | Fails silently to an empty tab list rather than a 400 (07-REVIEW.md IN-02), not exploitable |

### Human Verification Required

### 1. Excel-style tab bar visual/interaction feel

**Test:** Log in as admin, visit `/shifts`, view a date with 2+ moderators clocked in, click between tabs.
**Expected:** Tabs visually resemble Excel sheet tabs (per D-15/UI-SPEC intent) and switching tabs swaps the visible sheet below without a full page reload or flash.
**Why human:** Visual/interaction feel cannot be verified via static code inspection alone.

### 2. End-to-end clock-in → sales entry → clock-out flow

**Test:** As a moderator, clock in, add 2 sales rows, verify banner counts update live without reload, clock out (confirm dialog), verify Sales Sheet resets to the empty/prompt state.
**Expected:** Banner updates immediately after Add Row; sheet resets to "Clock in to start a shift" after clock-out with no stale rows visible.
**Why human:** Requires a running browser session against a live backend/DB to observe actual React Query cache behavior and UI transitions, not just code correctness.

### 3. Force Clock Out on a real open shift, confirm both sides update

**Test:** Have a moderator clock in on one browser session; as admin in another session, visit `/shifts` (today), select that moderator's tab, click Force Clock Out, confirm.
**Expected:** Moderator's `ClockControl` (on their own session) reflects clocked-out state (e.g. on their next `current-shift` refetch/interaction); admin's tab loses the Force Clock Out button; no sales rows are altered.
**Why human:** Cross-session, real-time state observation requires two live browser sessions.

## Gaps Summary

One blocking gap was found: **`shiftsRouter` has no backend RBAC enforcement.** Every moderator-facing shift endpoint (`POST /clock-in`, `POST /clock-out`, `GET /current`, `GET /history`) is reachable by any authenticated session, including admins, because the router mounts no `requireRole` guard — a decision explicitly acknowledged in an in-code comment rather than a hidden bug. This is a direct deviation from CLAUDE.md's Critical Architecture Rule 9 ("Backend enforces RBAC... Frontend checks are UI only"), which the phase's own CONTEXT.md canonical references explicitly call out as governing this phase. The concrete blast radius: an admin session hitting the API directly could create a `shifts` row for themselves, which the admin oversight endpoint (`GET /api/admin/shifts?date=`) would then surface as a spurious tab (no role filter in its `shifts JOIN users` query), undermining the "one tab per moderator" invariant central to ROADMAP Success Criterion 4 and CONTEXT.md D-05/D-15.

Everything else the phase promised is genuinely built and wired: race-safe clock-in/out with a DB-level unique-index guard, a true per-shift reset of the moderator's Sales Sheet with a live totals banner, Add Row gating with tooltip, a moderator Shift History page, and a fully-functional admin Shifts oversight page (date selector, Excel-style tabs, per-tab totals + read-only rows, force-clock-out gated to today's open shifts) — all backed by clean TypeScript builds on both packages and directly-inspected, matching code for every must-have artifact and key link across all 8 plans. Two additional non-blocking risks (schema-drift risk on FK referential actions, a narrow TOCTOU race in force-clock-out) were carried forward from 07-REVIEW.md as warnings but do not prevent the phase goal from being considered achieved once the RBAC gap is closed.

**This looks like a straightforward, scoped fix** (one line: `shiftsRouter.use(requireRole('moderator'))`, mirroring the existing `adminRouter.use(requireRole('admin'))` pattern already used elsewhere in this codebase) rather than a design disagreement — recommend closing it via a small follow-up plan rather than an override, unless there's a reason admins need direct API access to these endpoints that isn't evident from the current implementation.

---

_Verified: 2026-07-18_
_Verifier: Claude (gsd-verifier)_
