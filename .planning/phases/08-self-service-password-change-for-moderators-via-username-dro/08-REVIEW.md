---
phase: 08-self-service-password-change-for-moderators-via-username-dro
reviewed: 2026-07-20T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - packages/backend/src/routes/auth.ts
  - packages/frontend/src/components/users/ChangePasswordModal.tsx
  - packages/frontend/src/layouts/AuthenticatedLayout.tsx
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-07-20
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the self-service password-change feature: the backend `POST /api/auth/change-password` route, the `ChangePasswordModal` component, and its wiring into `AuthenticatedLayout`'s new username dropdown.

Backend logic is solid: `requireAuth` guards the route, the update is scoped to `id + organizationId` from the session (never the request body, satisfying CLAUDE.md Rule 9), bcrypt cost factor 12 matches project convention, password hashing happens before the DB write, and the "kill other sessions but keep the current one" logic correctly excludes `req.sessionID`. No injection, hardcoded-secret, or auth-bypass issues found.

One functional bug was found on the frontend: `ChangePasswordModal` never unmounts (the parent always renders it and it internally returns `null` when closed), so its `success` flag, react-hook-form values, and mutation status all persist across open/close cycles. This causes the modal to reopen directly into the "success" screen (or a stale server-error message) after its first use in a session, effectively blocking a user from changing their password a second time without a full page reload. One minor code-duplication item (raw session-invalidation SQL repeated between `auth.ts` and `users.ts`) is also noted.

## Warnings

### WR-01: ChangePasswordModal state is not reset on close, breaking repeat use

**File:** `packages/frontend/src/components/users/ChangePasswordModal.tsx:22-44`
**Issue:** `AuthenticatedLayout`'s `SidebarContent` always renders `<ChangePasswordModal open={passwordModalOpen} onClose={...} />` (line 175 of `AuthenticatedLayout.tsx`); the component itself just returns `null` when `open` is `false` (line 44). Because the function component never actually unmounts, its `useState` (`success`), `useForm` (field values, validation errors), and `useMutation` (`isError`/`isSuccess` status) all persist across every open/close cycle.

Concretely reproducible sequence:
1. Open "Change Password", submit successfully → `success` becomes `true`, success screen shown, user clicks "Done" → `onClose()` sets `passwordModalOpen` to `false`.
2. Open "Change Password" again (same page load, no refresh) → the component re-renders with the *same* `success === true` from step 1, so it immediately shows "Your password has been changed..." with only a "Done" button — the form never appears. The user cannot change their password again without a full page reload.

The same root cause also leaves a stale server-error banner visible on reopen after a failed submit (`mutation.isError` persists), and leaves the previously typed password values sitting in react-hook-form's internal state (repopulated into the recreated `<input>` elements on reopen).

**Fix:** Reset local state whenever the modal transitions to closed (or immediately before it opens), e.g.:
```tsx
import { useEffect, useState } from 'react';
// ...
const {
  register,
  handleSubmit,
  watch,
  reset,
  formState: { errors },
} = useForm<ChangePasswordFormData>();

const mutation = useMutation({ /* ... */ });

useEffect(() => {
  if (!open) {
    setSuccess(false);
    reset();
    mutation.reset();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open]);
```

## Info

### IN-01: Session-invalidation SQL duplicated between auth.ts and users.ts

**File:** `packages/backend/src/routes/auth.ts:258-261`
**Issue:** The raw `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?` query (and its comment explaining the `JSON_EXTRACT` approach) is now duplicated in two places — `packages/backend/src/routes/users.ts:192-195` (admin reset, deletes all sessions) and here (self-service change, deletes all-but-current). Both encode the same MySQL-specific assumption about the `sessions` table schema (`ASSUMPTION A2` in the users.ts comment).
**Fix:** Extract a shared helper in `lib/` (e.g. `lib/sessions.ts`) such as:
```ts
export async function invalidateUserSessions(userId: number, exceptSessionId?: string): Promise<void> {
  const sql = exceptSessionId
    ? `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ? AND session_id != ?`
    : `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?`;
  const params = exceptSessionId ? [userId, exceptSessionId] : [userId];
  await sessionPool.query(sql, params);
}
```
so the schema assumption lives in one place and both routes call it.

---

_Reviewed: 2026-07-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
