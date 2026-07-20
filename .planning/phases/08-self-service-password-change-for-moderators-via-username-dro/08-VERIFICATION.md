---
phase: 08-self-service-password-change-for-moderators-via-username-dro
verified: 2026-07-20T17:30:00Z
status: gaps_found
score: 12/13 must-haves verified
overrides_applied: 0
gaps:
  - truth: "On success the modal shows a success message + a single 'Done' button (no auto-close)"
    status: partial
    reason: "True on the FIRST successful password change (manually verified by user end-to-end). However, ChangePasswordModal never resets its internal state (success flag, react-hook-form values/errors, mutation status) when it closes — the component only conditionally returns null, it never unmounts. Reopening the modal after a successful change (same page load, no refresh) shows the stale success screen again instead of the form, permanently blocking a second password change without a full page reload. The same root cause leaves a stale server-error banner visible on reopen after a failed submit."
    artifacts:
      - path: "packages/frontend/src/components/users/ChangePasswordModal.tsx"
        issue: "No useEffect/reset() tied to the `open` prop transitioning to false — `success` (useState), react-hook-form field/error state, and `mutation.isError`/`isSuccess` all persist across open/close cycles because the component stays mounted (early `if (!open) return null` does not reset state, only skips rendering)."
    missing:
      - "Reset `success` to false, call react-hook-form's `reset()`, and call `mutation.reset()` when the modal transitions to closed (or immediately before it reopens), e.g. via a `useEffect` keyed on the `open` prop, as specified in 08-REVIEW.md WR-01's suggested fix."
---

# Phase 8: Self-Service Password Change Verification Report

**Phase Goal:** Any logged-in user (admin or moderator) can change their own password from a username dropdown in the sidebar. On success, all of their OTHER active sessions are invalidated while their current session stays logged in.
**Verified:** 2026-07-20T17:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A logged-in user (admin or moderator) can change their own password via `POST /api/auth/change-password` | VERIFIED | `packages/backend/src/routes/auth.ts:236` — route registered with `requireAuth`; no role branching (D-01) |
| 2 | Server rejects a new password shorter than 8 characters with 400 `VALIDATION_ERROR` | VERIFIED | `auth.ts:32-36` `changePasswordValidation` uses `isLength({ min: 8 })`; `auth.ts:237-241` returns 400 `VALIDATION_ERROR` on failed validation |
| 3 | New password is stored as bcrypt hash (cost 12), never plaintext | VERIFIED | `auth.ts:246` `bcrypt.hash(newPassword, 12)`; hash written via `prisma.user.update` at line 250-253 |
| 4 | After a successful change, all of the user's OTHER active sessions are deleted | VERIFIED | `auth.ts:258-261` `DELETE FROM sessions WHERE JSON_EXTRACT(data,'$.userId')=? AND session_id != ?` |
| 5 | The requester's CURRENT session survives the change | VERIFIED | Same query excludes `req.sessionID` via `session_id != ?`; confirmed by human checkpoint (08-02-SUMMARY.md step 7 — window 1 stayed logged in) |
| 6 | Endpoint requires an authenticated session (401 otherwise) | VERIFIED | `requireAuth` middleware applied per-route at `auth.ts:236` (authRouter is mounted unauthenticated in app.ts) |
| 7 | Clicking the username in the sidebar opens a dropdown containing 'Change Password' and 'Log Out' | VERIFIED | `AuthenticatedLayout.tsx:120-141` (trigger button, `aria-haspopup="menu"`), `143-171` (panel with both items); human checkpoint step 1-2 confirmed |
| 8 | The dropdown replaces the old plain-text username + separate Log Out button | VERIFIED | No standalone `<p>{user?.username}</p>` or bare `onClick={handleLogout}` button remains in the file; single dropdown trigger renders `{user?.username}` (line 127) |
| 9 | Click-outside and Escape both close the dropdown | VERIFIED | `AuthenticatedLayout.tsx:48-55` (Escape via `keydown` listener), `58-65` (click-outside via `mousedown` + `menuRef.current.contains`); human checkpoint step 3 confirmed |
| 10 | 'Change Password' opens a modal with New Password + Confirm New Password fields | VERIFIED | `ChangePasswordModal.tsx:89-135` renders both labeled inputs; opened via `setPasswordModalOpen(true)` at `AuthenticatedLayout.tsx:153` |
| 11 | Confirm must match New Password (client-side) before submit; too-short and mismatch errors show inline | VERIFIED | `ChangePasswordModal.tsx:98-101` (`minLength: 8`), `122-125` (`validate: (value) => value === newPassword`); inline error `<p>` elements at 108-110, 132-134. Human checkpoint step 5 confirmed both messages render. (Note: see gap below — these error states are not cleared on modal close, so a stale error can be visible alongside a fresh attempt on reopen.) |
| 12 | On success the modal shows a success message + a single 'Done' button (no auto-close) | ⚠️ PARTIAL | TRUE on first use — `ChangePasswordModal.tsx:83-86` renders the exact success copy, `53-60` renders the single "Done" button, `onClose` requires an explicit click (no auto-close/timer). Human checkpoint step 6 confirmed this on first use. **FAILS on reopen**: component never resets `success`/form/mutation state on close (WR-01), so reopening the modal after a successful change re-renders directly into the stale success screen instead of the form, blocking a second password change without a full page reload. |
| 13 | 'Log Out' runs the existing `handleLogout` logic unchanged | VERIFIED | `AuthenticatedLayout.tsx:160-169` menu item calls `handleLogout()` (line 165) — `handleLogout` itself (lines 36-41) untouched from pre-phase code |

