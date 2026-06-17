---
phase: 02-auth-catalogs
plan: "02"
subsystem: auth
tags: [auth, express-session, bcrypt, express-validator, invite, rbac, session-fixation]

# Dependency graph
requires:
  - phase: 02-01
    provides: sessionPool singleton (lib/db.ts), requireAuth middleware with SessionData augmentation, requireRole curried factory
provides:
  - authRouter with 5 endpoints (login, logout, invite-generate, invite-validate-GET, invite-register-POST)
  - usersRouter with 3 endpoints (GET list, PATCH canEdit, POST reset-password)
  - app.ts live route mounts — authRouter at /api/auth, protectedRouter at /api with requireAuth guard
affects:
  - 02-03 (catalog routes — Plan 03 will add productsRouter + mopsRouter to the protectedRouter created here)
  - frontend auth flows (login, logout, invite registration)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Session fixation prevention via req.session.regenerate() before setting userId on login
    - Timing-safe login — bcrypt.compare runs on dummy hash even when user not found
    - Router-level RBAC enforcement — usersRouter.use(requireRole('admin')) covers all sub-routes
    - Atomic invite registration — prisma.$transaction marks usedAt before user.create (race-safe)
    - Direct SQL session invalidation — DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ? (O(1))
    - protectedRouter inline assembly in app.ts — Plan 03 extends it by adding more sub-routers

key-files:
  created:
    - packages/backend/src/routes/auth.ts
    - packages/backend/src/routes/users.ts
  modified:
    - packages/backend/src/app.ts

key-decisions:
  - "GET /api/auth/invite/:token is stateless (no usedAt mutation) — POST consumes the token; prevents security-scanner false-consumption"
  - "protectedRouter assembled inline in app.ts (not a separate file) — Plan 03 extends by adding productsRouter/mopsRouter"
  - "Session invalidation uses direct SQL DELETE not sessionStore.all() — O(1) regardless of total session count"

patterns-established:
  - "Session fixation prevention: regenerate() before setting session data on login"
  - "Dummy hash constant-time comparison: bcrypt.compare on null user with dummy hash prevents timing enumeration"
  - "Router-level middleware: mount requireRole at router, not per-route, for automatic inheritance"
  - "Atomic token consumption: mark usedAt before creating resource inside same transaction"

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
  - AUTH-05
  - AUTH-06
  - AUTH-07
  - ROLES-01
  - ROLES-02
  - ROLES-09

# Metrics
duration: ~6min
completed: "2026-06-17"
---

# Phase 2 Plan 02: Auth Routes Summary

**Five-endpoint authRouter (login with session fixation prevention, logout, invite CRUD) and three-endpoint admin usersRouter (list, canEdit toggle, password reset with direct SQL session invalidation) wired into app.ts via inline protectedRouter.**

## Performance

- **Duration:** ~6 minutes
- **Started:** 2026-06-17T17:15:13Z
- **Completed:** 2026-06-17T17:21:14Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- authRouter delivers AUTH-01 through AUTH-07 — login (session fixation + timing-safe), logout (session.destroy + clearCookie), invite generation (sha256 hash, 48h expiry), invite validation GET (stateless), invite registration POST (atomic prisma.$transaction)
- usersRouter delivers ROLES-01/02/09 — admin-only list, canEdit toggle, and password reset that atomically updates passwordHash and deletes all target sessions via direct SQL
- app.ts now has live route mounts: authRouter at /api/auth (unauthenticated), protectedRouter at /api with requireAuth guard covering all downstream routes

## Task Commits

1. **Task 1: Implement authRouter** - `533a7ce` (feat)
2. **Task 2: Implement usersRouter + wire app.ts** - `c47b31f` (feat)

## Files Created/Modified

- `packages/backend/src/routes/auth.ts` — authRouter: login, logout, invite generate, invite validate (GET), invite register (POST)
- `packages/backend/src/routes/users.ts` — usersRouter: GET list all users, PATCH canEdit toggle, POST reset-password with direct SQL session invalidation
- `packages/backend/src/app.ts` — added authRouter + usersRouter imports; replaced comment stubs with live mounts; inline protectedRouter assembly

## Decisions Made

- GET /api/auth/invite/:token is purely stateless — validates without setting usedAt. POST consumes the token. This prevents security scanners (or prefetch browsers) from false-consuming tokens during link preview.
- protectedRouter assembled inline in app.ts rather than as a separate routes/protected.ts file. Plan 03 adds productsRouter and mopsRouter to it without touching auth.ts or users.ts.
- Direct SQL DELETE for session invalidation (not sessionStore.all() + destroy loop) — O(1) regardless of how many sessions exist in the system.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The two pre-existing TypeScript errors (TS5110: module/moduleResolution mismatch; TS6059: seed.ts outside rootDir) were present before this plan and are documented in the Plan 01 SUMMARY.md as out-of-scope.

## Known Stubs

None — all endpoints have real logic. organizationId: 1 is a deliberate Phase 2 single-org hardcode per plan spec (not a stub — Phase 2 explicitly defers multi-tenant isolation to v2).

## Threat Flags

No new threat surface beyond what the plan's threat model covers. All five trust boundaries (login bcrypt path, invite token path, session invalidation path, session userId server-set, requireRole at router) are implemented as specified.

## Next Phase Readiness

- Plan 03 (catalog routes — products + MOPs) can add productsRouter and mopsRouter to the existing protectedRouter in app.ts
- The requireAuth + requireRole pattern is fully established and tested — Plan 03 follows identical patterns
- Session invalidation SQL (JSON_EXTRACT $.userId) is an assumption (A2 from plan) — verified correct at integration test time

---
*Phase: 02-auth-catalogs*
*Completed: 2026-06-17*

## Self-Check: PASSED

Files confirmed:
- packages/backend/src/routes/auth.ts: FOUND
- packages/backend/src/routes/users.ts: FOUND
- packages/backend/src/app.ts: modified

Commits confirmed:
- 533a7ce: FOUND (feat(02-02): implement authRouter)
- c47b31f: FOUND (feat(02-02): implement usersRouter + wire app.ts)
