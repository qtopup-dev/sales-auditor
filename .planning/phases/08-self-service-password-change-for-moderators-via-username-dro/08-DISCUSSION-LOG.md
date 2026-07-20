# Phase 8: Self-service password change for moderators via username dropdown menu - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 08-self-service-password-change-for-moderators-via-username-dro
**Areas discussed:** Access & menu, Password form, Session behavior, Post-change UX

---

## Access & Menu

| Option | Description | Selected |
|--------|-------------|----------|
| Moderators only | Matches the phase title exactly. Admins keep no self-service option. | |
| All users incl. admins | Same dropdown + Change Password flow shown to admin and moderator alike. | ✓ |

**User's choice:** All users incl. admins
**Notes:** One implementation, no role branching needed.

| Option | Description | Selected |
|--------|-------------|----------|
| Change Password + Log Out | Dropdown fully replaces today's plain-text username + separate Log Out button. | ✓ |
| Change Password only | Log Out stays exactly where it is today; dropdown added just for the new action. | |

**User's choice:** Change Password + Log Out

---

## Password Form

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, required | Prevents unattended-session account takeover. | |
| No, not required | User is already authenticated via session — faster flow. | ✓ |

**User's choice:** No, not required
**Notes:** Confirmed explicitly after being flagged that this allows changing the password without re-proving identity at an unattended, already-logged-in session. User confirmed acceptable risk for an internal tool with a small trusted team.

| Option | Description | Selected |
|--------|-------------|----------|
| Same as invite (8 char min) | Reuse existing registerValidation rule. | ✓ |
| Stricter (specify) | User has a specific stronger rule in mind. | |

**User's choice:** Same as invite (8 char min)

---

## Session Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Kill others, keep this one | Current session stays logged in; all OTHER active sessions for that user are destroyed. | ✓ |
| Kill all, incl. current | Mirrors admin-reset (D-03) exactly — forced re-login. | |
| Don't touch any sessions | Only the password hash changes. | |

**User's choice:** Kill others, keep this one
**Notes:** Requires excluding the current session ID from the invalidation query — cannot reuse the Phase 2 admin-reset query verbatim.

---

## Post-Change UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline success, auto-close | Modal shows success message, then auto-closes after a short delay. | |
| Inline success, manual close | Modal shows success message with a "Done" button — user closes it themselves. | ✓ |

**User's choice:** Inline success, manual close

---

## Claude's Discretion

- Exact bcrypt hashing call parameters (reuse cost 12 pattern)
- Dropdown open direction (upward vs downward) and animation
- Click-outside / Escape-to-close behavior for the dropdown
- Exact API route naming
- Client-side vs server-side-only enforcement of confirm-field match
- Error UX pattern (reuse existing inline form error pattern from catalog/user modals — no real choice needed, existing pattern applies)
- Modal component reuse (shared Modal wrapper if one exists)

## Deferred Ideas

None — discussion stayed within phase scope.
