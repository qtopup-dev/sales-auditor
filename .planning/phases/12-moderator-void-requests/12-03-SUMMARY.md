---
phase: 12-moderator-void-requests
plan: 03
subsystem: ui
tags: [react, zustand, react-hook-form, react-query, react-table, void-request]

# Dependency graph
requires:
  - phase: 12-moderator-void-requests (plan 01)
    provides: VoidRequest Prisma model, VoidRequestStatus/VoidRequest shared types
  - phase: 12-moderator-void-requests (plan 02)
    provides: voidRequestsRouter (POST /void-requests, GET /void-requests/pending-sale-ids) — exact contract this plan codes against
provides:
  - Moderator-facing "Void Request" action button on the moderator's own active SalesTable rows, gated by role/ownership/status/pending-state
  - VoidRequestDialog — reason-entry modal with pessimistic-UI create-request round trip and 409 duplicate-pending handling
  - salesEditStore isVoidRequestDialogOpen/voidRequestTargetSaleId UI state
  - ['void-request-pending-sale-ids'] React Query key on SalesPage, moderator-only
affects:
  - 12-04 (admin Void Requests page + sidebar badge — invalidates the same ['void-request-pending-sale-ids'] query key after approve/reject)

# Actuals (#2632)
actuals:
  tokens: 3709
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Component-level useMemo column array (BASE_COLUMNS + inline actionsColumn) replacing a module-level ColumnDef array, so a react-table column definition can close over component state (pendingSet) — mirrors AdminSalesTable.tsx's existing useMemo pattern"
    - "Zustand UI-overlay dialog state pair (isXDialogOpen/xTargetId + open/close actions) extended for a second dialog, following the exact isVoidDialogOpen/voidTargetSaleId shape already established"

key-files:
  created:
    - packages/frontend/src/components/sales/VoidRequestDialog.tsx
  modified:
    - packages/frontend/src/stores/salesEditStore.ts
    - packages/frontend/src/components/sales/SalesTable.tsx
    - packages/frontend/src/pages/SalesPage.tsx

key-decisions:
  - "VoidRequestDialog's create-request mutation invalidates only ['void-request-pending-sale-ids'], not ['sales'] — creating a request changes nothing about the sale row itself, so refetching the full sheet would be a pointless round-trip (plan's explicit instruction)"
  - "SalesTable's Void Request button dispatches via useSalesEditStore.getState().openVoidRequestDialog(sale.id) (module-level getState call, not a destructured hook value) to match the existing Void button's dispatch idiom exactly, keeping grep-verifiable single-occurrence acceptance criteria intact"
  - "All gating in SalesTable (role, ownership, active status, pending state) is presentation only — CLAUDE.md Rule 9 / T-12-16 — the backend (Plan 12-02) re-derives every one of these checks server-side"

patterns-established:
  - "Second dialog pair on salesEditStore following the isVoidDialogOpen/voidTargetSaleId shape — future per-row modals on this store should follow the same isXDialogOpen/xTargetSaleId + openX/closeX naming"

requirements-completed: [PHASE12-SC1]