**Score:** 12/13 truths fully verified, 1 partial (truth #12 — first-use path passes, repeat-use path fails)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/src/routes/auth.ts` | `POST /api/auth/change-password` route + `changePasswordValidation` | ✓ VERIFIED | Route present at line 236, validation array at line 32, `sessionPool` imported at line 8. `npx tsc --noEmit` exits 0. |
| `packages/frontend/src/components/users/ChangePasswordModal.tsx` | Change Password modal form with success/error states | ⚠️ VERIFIED w/ defect | 144 lines, exists, substantive, wired (imported and rendered in AuthenticatedLayout). Functionally correct on first use; state-reset defect (WR-01) impairs repeat use. |
| `packages/frontend/src/layouts/AuthenticatedLayout.tsx` | Username dropdown menu wired to modal + logout | ✓ VERIFIED | Dropdown trigger/panel present, `ChangePasswordModal` imported and rendered at line 175 with `open`/`onClose` wired to local state. `npx tsc --noEmit` exits 0. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `auth.ts` change-password handler | `sessions` table | `sessionPool.query DELETE ... AND session_id != ?` | ✓ WIRED | Query present at `auth.ts:258-261`, bound params `[req.session.userId, req.sessionID]` |
| `auth.ts` change-password handler | `users` table | `prisma.user.update` scoped to `req.session.userId` | ✓ WIRED | `auth.ts:250-253`, `where: { id: req.session.userId!, organizationId: req.session.organizationId! }` — never reads `id` from request body |
| `ChangePasswordModal.tsx` | `/api/auth/change-password` | `api.post` | ✓ WIRED | `ChangePasswordModal.tsx:35` `api.post('/auth/change-password', { newPassword: data.newPassword })` — only `newPassword` sent, matches backend contract |
| `AuthenticatedLayout.tsx` | `ChangePasswordModal` | dropdown 'Change Password' item opens modal | ✓ WIRED | `setPasswordModalOpen(true)` at line 153 (menu item onClick), `<ChangePasswordModal open={passwordModalOpen} onClose={...} />` rendered at line 175 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ChangePasswordModal.tsx` | `mutation` (useMutation) | Real `api.post` call to live backend route, not stubbed | Yes — backend performs real `bcrypt.hash` + `prisma.user.update` + real `sessionPool.query` DELETE | ✓ FLOWING |
| `AuthenticatedLayout.tsx` | `user?.username` | `useAuthStore()` (existing pre-phase auth state) | Yes — not hardcoded, pre-existing store | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for the live end-to-end flow — a real dev server + two concurrent sessions is required to exercise session invalidation, and this exact flow was already executed and approved by the user via the Task 3 human checkpoint (08-02-SUMMARY.md), which is treated as the behavioral evidence for this phase. Static verification performed instead:

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend type-checks clean | `cd packages/backend && npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Frontend type-checks clean | `cd packages/frontend && npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| No stray current-password field added | `grep -c "currentPassword" auth.ts ChangePasswordModal.tsx` | 0 matches | ✓ PASS |
| Modal never resets state on close (WR-01 confirmation) | `grep "reset()|useEffect" ChangePasswordModal.tsx` | No matches — no reset/useEffect present | ✓ CONFIRMED (defect present) |

### Requirements Coverage

Requirement IDs for this phase (`PHASE8-SC1..SC5`) are phase-local, declared only in ROADMAP.md and PLAN frontmatter — by design they are not listed in `.planning/REQUIREMENTS.md` (confirmed: no `PHASE8-SC` matches found there), since REQUIREMENTS.md tracks the 57 v1 requirements and this is new scope added after v1. This is expected, not an orphan.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| PHASE8-SC1 | 08-02 | Username dropdown with Change Password + Log Out, replaces old footer, closes on Escape/click-outside | ✓ SATISFIED | Truths #7-9 verified above |
| PHASE8-SC2 | 08-02 | Change Password modal with New + Confirm fields, client-side match + length validation, inline errors | ✓ SATISFIED | Truths #10-11 verified above |
| PHASE8-SC3 | 08-01 | `POST /api/auth/change-password` updates caller's password hash (bcrypt cost 12), server-validates 8-char minimum | ✓ SATISFIED | Truths #1-3 verified above |
| PHASE8-SC4 | 08-01 | On success, user's other sessions invalidated, current session preserved | ✓ SATISFIED | Truths #4-5 verified above |
| PHASE8-SC5 | 08-02 | On success modal shows success message + Done button (no auto-close); server errors show inline | ⚠️ PARTIAL | Truth #12 — correct on first use, broken on reopen (WR-01) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/frontend/src/components/users/ChangePasswordModal.tsx` | 22-44 | Component holds `useState`/`useForm`/`useMutation` state that is never reset when `open` becomes `false`; component stays mounted and only conditionally renders `null` | ⚠️ Warning | Reopening the modal after a successful password change shows a stale success screen instead of the form (no way to change password again without a full page reload); reopening after a failed submit shows a stale error banner. Documented as WR-01 in 08-REVIEW.md. |
| `packages/backend/src/routes/auth.ts` / `packages/backend/src/routes/users.ts` | auth.ts:258-261 / users.ts:192-195 | Raw session-invalidation SQL (`DELETE FROM sessions WHERE JSON_EXTRACT(data,'$.userId')=?...`) duplicated across two route files | ℹ️ Info | Code duplication only — both queries are correct; no functional impact. Documented as IN-01 in 08-REVIEW.md. |

No blocker-level anti-patterns found. No TODO/FIXME/placeholder markers in either modified/created file.

### Human Verification Required

None outstanding. The primary end-to-end flow (dropdown open/close, modal validation, multi-session invalidation with current-session preservation, actual password change with old-password rejection, light/dark mode rendering) was already manually verified and approved by the user against the live dev server (08-02-SUMMARY.md, Task 3 checkpoint, all 10 steps passed). The remaining gap (WR-01 reopen-after-success behavior) is a deterministic code defect confirmed directly by static inspection — no additional human testing is needed to establish that it exists; a human would only need to re-verify after the fix is applied.

### Gaps Summary

12 of 13 must-have truths are fully and cleanly verified: the backend endpoint is authenticated, server-validates the 8-character minimum, hashes with bcrypt cost 12, updates only the caller's own row, and correctly invalidates every other session for that user while preserving the current one. The frontend dropdown correctly replaces the old sidebar footer, opens/closes via click and Escape/click-outside, and the modal correctly validates and submits on its first use — all confirmed both by direct code reading and by the user's own manual end-to-end verification.

The one gap is `ChangePasswordModal` never resetting its internal state (`success`, react-hook-form values/errors, mutation status) when the modal closes, because the component stays mounted and only conditionally renders `null` rather than being unmounted or explicitly resetting on the `open` prop transition. The practical consequence: a user who successfully changes their password, clicks "Done", and then reopens "Change Password" again in the same page session (no refresh) sees the stale success screen instead of the form — they cannot change their password a second time without a full page reload. The same defect leaves a stale error banner visible on reopen after a failed submit. This was not exercised by the user's manual checkpoint (which only tested a single change per session) but is confirmed present by direct source inspection: no `reset()` call or `useEffect` keyed on `open` exists anywhere in `ChangePasswordModal.tsx`.

This is a real, reproducible functional defect on the just-built feature's repeat-use path, not a cosmetic nitpick — it directly undermines "self-service" (a user should be able to change their password more than once without reloading the page). A fix is a small, contained change to `ChangePasswordModal.tsx` (add a `useEffect` on `open` that calls `setSuccess(false)`, `reset()`, and `mutation.reset()`), already specified in `08-REVIEW.md` WR-01.

---

_Verified: 2026-07-20T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
