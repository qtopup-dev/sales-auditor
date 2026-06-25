---
plan: 04-06
phase: 4
title: "Frontend — UsersPage full implementation"
subsystem: frontend
tags: [admin, users, react-table, pessimistic-ui, modals]
completed_date: 2026-06-26
duration_minutes: 3
tasks_completed: 1
tasks_total: 1

dependency_graph:
  requires:
    - 04-04 (UserModal, InviteModal, ResetPasswordModal components)
    - 04-01 (PATCH /api/users/:id/username backend endpoint)
  provides:
    - UsersPage full implementation (USERS-01 through USERS-06)
  affects:
    - packages/frontend/src/pages/UsersPage.tsx (replaced)

tech_stack:
  added: []
  patterns:
    - react-table v8 with ColumnDef, useReactTable, getCoreRowModel, flexRender
    - useQuery + useMutation from @tanstack/react-query v5
    - Separate pendingCanEditId + pendingResetId for independent per-row pessimistic state
    - Async handleInvite + handleResetPassword (not useMutation) for sequential fire-API-then-open-modal flow
    - isModerator guard hides canEdit toggle for admin rows (D-19)

key_files:
  created: []
  modified:
    - packages/frontend/src/pages/UsersPage.tsx

decisions:
  - "Two separate pending state vars (pendingCanEditId, pendingResetId) allow independent in-flight tracking per-row — row disabled if either matches"
  - "handleInvite and handleResetPassword are async functions not useMutation — simpler sequential fire-then-store-then-open pattern"
  - "canEdit toggle hidden for admin rows via isModerator check (D-19) — admin always has full access, toggle is meaningless"
  - "POST /api/auth/invite confirmed from auth.ts line 132 (not /invite-generate)"
---

# Phase 4 Plan 06: Frontend UsersPage Full Implementation Summary

Full user management page replacing the placeholder: react-table v8 users table with pessimistic per-row canEdit toggle and reset-password, invite moderator flow via POST /api/auth/invite, and all three modals wired (UserModal, InviteModal, ResetPasswordModal).

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Replace UsersPage.tsx placeholder with full user management | 177dca5 | packages/frontend/src/pages/UsersPage.tsx (replaced) |

## What Was Built

### UsersPage.tsx

Full user management page following ProductsPage.tsx pattern exactly (D-14):

- **USERS-01:** Users table with five columns: Username (200px), Role (100px), Edit Rights (110px), Status (90px), Actions (240px). Fetches all users via `GET /api/users` (active + inactive).

- **USERS-02:** "Invite Moderator" header button calls `POST /api/auth/invite`, stores `inviteUrl`, opens `InviteModal`. Button shows "Generating..." and disables during the POST.

- **USERS-03:** "Edit" button per row sets `modalTarget` to the row's user, opens `UserModal` pre-filled with current username.

- **USERS-04:** "Enable Editing" / "Disable Editing" toggle (moderator rows only) calls `PATCH /api/users/:id` with `{ canEdit: !user.canEdit }`. In-flight labels: "Enabling..." / "Disabling...". Admin rows show no toggle.

- **USERS-05/USERS-06:** "Reset Password" button per row calls `POST /api/users/:id/reset-password`, stores `tempPassword`, opens `ResetPasswordModal`.

- **Pessimistic pending state (CLAUDE.md Rule 10):** `pendingCanEditId` and `pendingResetId` track independent in-flight actions. All three action buttons in a row disable if either pending var matches the row's id.

- **Edit Rights column:** Admin rows display "—"; moderator rows display "Yes" (text-green-700) or "No" (text-gray-500).

- **StatusBadge:** Used for the Status column, `active={user.isActive}`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All data is fetched live from `GET /api/users`. Invite URL and temp password are server-generated strings received from real API calls before modals open. No placeholder values flow to the UI.

## Threat Surface Scan

No new threat surface introduced beyond the plan's threat model:
- T-04-16: POST /api/auth/invite requires admin session server-side — frontend button is convenience only
- T-04-17: canEdit PATCH requires admin role server-side — frontend disabled state is UI convenience only
- T-04-18: Session invalidation on reset is server-side — frontend has no visibility into session store
- T-04-19: tempPassword displayed once by design — accepted

## Self-Check

Files exist:
- packages/frontend/src/pages/UsersPage.tsx — FOUND

Commits:
- 177dca5 — feat(04-06): replace UsersPage placeholder with full user management

TypeScript compilation: exits 0 (no errors)

## Self-Check: PASSED