coverage:
  - id: D1
    description: "Void Request button appears only on a moderator's own active rows, disabled with the correct tooltip while a request is pending, invisible to admins and on voided/foreign rows"
    requirement: "PHASE12-SC1"
    verification:
      - kind: other
        ref: "grep-verified: sale.createdById ownership check, !isAdmin && !isVoided && isOwnRow gate, both UI-SPEC tooltip strings present verbatim in SalesTable.tsx"
        status: pass
      - kind: other
        ref: "npm run build --workspace=@alejinput/frontend — exits 0 after each task"
        status: pass
    human_judgment: true
    rationale: "No browser/Playwright tooling available in this worktree agent — the plan's 'Behavioral check against a running dev server' acceptance line (log in as moderator, submit a request, confirm button disables without reload; log in as admin, confirm no Void Request button/request) could not be executed here and is deferred to the orchestrator's post-merge verification, as instructed in this agent's dispatch context."
  - id: D2
    description: "VoidRequestDialog: labeled required textarea, pessimistic disable during round-trip, dismissal blocked mid-flight, 409 duplicate-pending vs. generic-failure branching, all copy verbatim from UI-SPEC"
    requirement: "PHASE12-SC1"
    verification:
      - kind: other
        ref: "grep-verified: all 6 UI-SPEC copy strings present exactly once; onClose={isPending ? undefined : handleClose}; response?.status === 409 branch present; rows={3}"
        status: pass
      - kind: other
        ref: "npm run build --workspace=@alejinput/frontend — exits 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "SalesPage fetches moderator-only pending-sale-ids, passes it to the moderator SalesTable call site only, mounts VoidRequestDialog gated on isModerator, admin call site and branch untouched, no polling introduced"
    requirement: "PHASE12-SC1"
    verification:
      - kind: other
        ref: "grep-verified: query key/endpoint match VoidRequestDialog.tsx and Plan 12-02's route; enabled: isModerator x3; refetchInterval absent; both <SalesTable> call sites still render"
        status: pass
      - kind: other
        ref: "npm run build --workspace=@alejinput/frontend — exits 0"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-08-09
status: complete
---

# Phase 12 Plan 03: Moderator Void Request UI Summary

**Gated "Void Request" action button + reason-entry dialog on the moderator's own Sales sheet, wired to the Plan 12-02 create/pending-sale-ids API contract with zero change to the admin Sales sheet**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-09T20:40:00+08:00 (approx.)
- **Completed:** 2026-08-09T20:48:33+08:00
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `salesEditStore.ts` extended with `isVoidRequestDialogOpen`/`voidRequestTargetSaleId` state and `openVoidRequestDialog`/`closeVoidRequestDialog` actions, placed alongside and mirroring the existing admin `isVoidDialogOpen`/`voidTargetSaleId` pair exactly — no server-derived data added to the store (D-05, CLAUDE.md isolation rule).
- New `VoidRequestDialog.tsx`: a `Modal`-wrapped, `react-hook-form`-driven reason textarea, `useMutation` posting to `POST /void-requests`, pessimistic disable of both footer buttons and the textarea during the round-trip, dismissal blocked mid-flight (`onClose={isPending ? undefined : handleClose}`), and a 409-vs-generic error branch narrowing the axios error to `response?.status`. On success it invalidates only `['void-request-pending-sale-ids']` (not `['sales']`, since creating a request doesn't change the sale row), resets the form, and closes.
- `SalesTable.tsx` restructured: the module-level `columns` array is now `BASE_COLUMNS` (the seven data columns, byte-identical to before), and the Actions column is built inside a `useMemo` that closes over a `pendingSet` derived from a new optional `pendingVoidRequestSaleIds` prop (defaults to `[]`, so the admin call site is unaffected). The new "Void Request" button renders only for `!isAdmin && !isVoided && isOwnRow`, disables itself while `pendingSet.has(sale.id)`, and carries the two exact UI-SPEC tooltip strings. The existing admin Void/Audit actions and voided-row status pill are untouched.
- `SalesPage.tsx` adds a fourth, moderator-gated `useQuery(['void-request-pending-sale-ids'])` against `GET /void-requests/pending-sale-ids`, passes the derived `pendingVoidRequestSaleIds` array to the moderator's `<SalesTable>` call site only, and mounts `<VoidRequestDialog />` gated on `isModerator`. No polling/`refetchInterval` introduced (D-08).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Void Request dialog state to salesEditStore and build VoidRequestDialog** - `fa8c33f` (feat)
2. **Task 2: Add the gated "Void Request" action button to the moderator SalesTable** - `d4217f9` (feat)
3. **Task 3: Wire the pending-sale-ids query and mount VoidRequestDialog on SalesPage** - `e413071` (feat)

**Plan metadata:** (docs commit follows, applied by orchestrator after wave merge — this plan ran in worktree mode)

## Files Created/Modified

- `packages/frontend/src/stores/salesEditStore.ts` - Added `isVoidRequestDialogOpen`/`voidRequestTargetSaleId` state + `openVoidRequestDialog`/`closeVoidRequestDialog` actions
- `packages/frontend/src/components/sales/VoidRequestDialog.tsx` - New: reason-entry modal, create-request mutation, pessimistic disable, 409 branch
- `packages/frontend/src/components/sales/SalesTable.tsx` - `columns` renamed to `BASE_COLUMNS`; Actions column moved into a `useMemo` closing over a new `pendingVoidRequestSaleIds` prop; added the gated Void Request button
- `packages/frontend/src/pages/SalesPage.tsx` - New moderator-only pending-sale-ids query, prop passed to the moderator `SalesTable`, `VoidRequestDialog` mounted for moderators

## Decisions Made

- The create-request mutation invalidates only `['void-request-pending-sale-ids']`, not `['sales']` — per the plan's explicit instruction, since a pending request changes nothing about the sale row's own data.
- The Void Request button's `onClick` calls `useSalesEditStore.getState().openVoidRequestDialog(sale.id)` directly (matching the existing Void button's dispatch idiom) rather than destructuring the action alongside `openVoidDialog`/`openAuditDrawer`, keeping the file's single mention of `openVoidRequestDialog` consistent with how the plan's acceptance criteria were written.
- Two doc comments were worded to avoid accidentally repeating `BASE_COLUMNS` / `VoidRequestDialog` a third time in their own files, so the plan's exact-count grep acceptance criteria (`BASE_COLUMNS` → 2, `VoidRequestDialog` → 2) hold precisely — a documentation-only adjustment with no behavioral effect.

