---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [monorepo, npm-workspaces, docker, mysql, typescript, eslint, prettier, prisma, express, react, vite]

# Dependency graph
requires: []
provides:
  - npm workspaces monorepo scaffold with 3 packages (backend, frontend, shared)
  - Docker Compose for MySQL 8.4 with UTC time zone and mysql_native_password auth
  - Root tsconfig.json (strict:true, ES2022, ESNext module, bundler resolution)
  - Backend tsconfig (node16 moduleResolution, includes prisma/seed.ts and prisma/prisma.config.ts)
  - Frontend tsconfig (react-jsx, DOM libs)
  - Shared tsconfig (extends root)
  - ESLint flat config (typescript-eslint, ignores generated/ and migrations/)
  - Prettier config (singleQuote, tabWidth 2, trailingComma es5, printWidth 100)
  - .env.example with all 9 required env vars including DATABASE_URL with ?timezone=UTC
  - .gitignore excluding node_modules, .env, dist/, packages/backend/generated/
  - packages/backend/package.json (@alejinput/backend) with Express 5, Prisma 7, all deps
  - packages/frontend/package.json (@alejinput/frontend) with React pinned to 18.3.1 exact
  - packages/shared/package.json (@alejinput/shared) stub
affects: [01-02, 01-03, 01-04, 01-05, all subsequent phases]

# Tech tracking
tech-stack:
  added:
    - typescript ~5.9.3
    - express ^5.2.1
    - prisma ^7.8.0 + @prisma/client ^7.8.0 + @prisma/adapter-mariadb ^7.8.0
    - mariadb ^3.5.3 + mysql2 ^3.22.5
    - react 18.3.1 (pinned exact) + react-dom 18.3.1
    - vite ^8.0.16 + @vitejs/plugin-react ^6.0.2
    - express-session ^1.19.0 + express-mysql-session ^3.0.3
    - helmet ^8.2.0 + cors ^2.8.6 + morgan ^1.11.0
    - express-validator ^7.3.2
    - bcrypt ^6.0.0
    - dotenv ^17.4.2
    - concurrently ^10.0.3 + cross-env ^7.0.3 + tsx ^4.22.4
    - eslint ^10.5.0 + typescript-eslint ^8.61.1 + prettier ^3.8.4
    - mysql:8.4 (Docker)
  patterns:
    - npm workspaces monorepo with packages/backend, packages/frontend, packages/shared
    - Root-level ESLint flat config applying to all packages
    - Package tsconfigs extending root, with backend overriding moduleResolution to node16
    - dev:api script uses cross-env TZ=UTC (satisfies UTC rule 7 for Node side)
    - docker-compose.yml command flag for MySQL UTC (--default-time-zone=+00:00)
    - React exact version pinning (18.3.1, no caret) to prevent accidental React 19 install

key-files:
  created:
    - package.json (npm workspaces root with all dev/db scripts)
    - docker-compose.yml (MySQL 8.4 with UTC and mysql_native_password)
    - .env.example (9 env var templates)
    - .gitignore (excludes node_modules, .env, dist, generated/)
    - tsconfig.json (base config, strict:true)
    - eslint.config.js (flat config, typescript-eslint)
    - .prettierrc (formatting rules)
    - packages/backend/package.json (@alejinput/backend with Prisma 7 + Express 5)
    - packages/backend/tsconfig.json (node16 moduleResolution)
    - packages/frontend/package.json (@alejinput/frontend, React 18.3.1 pinned)
    - packages/frontend/tsconfig.json (react-jsx)
    - packages/shared/package.json (@alejinput/shared stub)
    - packages/shared/tsconfig.json
  modified: []

key-decisions:
  - "React pinned to exactly 18.3.1 (no caret) — npm latest is React 19.x; caret would allow upgrade"
  - "MySQL docker-compose uses --default-authentication-plugin=mysql_native_password to avoid caching_sha2_password issues with mariadb JS driver"
  - "Backend tsconfig uses moduleResolution:node16 (overrides root bundler) — tsx runs in Node.js not a bundler"
  - "Prisma 7.x adopted (not v5) — current npm latest; research covers v7 patterns ($extends, prisma.config.ts)"
  - "typescript ~5.9.3 pinned (not TS 6) — avoids ecosystem compatibility risk with Vite 8 and tsx 4.x"
  - "dotenv package included in backend deps — Prisma 7 no longer auto-loads .env"

patterns-established:
  - "Pattern: npm workspaces with packages/* glob — all packages hoisted to root node_modules"
  - "Pattern: cross-env TZ=UTC prefix on dev:api — satisfies CLAUDE.md Rule 7 Node.js UTC requirement"
  - "Pattern: backend tsconfig includes prisma/seed.ts and prisma/prisma.config.ts — enables tsx to run these Prisma 7 entry points"
  - "Pattern: ESLint ignores **/generated/** — Prisma generated client is never linted"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-06-16
---

# Phase 1 Plan 01: Monorepo Scaffold Summary

**npm workspaces monorepo with MySQL 8.4 Docker, Prisma 7 + Express 5 + React 18 (pinned) package configs, and root TypeScript/ESLint/Prettier tooling**

