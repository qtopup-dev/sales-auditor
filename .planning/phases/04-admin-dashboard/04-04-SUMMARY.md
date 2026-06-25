---
plan: 04-04
phase: 4
title: "Frontend — UserModal, InviteModal, ResetPasswordModal"
subsystem: frontend
tags: [admin, modals, react-hook-form, clipboard, users]
completed_date: 2026-06-26
duration_minutes: 10
tasks_completed: 2
tasks_total: 2

dependency_graph:
  requires:
    - 04-01 (PATCH /api/users/:id/username endpoint)
  provides:
    - UserModal component (username edit + 409 conflict handling)
    - InviteModal component (invite URL display + clipboard copy)
    - ResetPasswordModal component (temp password display + clipboard copy)
  affects:
    - packages/frontend/src/components/users/UserModal.tsx (created)
    - packages/frontend/src/components/users/InviteModal.tsx (created)
    - packages/frontend/src/components/users/ResetPasswordModal.tsx (created)

tech_stack:
  added: []
  patterns:
    - react-hook-form v7 with setError for server-side 409 inline field errors
    - useMutation onError handler mapping HTTP 409 to form field error (not alert)
    - isPending ? undefined : onClose Modal lock pattern (CLAUDE.md Rule 10)
    - useState + setTimeout for 2-second clipboard copy feedback revert
    - useEffect([user, reset]) form reset when edit target switches

key_files:
  created:
    - packages/frontend/src/components/users/UserModal.tsx
    - packages/frontend/src/components/users/InviteModal.tsx
    - packages/frontend/src/components/users/ResetPasswordModal.tsx
  modified: []

decisions:
  - "UserModal useEffect resets form on user prop change — same modal instance reused across edit targets"
  - "InviteModal and ResetPasswordModal always closeable — data already generated server-side before modal opens"
  - "409 USERNAME_TAKEN mapped to setError('username') not page alert — inline error per D-21 and UI-SPEC"
  - "isAxiosError type-narrowing used before accessing err.response.status — matches ProductModal error pattern"
---

# Phase 4 Plan 04: Frontend UserModal, InviteModal, ResetPasswordModal Summary

Three user management modals consumed by UsersPage: UserModal for username edit with react-hook-form + inline 409 conflict error, InviteModal for invite URL display with 2-second clipboard copy feedback, and ResetPasswordModal for temp password display with clipboard copy.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create UserModal.tsx | eac551f | packages/frontend/src/components/users/UserModal.tsx (created) |
| 2 | Create InviteModal.tsx + ResetPasswordModal.tsx | eb88d8d | packages/frontend/src/components/users/InviteModal.tsx, ResetPasswordModal.tsx (created) |

## What Was Built

### UserModal.tsx

Username edit modal following the ProductModal.tsx pattern exactly:

- `react-hook-form` v7 with `useForm`, `register`, `handleSubmit`, `setError`, `reset`
- `useMutation` calls `PATCH /api/users/${user.id}/username`
- `onError` catches 409 and maps to inline `setError('username', { message: 'Username already taken.' })` — no alert
- `isPending ? undefined : onClose` passed to Modal — blocks Escape + backdrop during save (CLAUDE.md Rule 10)
- Button label changes to `'Saving Username...'` during in-flight request
- `useEffect([user, reset])` resets form when edit target switches between rows
- Client-side validation: required, minLength 2, maxLength 100 (D-20)

### InviteModal.tsx

Display-only modal for invite URL with clipboard copy:

- Receives `inviteUrl` prop (caller performs `POST /api/auth/invite` before opening modal)
- `navigator.clipboard.writeText(inviteUrl)` on Copy Link click
- `useState(false)` + `setTimeout(() => setCopied(false), 2000)` reverts label after 2 seconds
- Input field is `readOnly` with `onClick` select-all for easy copying
- `onClose` always a function — modal always closeable (data already generated)

### ResetPasswordModal.tsx

Display-only modal for temp password with clipboard copy:

- Receives `tempPassword` prop (caller performs `POST /api/users/:id/reset-password` before opening)
- `navigator.clipboard.writeText(tempPassword)` on Copy Password click
- Same 2-second `setTimeout` revert pattern as InviteModal
- `tracking-wider` Tailwind class on password field for readability
- `onClose` always a function — modal always closeable

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. All three modals receive pre-generated data as props (no empty/placeholder values). InviteModal and ResetPasswordModal display server-generated strings. UserModal pre-fills from the user prop.

## Threat Surface Scan

No new threat surface beyond what the plan's threat model covers:
- T-04-10: InviteModal URL displayed read-only in admin-only page — accepted per plan
- T-04-11: ResetPasswordModal temp password displayed once by design — accepted per plan
- T-04-12: No audit logging for username changes in v1 — accepted per plan

## Self-Check

Files exist:
- packages/frontend/src/components/users/UserModal.tsx — FOUND
- packages/frontend/src/components/users/InviteModal.tsx — FOUND
- packages/frontend/src/components/users/ResetPasswordModal.tsx — FOUND

Commits:
- eac551f — UserModal.tsx
- eb88d8d — InviteModal.tsx + ResetPasswordModal.tsx

TypeScript compilation: exits 0 (no errors across entire frontend tsconfig)

## Self-Check: PASSED