## Deviations from Plan

None — plan executed exactly as written. All acceptance-criteria grep checks and `npm run build --workspace=@alejinput/frontend` were verified passing after every task.

## Issues Encountered

- The plan's `<verify>` blocks hardcode `cd "D:/project/custom projects/alejinput"` (the main repo path), which is not this worktree's root. Ran the equivalent build from the worktree root instead (`npm run build --workspace=@alejinput/frontend` from `D:\project\custom projects\alejinput\.claude\worktrees\agent-ae4591b9aecd39575`) so the build actually exercises this agent's changes rather than the main checkout's code. All three builds passed clean (tsc + vite build, exit 0).
- No browser/Playwright tooling is available to this worktree agent. Task 3's acceptance criteria include a "Behavioral check against a running dev server" line (moderator sees/uses the button; admin sees none of it). Per this agent's dispatch instructions, this is deferred to the orchestrator's post-merge verification — every other acceptance criterion (all grep checks, both build passes) was verified directly.

## User Setup Required

None — this is a pure frontend plan with no `.env`/database/migration dependency. The gitignored Prisma client under `packages/backend/src/generated/prisma/` was never touched or needed.

## Next Phase Readiness

- Plan 12-04 (admin Void Requests page + sidebar badge) can proceed independently — it invalidates the same `['void-request-pending-sale-ids']` query key introduced here after approve/reject, and touches an entirely disjoint file set (`VoidRequestsTable.tsx`, `ApproveVoidRequestDialog.tsx`, `VoidRequestsPage.tsx`, `router/index.tsx`, `AuthenticatedLayout.tsx`).
- The admin's Sales sheet is unchanged — `AdminSalesTable.tsx` was not touched, and `SalesTable`'s admin call site (`<SalesTable sales={adminSales} />`) still omits the new prop, which defaults to `[]`.
- Deferred: the two "Behavioral check against a running dev server" lines from this plan's acceptance criteria (Task 3, and the phase-level `<verification>` block's moderator/admin manual checks) require a running dev server and browser, which this worktree agent does not have. Flagged for the orchestrator's post-merge / phase-level UAT pass.
- No blockers.

---
*Phase: 12-moderator-void-requests*
*Completed: 2026-08-09*

## Self-Check: PASSED

- FOUND: packages/frontend/src/stores/salesEditStore.ts
- FOUND: packages/frontend/src/components/sales/VoidRequestDialog.tsx
- FOUND: packages/frontend/src/components/sales/SalesTable.tsx
- FOUND: packages/frontend/src/pages/SalesPage.tsx
- FOUND: commit fa8c33f (Task 1)
- FOUND: commit d4217f9 (Task 2)
- FOUND: commit e413071 (Task 3)
