---
phase: 08-self-service-password-change-for-moderators-via-username-dro
plan: 01
subsystem: auth
tags: [express, express-validator, bcrypt, mysql2, express-session, sessions]

# Dependency graph
requires:
  - phase: 02-auth-catalogs
    provides: authRouter with login/logout/invite routes, requireAuth middleware, sessionPool (mysql2 pool for direct session queries)
provides:
  - "POST /api/auth/change-password endpoint for self-service password change by any logged-in user"
  - "changePasswordValidation express-validator array (8-char minimum)"
affects: [08-02-frontend-username-dropdown, phase-08-summary]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Session-scoped 'logout everywhere except me' pattern: DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ? AND session_id != ? bound to [userId, req.sessionID]"

key-files:
  created: []
  modified:
    - packages/backend/src/routes/auth.ts

key-decisions:
  - "Update scoped strictly to req.session.userId!/organizationId! — never trust an id from the request body (T-08-01 mitigation)"
  - "No current-password field — confirmed D-03 decision, internal trusted-team tool"
  - "Response body is { ok: true } only — no password/user data echoed (T-08-05 mitigation)"

patterns-established:
  - "Session invalidation query that preserves the requester's own session via session_id != ? bound to req.sessionID"

requirements-completed: [PHASE8-SC3, PHASE8-SC4]

# Metrics
duration: ~20min
completed: 2026-07-20
---

# Phase 08 Plan 01: Self-Service Password Change Backend Endpoint Summary

**POST /api/auth/change-password lets any logged-in user (admin or moderator) set a new bcrypt-hashed (cost 12) password, invalidating their other sessions while keeping the current one alive.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-20T08:00:00Z (approx)
- **Completed:** 2026-07-20T08:19:06Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `changePasswordValidation` (server-side re-validation of the 8-character minimum, never trusting client-only checks)
- Added `POST /api/auth/change-password` route, mounted with per-route `requireAuth` (authRouter is mounted unauthenticated in app.ts)
- Update is scoped to the caller's own row via `req.session.userId!` / `req.session.organizationId!` — never from the request body
- On success, all of the user's OTHER sessions are deleted via `sessionPool.query` with `AND session_id != ?` bound to `req.sessionID`, so the requester stays logged in
- Response body is `{ ok: true }` — no password or user data echoed back

## Task Commits

Each task was committed atomically:

1. **Task 1: Add POST /api/auth/change-password endpoint with session-scoped invalidation** - `aa41ffc` (feat)

## Files Created/Modified
- `packages/backend/src/routes/auth.ts` - Added `sessionPool` import, `changePasswordValidation` array, and the `POST /change-password` route

## Decisions Made
None beyond what the plan specified — implemented exactly as written, including the deliberate divergence from the admin-reset session-invalidation query (excludes `req.sessionID` instead of deleting unconditionally).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bootstrapped fresh worktree dev environment to run verification**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** This worktree had no `node_modules` (npm workspaces never installed) and no generated Prisma client (`src/generated/prisma` missing), so `tsc --noEmit` failed with unrelated module-resolution errors across the whole backend, and `packages/backend/.env` (gitignored, required for `DATABASE_URL`) did not exist in the worktree.
- **Fix:** Ran `npm install` at the repo root, copied `packages/backend/.env` from the main repo's local dev environment (matches the documented local dev credentials — `admin/admin1234` seed, ports 5173/3001 — see MEMORY.md), then ran `npx prisma generate` to produce the Prisma client. None of this touches source code; `.env`, `node_modules`, and `src/generated` are all gitignored and were not committed.
- **Files modified:** None (environment bootstrap only — no tracked files affected)
- **Verification:** `npx tsc --noEmit` then ran clean (no errors) for the whole backend, confirming the change-password route type-checks correctly.
- **Committed in:** N/A (untracked/gitignored files, nothing to commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — environment bootstrap, no source changes)
**Impact on plan:** No scope creep. The route was implemented exactly as specified in the plan; the deviation was purely local environment setup required to validate the change.

## Issues Encountered
None beyond the environment bootstrap documented above.

## User Setup Required

None - no external service configuration required. (The `.env` file created in this worktree is local-dev-only, gitignored, and mirrors the main repo's existing dev credentials — not a new secret.)

## Next Phase Readiness

Backend endpoint is complete and type-checks clean. Ready for 08-02 (frontend username dropdown UI) to wire a "Change Password" form to `POST /api/auth/change-password`. No blockers.

---
*Phase: 08-self-service-password-change-for-moderators-via-username-dro*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: packages/backend/src/routes/auth.ts
- FOUND: commit aa41ffc
- FOUND: .planning/phases/08-self-service-password-change-for-moderators-via-username-dro/08-01-SUMMARY.md