## Performance

- **Duration:** 2 min
- **Started:** 2026-06-16T19:38:30Z
- **Completed:** 2026-06-16T19:40:44Z
- **Tasks:** 2
- **Files modified:** 13 created

## Accomplishments

- Root monorepo scaffold with npm workspaces pointing to packages/* and all dev/db/lint/format scripts
- Docker Compose for MySQL 8.4 with UTC time zone and mysql_native_password satisfying CLAUDE.md Rule 7 (database side)
- Three package stubs (backend, frontend, shared) with correct names, versions, and dependencies
- Tooling baseline: root tsconfig.json (strict:true), ESLint flat config (typescript-eslint), Prettier config

## Task Commits

Each task was committed atomically:

1. **Task 1: Root package.json, .gitignore, Docker Compose, .env.example** - `d330891` (chore)
2. **Task 2: tsconfigs, ESLint, Prettier, package.json stubs** - `96535c6` (chore)

**Plan metadata:** (committed with SUMMARY.md below)

## Files Created/Modified

- `package.json` - npm workspaces root; dev/build/lint/format/db:migrate/db:seed/db:studio scripts
- `docker-compose.yml` - MySQL 8.4 with --default-time-zone=+00:00 and --default-authentication-plugin=mysql_native_password
- `.env.example` - 9 required env vars: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DATABASE_URL (?timezone=UTC), PORT, NODE_ENV, SESSION_SECRET, CLIENT_ORIGIN
- `.gitignore` - excludes node_modules/, .env, dist/, packages/*/dist/, packages/backend/generated/
- `tsconfig.json` - base TypeScript config (strict:true, ES2022, ESNext, bundler resolution)
- `eslint.config.js` - flat config with typescript-eslint; ignores generated/ and migrations/
- `.prettierrc` - singleQuote, tabWidth 2, trailingComma es5, printWidth 100
- `packages/backend/package.json` - @alejinput/backend; Express 5.2.1, Prisma 7.8.0, @prisma/adapter-mariadb, mariadb, mysql2, bcrypt, helmet, cors, morgan, express-validator, express-session, express-mysql-session, dotenv; prisma.seed field set
- `packages/backend/tsconfig.json` - extends root, moduleResolution node16, includes prisma/seed.ts and prisma/prisma.config.ts
- `packages/frontend/package.json` - @alejinput/frontend; react 18.3.1 and react-dom 18.3.1 pinned exact (no caret); vite ^8.0.16; @vitejs/plugin-react ^6.0.2
- `packages/frontend/tsconfig.json` - extends root, jsx react-jsx, DOM libs
- `packages/shared/package.json` - @alejinput/shared stub
- `packages/shared/tsconfig.json` - extends root

## Decisions Made

- **React pinned to exactly 18.3.1** — npm latest resolves to React 19.x. Caret prefix (`^`) would allow automatic upgrade. Exact pin enforces React 18 constraint from CLAUDE.md.
- **MySQL auth plugin** — `--default-authentication-plugin=mysql_native_password` added to Docker Compose command to avoid `caching_sha2_password` authentication failures with the `mariadb` JS driver (addressed RESEARCH.md Open Question 2).
- **Backend moduleResolution: node16** — The root tsconfig uses `bundler` for Vite. The backend uses `tsx` in Node.js context where `bundler` resolution is invalid. Backend tsconfig overrides to `node16`.
- **Prisma 7 over Prisma 5** — CLAUDE.md mentions "Prisma v5" but npm latest is 7.8.0 with breaking changes. RESEARCH.md confirmed Prisma 7 is the correct path. Plans use Prisma 7 patterns throughout.
- **TypeScript ~5.9.3** — TS 6.0 is npm latest but carries ecosystem compatibility risk with Vite 8 and tsx 4.x. Pinned to patch-level within 5.9.x.
- **dotenv in backend deps** — Prisma 7 no longer auto-loads `.env`. Every entry point (index.ts, seed.ts, prisma.config.ts) must explicitly `import 'dotenv/config'`.

## Deviations from Plan

None - plan executed exactly as written. All files match the specifications in 01-01-PLAN.md.

## Issues Encountered

None — file creation was straightforward. LF-to-CRLF line ending warnings from git on Windows are expected and do not affect functionality.

## Known Stubs

- `packages/backend/package.json` — package stub with no source files yet (src/ created in plan 01-02)
- `packages/frontend/package.json` — package stub with no source files yet (src/ created in plan 01-04)
- `packages/shared/package.json` — package stub with no source files yet (src/ created in plan 01-03)

These are intentional stubs per the plan. Source files are created in subsequent plans (01-02 through 01-05).

## User Setup Required

None — no external service configuration required for this plan. Docker must be running before executing `docker compose up -d` in subsequent plans.

## Next Phase Readiness

- Monorepo scaffold is complete. Plans 01-02 (Prisma schema), 01-03 (shared types), 01-04 (frontend shell), and 01-05 (Express skeleton) can now build on this foundation.
- No blockers.
- The `npm install` step runs during plan 01-02 when first dependencies are needed.

---
*Phase: 01-foundation*
*Completed: 2026-06-16*
