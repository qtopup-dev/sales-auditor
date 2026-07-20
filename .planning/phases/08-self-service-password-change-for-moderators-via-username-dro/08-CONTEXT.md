# Phase 8: Self-service password change for moderators via username dropdown menu - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Let any logged-in user (admin or moderator) change their own password by clicking their username in the sidebar. Clicking opens a dropdown menu (replacing today's plain-text username + separate Log Out button) containing "Change Password" and "Log Out". "Change Password" opens a modal with new-password + confirm fields — no current-password confirmation. On success, all of that user's OTHER active sessions are invalidated; their current session stays logged in.

Admin-triggered password reset for other users (AUTH-07, Phase 2) is unchanged — this phase is purely self-service, for your own account.

</domain>

<decisions>
## Implementation Decisions

### Access & Scope
- **D-01:** Both roles get self-service password change — admin and moderator alike see the same dropdown + Change Password flow. No role branching in the UI or API for this feature (though the phase title mentions "moderators," the user confirmed admins get it too).

### Username Dropdown Menu
- **D-02:** The username dropdown fully replaces the current plain-text username (`AuthenticatedLayout.tsx` line 95) and the separate "Log Out" button below it (lines 96-102). Clicking the username toggles a dropdown containing two items: "Change Password" and "Log Out". Both actions that previously lived in the sidebar footer now live inside this one menu.

### Change Password Form
- **D-03:** Form has exactly two fields: New Password and Confirm New Password. No "current password" field — the user confirmed this explicitly (internal tool, small trusted team, acceptable risk) after being flagged that it means an already-logged-in unattended session could be used to change the password without re-proving identity.
- **D-04:** New password validation: minimum 8 characters — same rule as `registerValidation` in `packages/backend/src/routes/auth.ts` (invite registration). No additional complexity requirements (no forced number/symbol).
- **D-05:** Confirm field must match New Password exactly — standard client-side check before submit, plus server-side re-validation of the length rule (never trust client-only validation, per CLAUDE.md Rule 9 RBAC/validation pattern applied here to input validation generally).

### Session Invalidation Behavior
- **D-06:** On successful password change, invalidate all of the user's OTHER active sessions but explicitly preserve the current session (the one that made the change). This is different from admin-triggered reset (Phase 2 D-03), which kills every session for the target user including any the admin might coincidentally share. Implementation must exclude `req.sessionID` (or equivalent current-session identifier) from the session-invalidation query — cannot reuse the Phase 2 `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?` query verbatim, since that would also kill the current session.

### Post-Change UX
- **D-07:** On success, the modal shows an inline success message with a "Done" button — no auto-close timer. User dismisses it manually.
- **D-08:** On error (mismatched confirm field, new password too short, server error), show the error inline in the form — same pattern as the existing catalog/user modals (Phase 2 D-07). Form stays open, fields are not cleared, user corrects and resubmits.

### Claude's Discretion
- Exact bcrypt hashing call — reuse the existing `bcrypt.hash(newPassword, 12)` pattern (cost 12, per CLAUDE.md).
- Dropdown open direction (upward vs downward) — username sits at the bottom of the sidebar, so opening upward is likely correct, but exact positioning/animation is implementation detail.
- Click-outside / Escape-to-close behavior for the dropdown — standard dropdown UX, no need to specify.
- Exact API route naming (e.g., `POST /api/auth/change-password` vs `PATCH /api/users/me/password`) — follow existing REST conventions in the codebase.
- Client-side vs server-side-only enforcement of the confirm-field match — client-side check is a UX nicety; server only needs to validate the new password itself (confirm field never needs to reach the server).
- Modal component reuse — use the same shared Modal wrapper pattern already established for catalog/user forms if one exists.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture — non-negotiable locked decisions
- `CLAUDE.md` §Critical Architecture Rules — Rule 1 (express-session over JWT, session invalidation must be immediate), Rule 9 (backend enforces RBAC/validation — frontend checks are UI only).
- `.planning/STATE.md` §Key Decisions Locked — express-mysql-session pool separate from Prisma adapter; session cookie settings in `app.ts`.

### Prior art for this exact feature shape (admin-triggered reset)
- `.planning/phases/02-auth-catalogs/02-CONTEXT.md` §Implementation Decisions "Password Reset UX" (D-01–D-03) — the admin-reset flow this phase deliberately diverges from on session-invalidation scope (kill-all vs kill-others-keep-current).
- `packages/backend/src/routes/users.ts` (`POST /:id/reset-password`) — existing pattern for bcrypt hashing (cost 12) and direct-SQL session invalidation via `sessionPool.query('DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?', [targetId])`. This phase's query must additionally exclude the current session.
- `packages/backend/src/routes/auth.ts` — `registerValidation` (8-char minimum password rule to reuse), session field conventions (`req.session.userId`, `req.session.role`, etc.), existing `requireAuth` middleware pattern.

### Existing infrastructure this phase builds on
- `packages/frontend/src/layouts/AuthenticatedLayout.tsx` — Sidebar `SidebarContent` component. Lines 93-103 contain the plain-text username + separate Log Out button that this phase replaces with a dropdown. `handleLogout` (lines 35-40) is the existing logout logic to fold into the new dropdown.
- `packages/frontend/src/components/users/UserModal.tsx` — Existing modal pattern for user-related forms (reference for the Change Password modal's structure/styling).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/backend/src/lib/prisma.ts` — Prisma client singleton for the password hash update.
- `packages/backend/src/middleware/requireAuth.ts` — Confirms `req.session.userId` is set; this endpoint mounts under the existing authenticated router.
- `sessionPool` (mysql2 pool used in `users.ts` for direct session-table SQL) — reusable for the "kill others, keep current" DELETE query, adding an `AND JSON_EXTRACT(data, '$.id') != ?` (or equivalent exclusion by session ID) clause.
- `packages/frontend/src/stores/authStore.ts` — Zustand auth store already holds `user` (with `username`, `role`) — no new client state needed beyond dropdown open/closed and modal open/closed.

### Established Patterns
- bcrypt cost 12 for all password hashing (`bcrypt.hash(password, 12)`) — used consistently in `auth.ts` and `users.ts`.
- Direct SQL against the `sessions` table (not `req.sessionStore.all()` — RESEARCH.md Pattern 5 from Phase 2 established this is O(1) vs O(n)) for invalidating other users' sessions. Same approach applies here, scoped to "not my current session."
- Express-validator (`express-validator` v7) for request body validation — `body('newPassword').isLength({ min: 8 })` mirrors existing `registerValidation`.
- Modal-based forms with inline error/success states — established in Phase 2 catalog UI (D-07) and `UserModal.tsx`.

### Integration Points
- New backend route likely mounts on the existing authenticated router (protected by `requireAuth`) — no new middleware needed since the user is changing their own account, identified via `req.session.userId`.
- Frontend: `SidebarContent` in `AuthenticatedLayout.tsx` is the sole integration point — the dropdown and Change Password modal both originate from this component.

</code_context>

<specifics>
## Specific Ideas

- The core technical nuance to get right: the session-invalidation query must exclude the requester's own current session. The existing admin-reset query (`DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?`) deletes unconditionally — this phase needs the current session's identifier (likely `req.sessionID`, matched against a `JSON_EXTRACT(data, '$.id')` or similar column in the sessions table) added as an exclusion.
- No current-password field was a deliberate, confirmed choice — not an oversight. Don't add it back during planning/implementation without checking with the user first.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-self-service-password-change-for-moderators-via-username-dro*
*Context gathered: 2026-07-20*
