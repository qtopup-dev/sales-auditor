---
phase: 03-sales-core
plan: "01"
subsystem: database
tags: [prisma, mysql, express-session, typescript, migration]

# Dependency graph
requires:
  - phase: 02-auth-catalogs
    provides: requireAuth middleware, login handler, express-session SessionData, Prisma schema (Sale, AuditLog, User models)
provides:
  - "createdByUsername VarChar(100) column on sales table (denormalized snapshot)"
  - "lastEditedByUsername VarChar(100)? column on sales table (denormalized snapshot)"
  - "userUsername VarChar(100) column on audit_log table (denormalized snapshot)"
  - "SessionData.username type-safe field (populated at login)"
  - "SessionData.organizationId type-safe field (populated at login)"
  - "Migration 20260618073213_add_username_snapshots applied to DB"
affects: [03-02, 03-03, 03-04, 03-05, 03-06, sales-backend-routes, audit-log-writes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Denormalized username snapshots on Sale and AuditLog — written at mutation time, never joined back to users"
    - "SessionData augmentation via declare module express-session in requireAuth.ts"
    - "Manual migration SQL creation + prisma migrate resolve --applied to handle external sessions table drift"

key-files:
  created:
    - packages/backend/prisma/migrations/20260618073213_add_username_snapshots/migration.sql
  modified:
    - packages/backend/prisma/schema.prisma
    - packages/backend/src/middleware/requireAuth.ts
    - packages/backend/src/routes/auth.ts

key-decisions:
  - "Option A chosen for username in session: store username + organizationId in session at login (avoids extra DB read per mutating sales route)"
  - "Used prisma db execute + migrate resolve --applied to apply migration manually, bypassing drift check caused by sessions table (created by express-mysql-session outside Prisma)"

patterns-established:
  - "Pattern: When DB drift is caused by externally-managed tables (e.g., sessions table from express-mysql-session), create migration SQL manually, apply via prisma db execute, then mark as applied with prisma migrate resolve --applied"
  - "Pattern: Username snapshot fields are VarChar(100) non-null on Sale (createdByUsername) and nullable (lastEditedByUsername) + non-null on AuditLog (userUsername)"

requirements-completed:
  - SALES-16
  - AUDIT-01
  - AUDIT-02
  - ROLES-03
  - ROLES-04
  - ROLES-05

# Metrics
duration: 25min
completed: 2026-06-18
---

# Phase 3 Plan 01: Schema Username Snapshots + Session Augmentation Summary

**Prisma migration adding three denormalized username snapshot fields (createdByUsername, lastEditedByUsername, userUsername) and express-session augmentation with username + organizationId written at login**

## Performance

- **Duration:** 25 min
- **Started:** 2026-06-18T07:32:00Z
- **Completed:** 2026-06-18T07:57:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `createdByUsername` and `lastEditedByUsername` to Sale model and `userUsername` to AuditLog model in schema.prisma
- Created and applied migration `20260618073213_add_username_snapshots` to MySQL database; regenerated Prisma client
- Augmented express-session `SessionData` interface with `username: string` and `organizationId: number`, and updated login handler to write these values before session.save()

## Task Commits

Each task was committed atomically:

1. **Task 1: Add username snapshot fields to schema.prisma and run migration** - `07f219d` (feat)
2. **Task 2: Augment SessionData with username + organizationId and update login handler** - `e62f9ba` (feat)

## Files Created/Modified
- `packages/backend/prisma/schema.prisma` - Added createdByUsername, lastEditedByUsername to Sale model; added userUsername to AuditLog model
- `packages/backend/prisma/migrations/20260618073213_add_username_snapshots/migration.sql` - ALTER TABLE SQL adding the three columns
- `packages/backend/src/middleware/requireAuth.ts` - SessionData interface extended with username: string and organizationId: number
- `packages/backend/src/routes/auth.ts` - Login handler now writes req.session.username and req.session.organizationId before session.save()

## Decisions Made
- **Option A for session username:** Store `username` and `organizationId` in session at login time (not Option B: fetch from DB per request). More efficient — avoids extra DB read on every mutating sales route.
- **Manual migration approach:** express-mysql-session creates a `sessions` table outside Prisma's control, causing drift detection on `prisma migrate dev`. Fixed by: (1) creating migration SQL manually, (2) applying with `prisma db execute`, (3) marking applied with `prisma migrate resolve --applied`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Applied migration manually due to express-mysql-session sessions table drift**
- **Found during:** Task 1 (schema migration)
- **Issue:** `npx prisma migrate dev` detected drift — the `sessions` table (managed by express-mysql-session) exists in the DB but is not in Prisma migration history. This caused migrate dev to prompt for a reset.
- **Fix:** Created migration directory and SQL manually, applied via `npx prisma db execute --file ...`, then marked as applied via `npx prisma migrate resolve --applied 20260618073213_add_username_snapshots`. Confirmed with `npx prisma migrate status` showing "Database schema is up to date!"
- **Files modified:** packages/backend/prisma/migrations/20260618073213_add_username_snapshots/migration.sql
- **Verification:** `prisma migrate status` outputs "Database is up to date!"; schema has all three fields
- **Committed in:** 07f219d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The sessions table drift is an expected deployment condition — express-mysql-session always creates its table outside Prisma. The manual migration approach is the correct pattern for this codebase going forward. No scope creep.

## Issues Encountered

- **Pre-existing TypeScript config errors:** `npx tsc --noEmit` produces 2 pre-existing errors (TS5110: module:ESNext incompatible with moduleResolution:node16; TS6059: prisma/seed.ts outside rootDir:src). These errors exist in the main repo before any Phase 3 changes. Fixing them would require architectural tsconfig restructuring across multiple files (Rule 4 territory) — deferred as out-of-scope. The Session augmentation and route changes are semantically correct TypeScript; no new errors were introduced.

## Known Stubs

None - this plan is purely schema + session infrastructure. No UI rendering paths or data stubs.

## Threat Flags

None - all surfaces in this plan are covered by the plan's threat model (T-03-01: username/organizationId written server-side from DB, never from request body; T-03-02: non-null columns safe since no existing sale rows at Phase 3 start).

## User Setup Required

None - migration was applied to the local dev database automatically.

## Next Phase Readiness
- Sales backend routes (03-02) can now write `req.session.username` to `createdByUsername`/`userUsername` fields
- Sales route PATCH handler can write `req.session.organizationId` for org scoping
- All audit log writes have the `userUsername` column available
- Prisma client is regenerated and type-safe for the new fields
- Existing sessions will lack `username`/`organizationId` until users log in again (expected behavior — no migration of existing sessions needed)

---
*Phase: 03-sales-core*
*Completed: 2026-06-18*
