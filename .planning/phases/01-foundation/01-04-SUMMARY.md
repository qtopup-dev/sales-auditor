---
phase: 01-foundation
plan: "04"
subsystem: backend
tags: [express, helmet, session, health, middleware, error-handler, mysql]

# Dependency graph
requires:
  - phase: 01-01
    provides: monorepo scaffold, package.json with cross-env and tsx devDeps, dev:api script
  - phase: 01-03
    provides: lib/prisma.ts singleton, PrismaTransactionClient type, generated client at client.js

provides:
  - Express 5 app factory (app.ts) with correct middleware order
  - GET /health endpoint returning 200 + JSON with UTC timestamp
  - Global error handler (4-param Express 5 signature) with production-safe JSON response
  - Session store using express-mysql-session (mysql2 pool, auto-creates sessions table)
  - Backend entry point with dotenv/config first, TZ=UTC check, prisma.$connect() before listen

affects:
  - Phase 2 (auth routes mount to this Express app via app.use('/api/auth', authRouter))
  - Phase 3 (sales routes mount to this Express app)
  - Phase 4 (admin routes mount to this Express app)
  - All phases share the errorHandler and session middleware

# Tech tracking
tech-stack:
  added:
    - express@5.2.1 (async errors auto-forwarded; no .catch(next) needed)
    - helmet@8.2.0 (15+ security headers; CSP, X-Content-Type-Options, X-Frame-Options, etc.)
    - cors@2.8.6 (origin restricted to CLIENT_ORIGIN; credentials: true for session cookie)
    - morgan@1.11.0 (request logging; dev format)
    - express-session@1.19.0 (httpOnly, sameSite: lax, rolling: true)
    - express-mysql-session@3.0.3 (auto-creates sessions table; clearExpired every 15 min)
    - mysql2@3.22.5 (separate pool for session store; independent from Prisma mariadb adapter)
  patterns:
    - middleware-order-locked (helmet→cors→morgan→json→session→routes→errorHandler; must not change)
    - express-5-error-handler (4-param signature; async errors auto-forwarded without .catch(next))
    - express-mysql-session-init (MySQLStore(session) pattern; separate mysql2 pool from Prisma)
    - dotenv-first-import (import 'dotenv/config' must be first line in index.ts)
    - utc-node-process (cross-env TZ=UTC in dev:api script; warning at startup if not set)

key-files:
  created:
    - packages/backend/src/index.ts
    - packages/backend/src/app.ts
    - packages/backend/src/middleware/errorHandler.ts
    - packages/backend/src/routes/health.ts
  modified: []

key-decisions:
  - "MySQLStore(session) pattern used — express-mysql-session wraps session.Store; separate mysql2 pool from Prisma mariadb adapter"
  - "errorHandler uses statusCode/code from error object with fallback to 500/INTERNAL_ERROR — extensible for Phase 2 custom errors"
  - "SESSION_SECRET defaults to 'change-me-in-production' with production forcing secure:true cookies — documented"
  - "createDatabaseTable: true — sessions table auto-created on first server start (not in Prisma schema)"

# Metrics
duration: ~4min
completed: "2026-06-17"
tasks_completed: 2
tasks_total: 2
---

# Phase 1 Plan 4: Express Skeleton Summary

**Express 5 backend skeleton with helmet security headers, mysql-backed session store, GET /health returning 200 + UTC timestamp, and global JSON error handler with production-safe error masking**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-17T06:50:18Z
- **Completed:** 2026-06-17T06:54:07Z
- **Tasks:** 2 of 2
- **Files created:** 4

## Accomplishments

- Created Express 5 app factory (`app.ts`) with locked middleware order: helmet → cors → morgan → express.json → urlencoded → session → healthRouter → errorHandler
- Session store: `express-mysql-session` v3 with dedicated `mysql2.createPool` (separate from Prisma mariadb adapter). `createDatabaseTable: true` auto-creates `sessions` table
- Error handler: 4-parameter Express 5 signature; returns `{ error: string, message: string }` JSON; hides internal errors in production
- Backend entry point: `import 'dotenv/config'` is first import; TZ=UTC warning check before server init; `prisma.$connect()` before `app.listen()`
- GET /health returns 200 with full helmet header set confirmed:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Content-Security-Policy: default-src 'self'...`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - and 10+ additional headers

## Task Commits

1. **Task 1: Create Express app factory, health route, and error handler** — `5a1a354` (feat)
2. **Task 2: Create server entry point and verify backend starts** — `4b1980e` (feat)

## Startup Log Output

```
[prisma] connected to database
[server] listening on http://localhost:3001
[server] NODE_ENV=development
[server] TZ=UTC
```

## curl Output (GET /health)

```
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self';base-uri 'self';font-src 'self' https: data:;...
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Strict-Transport-Security: max-age=31536000; includeSubDomains
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Credentials: true
Content-Type: application/json; charset=utf-8

{"status":"ok","timestamp":"2026-06-17T06:53:21.505Z"}
```

## Files Created

- `packages/backend/src/index.ts` — Entry point: dotenv/config first, TZ check, prisma.$connect(), app.listen()
- `packages/backend/src/app.ts` — createApp() factory: full middleware stack, mysql session store
- `packages/backend/src/middleware/errorHandler.ts` — 4-param error handler, JSON response, production mask
- `packages/backend/src/routes/health.ts` — GET /health → { status: 'ok', timestamp: ISO UTC }

## Decisions Made

- `MySQLStore(session)` pattern: `express-mysql-session` exports a function that wraps `session.Store`. Called once at module load with the `session` object from `express-session`. The resulting class (`MySQLSessionStore`) is instantiated with options + mysql2 pool.
- Error handler reads `err.statusCode` and `err.code` properties for extensibility — Phase 2 auth errors will use `statusCode: 401` + `code: 'UNAUTHORIZED'` pattern
- `SESSION_SECRET` defaults to `'change-me-in-production'` — explicitly insecure so production operators notice; `NODE_ENV === 'production'` forces `secure: true` cookies

## Phase 2 Integration Note

Phase 2 will attach auth routes by adding the following lines after the existing routes section in `app.ts`:
```typescript
app.use('/api/auth', authRouter);
app.use('/api', protectedRouter);
```
The `errorHandler` registration must remain last after any new routes are added.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new threat surface beyond what the plan's threat model documented:
- T-04-01: Error handler production masking — implemented
- T-04-02: Helmet headers — implemented, first middleware
- T-04-03: CORS restricted to CLIENT_ORIGIN — implemented
- T-04-04: SESSION_SECRET default documented — implemented
- T-04-05: Session expiry clearance — implemented with checkExpirationInterval: 900_000

## Self-Check: PASSED

- [x] `packages/backend/src/index.ts` — exists, dotenv/config first, TZ check, prisma.$connect(), process.exit(1)
- [x] `packages/backend/src/app.ts` — exists, createApp() function, createDatabaseTable: true, credentials: true, errorHandler last
- [x] `packages/backend/src/middleware/errorHandler.ts` — exists, 4-param signature, JSON response, production check
- [x] `packages/backend/src/routes/health.ts` — exists, GET /health, { status: 'ok', timestamp }
- [x] Commits 5a1a354 and 4b1980e exist in git log
- [x] `npm run dev:api` starts without errors — confirmed
- [x] `curl http://localhost:3001/health` returns HTTP 200 — confirmed
- [x] Helmet headers present: X-Content-Type-Options, X-Frame-Options — confirmed
- [x] TZ=UTC in startup logs — confirmed
- [x] No files unexpectedly deleted
