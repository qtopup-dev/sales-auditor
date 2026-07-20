---
phase: 08-self-service-password-change-for-moderators-via-username-dro
plan: 02
subsystem: ui
tags: [react, react-hook-form, tanstack-query, tailwind, dropdown-menu]

# Dependency graph
requires:
  - phase: 08-self-service-password-change-for-moderators-via-username-dro
    provides: "POST /api/auth/change-password endpoint (08-01) — session-scoped update, invalidates other sessions, keeps current session alive"
provides:
  - "ChangePasswordModal component — two-field (New/Confirm) form with client-side length + match validation, success state with Done button"
  - "Username dropdown menu in AuthenticatedLayout sidebar footer (Change Password + Log Out), replacing the old plain-text username + separate Log Out button"
affects: [phase-08-summary]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Click-outside + Escape dropdown close pattern via useRef + mousedown/keydown listeners scoped to menuOpen state"
    - "Modal success-state footer swap: same Modal instance re-renders body+footer to a single 'Done' button on mutation success, no auto-close (Rule 10 pessimistic UI)"

key-files:
  created:
    - packages/frontend/src/components/users/ChangePasswordModal.tsx
  modified:
    - packages/frontend/src/layouts/AuthenticatedLayout.tsx

key-decisions:
  - "No current-password field on the modal — confirmed D-03, internal trusted-team tool"
  - "Only newPassword crosses the wire; confirmNewPassword is a client-only check (D-05)"
  - "Dropdown panel opens upward (bottom-full) since the trigger sits at the sidebar bottom"

patterns-established:
  - "SidebarContent-local dropdown/modal state (menuOpen, passwordModalOpen) — desktop <aside> and mobile drawer each render their own independent instance, no shared/global state needed"

requirements-completed: [PHASE8-SC1, PHASE8-SC2, PHASE8-SC5]

# Metrics
duration: ~15min (Tasks 1-2) + human verification pass
completed: 2026-07-20
---

# Phase 08 Plan 02: Self-Service Password Change Frontend Summary

**Username dropdown (Change Password + Log Out) replacing the sidebar's plain-text footer, wired to a new ChangePasswordModal that posts only newPassword to the Plan 01 endpoint and shows a success state confirming other sessions were signed out.**

## Performance

- **Duration:** ~15 min build (Tasks 1-2) + separate human verification checkpoint pass
- **Started:** 2026-07-20 (approx, Task 1 commit 16:24 local)
- **Completed:** 2026-07-20 (checkpoint approved after manual verification against local dev server)
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `ChangePasswordModal` renders New Password + Confirm New Password fields, blocks submit on mismatch/short password client-side, POSTs only `newPassword`, shows generic inline error on server failure, and swaps to a success message + single "Done" button (no auto-close) on success
- Sidebar footer in `AuthenticatedLayout.tsx` replaced with a username dropdown button (`aria-haspopup="menu"`, `aria-expanded`) that opens an upward panel containing "Change Password" and "Log Out", separated by a divider
- Dropdown closes on both Escape and click-outside; `handleLogout` reused unchanged for the "Log Out" menu item
- Full end-to-end flow manually verified by the user against the running local dev server: dropdown open/close behavior, modal validation (mismatch + too-short errors), multi-session invalidation (second window logged out while the originating session stays logged in), password actually changes (old password rejected, new password accepted), and correct rendering in both light and dark mode

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ChangePasswordModal component** - `e469485` (feat)
2. **Task 2: Replace sidebar footer with username dropdown wired to modal + logout** - `95023ed` (feat)
3. **Task 3: Verify the end-to-end self-service password change flow** - checkpoint:human-verify, no code commit (see below)

**Plan metadata:** (this commit)

## Files Created/Modified
- `packages/frontend/src/components/users/ChangePasswordModal.tsx` - New two-field Change Password form (react-hook-form + useMutation), client-side validation, success/error states
- `packages/frontend/src/layouts/AuthenticatedLayout.tsx` - Sidebar footer replaced with username dropdown (Change Password + Log Out), click-outside/Escape close handlers, ChangePasswordModal wired in

## Decisions Made
None beyond what the plan specified — implemented exactly as written (see `key-decisions` above, carried over from plan frontmatter).

## Deviations from Plan

None - plan executed exactly as written for Tasks 1-2. `npx tsc --noEmit` passed clean after both tasks with no fixes required.

## Human Verification Checkpoint (Task 3)

**Type:** checkpoint:human-verify
**Outcome:** Approved — "All steps passed"

The user manually ran all 10 verification steps from the plan against their local dev server (API on 3001, UI on 5173, logged in as `admin`):
1. Username dropdown opens upward with "Change Password" and "Log Out"; old plain-text footer confirmed gone
2. Escape and click-outside both close the dropdown
3. "Change Password" opens the modal with the expected title, fields, and footer
4. Mismatched passwords show "Passwords do not match."; a 5-char value shows "Password must be at least 8 characters."
5. Multi-session check: a second logged-in window was signed out after the password change in the first window; the first window (the one making the change) remained logged in
6. Success state showed the exact copy "Your password has been changed. You've been signed out of all other active sessions." with a single "Done" button and no auto-close
7. Logging out and back in with the new password succeeded; the old password no longer worked
8. Light and dark mode rendering of the dropdown panel and modal confirmed correct (backgrounds, borders, red error text)

No code changes were required as a result of this checkpoint — it is verification-only evidence that Tasks 1-2's implementation is correct end-to-end.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 08 frontend is complete and manually verified end-to-end. Combined with the Plan 01 backend endpoint, self-service password change (username dropdown → modal → API → session invalidation) is fully functional for both admin and moderator roles. No blockers for closing out Phase 08.

---
*Phase: 08-self-service-password-change-for-moderators-via-username-dro*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: packages/frontend/src/components/users/ChangePasswordModal.tsx
- FOUND: packages/frontend/src/layouts/AuthenticatedLayout.tsx
- FOUND: commit e469485
- FOUND: commit 95023ed
