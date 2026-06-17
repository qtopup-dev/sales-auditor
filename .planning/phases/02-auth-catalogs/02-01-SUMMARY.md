---
phase: 02-auth-catalogs
plan: "01"
subsystem: backend-auth-foundation
tags: [auth, middleware, session, types, shared]
dependency_graph:
  requires: []
  provides:
    - sessionPool singleton (packages/backend/src/lib/db.ts)
    - requireAuth middleware with SessionData augmentation (packages/backend/src/middleware/requireAuth.ts)
    - requireRole curried middleware factory (packages/backend/src/middleware/requireRole.ts)
    - InviteToken and AuthSession shared types (packages/shared/src/types/auth.ts)
  affects:
    - packages/backend/src/app.ts (sessionPool import, requireAuth import)
    - packages/shared/src/types/index.ts (re-exports auth types)
tech_stack:
  added: []
  patterns:
    - Module-level singleton export (lib/db.ts mirrors lib/prisma.ts pattern)
    - SessionData module augmentation in requireAuth.ts for type-safe session access
    - Curried middleware factory pattern for requireRole
key_files:
  created:
    - packages/backend/src/lib/db.ts
    - packages/backend/src/middleware/requireAuth.ts
    - packages/backend/src/middleware/requireRole.ts
    - packages/shared/src/types/auth.ts
  modified:
    - packages/backend/src/app.ts
    - packages/shared/src/types/index.ts
decisions:
  - sessionPool extracted to lib/db.ts so auth routes can import it for session invalidation on password reset
  - requireAuth imports kept in app.ts so SessionData augmentation is active at startup
  - Phase 2 live route imports left as comments in app.ts — Plan 02 will add them when route files exist
  - InviteToken and AuthSession types placed in shared package so frontend can import them via @alejinput/shared
metrics:
  duration: "~10 minutes"
  completed: "2026-06-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 2
---

# Phase 2 Plan 01: Auth Infrastructure Foundation Summary

**One-liner:** Dedicated mysql2 sessionPool singleton, requireAuth/requireRole RBAC middleware with SessionData augmentation, and InviteToken/AuthSession shared types extracted to @alejinput/shared.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extract sessionPool to lib/db.ts; create requireAuth + requireRole | 18d54b8 | packages/backend/src/lib/db.ts, requireAuth.ts, requireRole.ts |
| 2 | Update app.ts to use imported sessionPool; add auth shared types | ae64e6e | packages/backend/src/app.ts, packages/shared/src/types/auth.ts, index.ts |

## What Was Built

### lib/db.ts

A dedicated mysql2 Pool singleton exported at module level. Previously, the pool was created inside the `createApp()` function as a local variable — inaccessible to auth routes that need to delete sessions on password reset. Moving it to `lib/db.ts` follows the same pattern as `lib/prisma.ts` and makes the pool importable anywhere.

### requireAuth.ts

Express middleware that checks `req.session.userId` and returns `401 { error: 'UNAUTHORIZED' }` if absent. The file also contains the `declare module 'express-session'` SessionData augmentation, which adds `userId: number` and `role: 'admin' | 'moderator'` as type-safe fields. This augmentation is active at startup because `requireAuth` is imported in `app.ts`.

### requireRole.ts

Curried middleware factory: `requireRole('admin')` returns a middleware that checks `req.session.role` and returns `403 { error: 'FORBIDDEN' }` if mismatched. Designed to be mounted at router level (not per-route) so new routes added to an admin router automatically inherit the check without manual annotation.

### app.ts changes

Removed the local `const sessionPool = mysql2.createPool(...)` block (and the `mysql2` import). The `new MySQLSessionStore(..., sessionPool)` call now uses the imported singleton. Added import of `requireAuth` so the SessionData augmentation is loaded. Phase 2 live route mounts are left as commented stubs — Plan 02 will uncomment when route files exist.

### shared/types/auth.ts

Two interfaces: `InviteToken` (matches the Prisma InviteToken model fields with ISO 8601 date strings, `passwordHash` explicitly excluded) and `AuthSession` (shape of the login API response, includes `role` for frontend redirect decision per CONTEXT.md D-10). Re-exported from `index.ts` following the existing `export type { ... } from './file.js'` pattern.

## Deviations from Plan

None — plan executed exactly as written. The two pre-existing TypeScript errors (TS5110: module/moduleResolution mismatch; TS6059: seed.ts outside rootDir) were present before this plan and are out of scope.

## Verification Results

All 6 plan verification checks passed:

1. `npx tsc --noEmit -p packages/backend/tsconfig.json` — only pre-existing errors (TS5110, TS6059), zero new errors
2. `npx tsc --noEmit -p packages/shared/tsconfig.json` — exits 0 (clean)
3. `grep "export const sessionPool" packages/backend/src/lib/db.ts` — found at line 8
4. `grep "declare module 'express-session'" packages/backend/src/middleware/requireAuth.ts` — found at line 7
5. `grep "const sessionPool = mysql2.createPool" packages/backend/src/app.ts` — NOT FOUND (local variable removed)
6. `grep "from './lib/db.js'" packages/backend/src/app.ts` — found at line 11

## Known Stubs

None — this plan creates infrastructure (middleware, types, pool singleton). No UI rendering or data flow stubs.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced by this plan. Files created are internal middleware and shared types. The `requireAuth` middleware itself is the mitigation for T-02-P01-01 and T-02-P01-02 as listed in the plan's threat model.

## Self-Check: PASSED

Files confirmed present:
- packages/backend/src/lib/db.ts: FOUND
- packages/backend/src/middleware/requireAuth.ts: FOUND
- packages/backend/src/middleware/requireRole.ts: FOUND
- packages/shared/src/types/auth.ts: FOUND

Commits confirmed:
- 18d54b8: FOUND
- ae64e6e: FOUND
