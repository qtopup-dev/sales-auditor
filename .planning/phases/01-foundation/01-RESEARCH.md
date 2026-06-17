# Phase 1: Foundation - Research

**Researched:** 2026-06-17
**Domain:** Monorepo setup, Prisma 7 + MySQL schema, Express 5 skeleton, UTC configuration, session store
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** All tables use `INT AUTO_INCREMENT` as primary key — not UUID. Applies to: organizations, users, products, mops, sales, audit_log, invite_tokens, sessions.
- **D-02:** Minimum seed only — one `organizations` row and one admin `users` row. No sample products or MOPs.
- **D-03:** Phase 1 delivers a shell only — Vite + React + TypeScript initialized, running a placeholder "App coming soon" page. Full frontend dependencies (Tailwind, react-router, axios, React Query, Zustand) are wired up in Phase 2.
- **D-04:** `strict: true` enabled in all tsconfig.json files across all packages.
- **D-05:** ESLint + Prettier configured at the monorepo root level (one `eslint.config.js` and one `.prettierrc` at `/`). Both apply to all packages.
- **D-06:** `tsx --watch` for backend development. No nodemon + ts-node.

### Claude's Discretion

- Exact ESLint rule set (recommended defaults are fine)
- Prettier formatting options (defaults are fine)
- `.env.example` structure and which vars to include
- Express error handler response format (JSON `{ error, message }` shape)
- Monorepo root `package.json` scripts (dev, build, lint, format)
- Which Prisma composite indexes to create beyond what the schema naturally requires

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 1 infrastructure scope.
</user_constraints>

---

## Summary

Phase 1 builds from zero — monorepo scaffold, complete Prisma schema, MySQL UTC configuration, Express skeleton with security headers, and a minimal React frontend shell. It is the bedrock every other phase builds on.

Three critical ecosystem changes from prior research (all dated August 2025) must be accounted for:

1. **Prisma is now v7.8.0 (latest), not v5.x.** Prisma 7 introduced breaking changes: `$use()` middleware is removed (replaced by `$extends` query extensions), the generator output path is now explicit and no longer `@prisma/client`, a `prisma.config.ts` file replaces the datasource URL in schema, `.env` is no longer auto-loaded, and MySQL requires the `@prisma/adapter-mariadb` + `mariadb` driver packages. The project CLAUDE.md says "Prisma v5" but the npm `latest` tag now resolves to 7.8.0. **Decision required:** use Prisma 5.22.0 (last stable 5.x) with explicit pinning, OR adopt Prisma 7 with its new patterns. This research covers Prisma 7 as the recommended path — it is stable, actively maintained, and the soft-delete pattern via `$extends` is well-documented.

2. **Express is now v5.2.1 (stable).** Express 5 was released stable in October 2024. It is now the npm `latest`. Key differences: async errors are automatically forwarded to error handlers (no more `.catch(next)`), wildcard routes need explicit names, `req.body` defaults to `undefined` (not `{}`). For this project, Express 5 is the right choice — the async error forwarding alone simplifies the codebase.

3. **React 19 is now npm latest (19.2.7).** The CLAUDE.md constraint says React 18. React 18.3.1 must be explicitly pinned — `npm install react@18.3.1` (not `react@latest`).

**Primary recommendation:** Use Prisma 7 + Express 5 + React 18 (pinned). Tailwind is deferred to Phase 2 per D-03.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Database schema definition | Database / ORM | — | Prisma schema is the single source of truth |
| UTC timezone configuration | Database + Backend | — | All three configs (MySQL, Prisma connection, Node env) are infrastructure-layer concerns |
| Session persistence | Backend (Express) | Database (MySQL sessions table) | express-session + express-mysql-session — server-side state |
| Express skeleton + health check | Backend (Express) | — | HTTP boundary, middleware order, security headers |
| Soft-delete enforcement | Backend (ORM layer) | — | Prisma `$extends` query extension intercepts reads globally |
| Monorepo wiring | Root package.json | — | npm workspaces configuration |
| Shared TypeScript types | `/packages/shared` | — | Consumed by both backend and frontend |
| Frontend shell | Frontend (Vite/React) | — | Minimal placeholder; satisfies "npm run dev starts both" criterion |

---

## Standard Stack

### Core — Backend

| Package | Pinned Version | Purpose | Source |
|---------|---------------|---------|--------|
| `express` | `^5.2.1` | HTTP framework | [VERIFIED: npm registry — `latest` as of 2026-06-17] |
| `prisma` | `^7.8.0` | ORM CLI (devDependency) | [VERIFIED: npm registry — `latest` as of 2026-06-17] |
| `@prisma/client` | `^7.8.0` | Generated Prisma client (runtime) | [VERIFIED: npm registry] |
| `@prisma/adapter-mariadb` | `^7.8.0` | MySQL driver adapter for Prisma 7 | [VERIFIED: npm registry] |
| `mariadb` | `^3.5.3` | MySQL/MariaDB JS driver (used by adapter) | [VERIFIED: npm registry] |
| `express-session` | `^1.19.0` | Server-side session middleware | [VERIFIED: npm registry] |
| `express-mysql-session` | `^3.0.3` | MySQL-backed session store | [VERIFIED: npm registry — last release July 2024, actively maintained] |
| `helmet` | `^8.2.0` | Security headers middleware | [VERIFIED: npm registry] |
| `cors` | `^2.8.6` | CORS policy middleware | [VERIFIED: npm registry] |
| `morgan` | `^1.11.0` | HTTP request logging | [VERIFIED: npm registry] |
| `express-validator` | `^7.3.2` | Input validation + sanitization | [VERIFIED: npm registry] |
| `bcrypt` | `^6.0.0` | Password hashing (cost factor 12) | [VERIFIED: npm registry] |
| `dotenv` | `^17.4.2` | Load `.env` into `process.env` (required in Prisma 7) | [VERIFIED: npm registry] |
| `mysql2` | `^3.22.5` | Direct mysql2 for express-mysql-session (separate from mariadb adapter) | [VERIFIED: npm registry] |

### Core — Frontend (Phase 1 shell only)

| Package | Pinned Version | Purpose | Source |
|---------|---------------|---------|--------|
| `react` | `18.3.1` | UI framework (MUST pin — latest is 19.x) | [VERIFIED: npm registry — 18.3.1 is last stable 18.x] |
| `react-dom` | `18.3.1` | React DOM renderer | [VERIFIED: npm registry] |
| `vite` | `^8.0.16` | Frontend build + dev server | [VERIFIED: npm registry] |
| `@vitejs/plugin-react` | `^6.0.2` | Vite React plugin | [VERIFIED: npm registry] |
| `typescript` | `~5.9.3` | TypeScript (use 5.x — 6.0 is newest but riskier with tooling) | [VERIFIED: npm registry — 5.9.3 is last stable 5.x] |

### Dev Tooling (root workspace)

| Package | Pinned Version | Purpose | Source |
|---------|---------------|---------|--------|
| `tsx` | `^4.22.4` | Run TypeScript directly in Node (backend dev + seed) | [VERIFIED: npm registry] |
| `concurrently` | `^10.0.3` | Run backend + frontend dev servers in parallel | [VERIFIED: npm registry] |
| `eslint` | `^10.5.0` | Linting (flat config via `eslint.config.js`) | [VERIFIED: npm registry] |
| `typescript-eslint` | `^8.61.1` | TypeScript ESLint rules (unified package — replaces separate plugin + parser) | [VERIFIED: npm registry] |
| `prettier` | `^3.8.4` | Code formatting | [VERIFIED: npm registry] |

### Type Packages (backend devDependencies)

| Package | Version | Source |
|---------|---------|--------|
| `@types/node` | `^25.9.3` | [VERIFIED: npm registry] |
| `@types/express` | `^5.0.6` | [VERIFIED: npm registry] |
| `@types/express-session` | `^1.19.0` | [VERIFIED: npm registry] |
| `@types/express-mysql-session` | `^3.0.8` | [VERIFIED: npm registry] |
| `@types/morgan` | `^1.9.10` | [VERIFIED: npm registry] |
| `@types/cors` | `^2.8.19` | [VERIFIED: npm registry] |
| `@types/bcrypt` | `^6.0.0` | [VERIFIED: npm registry] |

### Type Packages (frontend devDependencies)

| Package | Version | Source |
|---------|---------|--------|
| `@types/react` | `^18.3.x` | Pin to 18.x — `^19.x` is incompatible with React 18 | [ASSUMED — verify: `npm info @types/react versions` to find last 18.x] |
| `@types/react-dom` | `^18.3.x` | Same constraint | [ASSUMED — verify] |

> **Important:** `@types/react` and `@types/react-dom` latest versions (19.x) are incompatible with React 18. Install with: `npm install -D @types/react@^18 @types/react-dom@^18`

### Deferred to Phase 2 (do NOT install in Phase 1)

Per D-03, these are wired in Phase 2 when auth pages are actually built:
`tailwindcss`, `@tailwindcss/vite`, `react-router-dom`, `axios`, `@tanstack/react-query`, `zustand`, `react-hook-form`

---

## Architecture Patterns

### System Architecture Diagram

```
npm run dev (root)
       │
       ├─── concurrently ──────────────────────────────────────┐
       │                                                        │
       ▼                                                        ▼
packages/backend                                     packages/frontend
tsx --watch src/index.ts                             vite (dev server)
       │                                                  localhost:5173
       │  loads .env via import 'dotenv/config'        placeholder page
       │  sets TZ=UTC (process.env)
       │
       ▼
Express App (app.ts)
  cors → helmet → morgan → json → session → routes
       │
       ├── GET /health → 200 + helmet headers
       │
       └── Prisma Client (lib/prisma.ts)
               │  driver: @prisma/adapter-mariadb
               │  $extends: soft-delete query filter
               ▼
          MySQL (localhost:3306)
          database: alejinput_db
          time_zone: UTC (my.cnf)
          tables: organizations, users, products,
                  mops, sales, audit_log,
                  invite_tokens, sessions
```

### Recommended Project Structure

```
alejinput/                          ← git root, npm workspaces root
├── package.json                    ← workspaces: ["packages/*"]
├── eslint.config.js                ← flat config, applies to all packages
├── .prettierrc                     ← formatting rules
├── .env                            ← never committed
├── .env.example                    ← committed template
├── .gitignore
│
├── packages/
│   ├── shared/
│   │   ├── package.json            ← name: "@alejinput/shared"
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── types/
│   │           ├── index.ts        ← re-exports all types
│   │           ├── user.ts
│   │           ├── sale.ts
│   │           ├── product.ts
│   │           ├── mop.ts
│   │           └── audit.ts
│   │
│   ├── backend/
│   │   ├── package.json            ← name: "@alejinput/backend"
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma       ← all models, enums, NO datasource url
│   │   │   ├── prisma.config.ts    ← Prisma 7: datasource url + migrations path
│   │   │   └── migrations/         ← generated by prisma migrate dev
│   │   │   └── seed.ts             ← one org + one admin user
│   │   └── src/
│   │       ├── index.ts            ← env load, Prisma connect, server listen
│   │       ├── app.ts              ← Express setup: middleware + routes
│   │       ├── lib/
│   │       │   └── prisma.ts       ← singleton PrismaClient with $extends
│   │       ├── middleware/
│   │       │   └── errorHandler.ts ← global Express error handler
│   │       └── routes/
│   │           └── health.ts       ← GET /health
│   │
│   └── frontend/
│       ├── package.json            ← name: "@alejinput/frontend"
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           └── App.tsx             ← "App coming soon" placeholder
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session persistence | Custom DB session table + cleanup | `express-mysql-session` | Handles session expiry cleanup, TTL, table schema automatically |
| Security headers | Manual `res.setHeader(...)` calls | `helmet` | 15+ headers, CSP, HSTS; hand-rolled misses CORP, X-Permitted-Cross-Domain-Policies |
| Soft-delete filter | `where: { status: 'active' }` on every query | Prisma `$extends` query extension | One missed filter = silent data corruption |
| Password hashing | SHA-256 or MD5 | `bcrypt` cost factor 12 | bcrypt is designed for passwords; hash functions are not |
| Connection URL parsing | Manual string construction | `prisma.config.ts` + `env()` | Handles escaping, validation |
| TypeScript running in Node | Compiling before running | `tsx` | Zero-config, fastest restart, no Prisma client compatibility issues |
| Multi-process dev server | Shell scripts | `concurrently` | Cross-platform, colored output per process, kill-on-failure |

---

## Key Patterns

### Pattern 1: Prisma 7 Schema + Config Structure

**What:** Prisma 7 requires the generator to use `provider = "prisma-client"` and an explicit `output` path. The datasource URL moves to `prisma.config.ts`. The `@prisma/client` import path changes to the `output` path.

**schema.prisma (generator block only — datasource has NO url):**

```prisma
// Source: https://www.prisma.io/docs/prisma-orm/quickstart/mysql
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "mysql"
}
```

**prisma.config.ts (lives at `packages/backend/prisma/prisma.config.ts`):**

```typescript
// Source: https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

**Import path in application code:**

```typescript
// NOT: import { PrismaClient } from '@prisma/client'
// YES:
import { PrismaClient } from '../generated/prisma';
```

### Pattern 2: PrismaClient Singleton with $extends (Soft-Delete Filter)

**What:** Prisma 7 uses `$extends` query extensions instead of `$use` middleware. This is how soft-delete filtering is enforced automatically across all reads.

This project uses `status = 'active'`/`'void'` on sales and `is_active = true`/`false` on users, products, and mops — NOT a `deletedAt` column.

```typescript
// packages/backend/src/lib/prisma.ts
// Source: https://matranga.dev/true-soft-deletion-in-prisma-orm/ (adapted for status/is_active)
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../generated/prisma';

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  timezone: 'Z',     // Z = UTC for the mariadb driver
});

const baseClient = new PrismaClient({ adapter });

export const prisma = baseClient.$extends({
  name: 'softDeleteFilter',
  query: {
    // Sales: filter by status='active' on list reads
    sale: {
      findMany({ args, query }) {
        // Only inject if caller hasn't set status explicitly
        args.where = { status: 'active', ...args.where };
        return query(args);
      },
      findFirst({ args, query }) {
        args.where = { status: 'active', ...args.where };
        return query(args);
      },
    },
    // Users, Products, Mops: filter is_active=true on list reads
    user: {
      findMany({ args, query }) {
        args.where = { isActive: true, ...args.where };
        return query(args);
      },
    },
    product: {
      findMany({ args, query }) {
        args.where = { isActive: true, ...args.where };
        return query(args);
      },
    },
    mop: {
      findMany({ args, query }) {
        args.where = { isActive: true, ...args.where };
        return query(args);
      },
    },
  },
});

export type PrismaTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];
```

> **Soft-delete override pattern:** When intentionally querying ALL records (admin views that show voided sales), the caller passes `where: { status: undefined }` or an explicit `where: { status: { in: ['active', 'void'] } }` to override the injected default. Document this pattern in a comment at the call site.

### Pattern 3: Prisma 7 Full Schema

```prisma
// packages/backend/prisma/schema.prisma
// Source: architecture from .planning/research/ARCHITECTURE.md + Prisma 7 docs

generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "mysql"
}

// ─── Enums ──────────────────────────────────────────────────────────────────

enum Role {
  admin
  moderator
}

enum SaleStatus {
  active
  void
}

enum AuditAction {
  create
  update
  void
}

// ─── Models ──────────────────────────────────────────────────────────────────

model Organization {
  id        Int      @id @default(autoincrement())
  name      String   @db.VarChar(255)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users        User[]
  products     Product[]
  mops         Mop[]
  sales        Sale[]
  auditLogs    AuditLog[]
  inviteTokens InviteToken[]

  @@map("organizations")
}

model User {
  id             Int          @id @default(autoincrement())
  organizationId Int
  organization   Organization @relation(fields: [organizationId], references: [id])
  username       String       @db.VarChar(100)
  passwordHash   String       @db.VarChar(255)
  role           Role
  canEdit        Boolean      @default(true)
  isActive       Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  salesCreated  Sale[]        @relation("CreatedBy")
  salesEdited   Sale[]        @relation("LastEditedBy")
  auditLogs     AuditLog[]
  inviteTokens  InviteToken[] @relation("CreatedByUser")

  @@unique([organizationId, username])
  @@map("users")
}

model Product {
  id             Int          @id @default(autoincrement())
  organizationId Int
  organization   Organization @relation(fields: [organizationId], references: [id])
  name           String       @db.VarChar(255)
  price          Decimal      @db.Decimal(10, 2)
  isActive       Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  sales Sale[]

  @@index([organizationId, isActive])
  @@map("products")
}

model Mop {
  id             Int          @id @default(autoincrement())
  organizationId Int
  organization   Organization @relation(fields: [organizationId], references: [id])
  name           String       @db.VarChar(255)
  isActive       Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  sales Sale[]

  @@index([organizationId, isActive])
  @@map("mops")
}

model Sale {
  id             Int        @id @default(autoincrement())
  organizationId Int
  organization   Organization @relation(fields: [organizationId], references: [id])
  productId      Int
  product        Product    @relation(fields: [productId], references: [id])
  priceSnapshot  Decimal    @db.Decimal(10, 2)
  mopId          Int
  mop            Mop        @relation(fields: [mopId], references: [id])
  receiver       String     @db.VarChar(255)
  notes          String?    @db.Text
  status         SaleStatus @default(active)
  createdById    Int
  createdBy      User       @relation("CreatedBy", fields: [createdById], references: [id])
  lastEditedById Int?
  lastEditedBy   User?      @relation("LastEditedBy", fields: [lastEditedById], references: [id])
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  auditLogs AuditLog[]

  @@index([organizationId, status])
  @@index([organizationId, createdById])
  @@index([organizationId, productId])
  @@index([organizationId, mopId])
  @@index([organizationId, createdAt])
  @@map("sales")
}

model AuditLog {
  id             BigInt      @id @default(autoincrement())
  organizationId Int
  organization   Organization @relation(fields: [organizationId], references: [id])
  userId         Int
  user           User        @relation(fields: [userId], references: [id])
  saleId         Int?
  sale           Sale?       @relation(fields: [saleId], references: [id])
  tableName      String      @db.VarChar(100)
  rowId          Int
  action         AuditAction
  fieldName      String?     @db.VarChar(100)
  oldValue       String?     @db.Text
  newValue       String?     @db.Text
  createdAt      DateTime    @default(now())

  @@index([organizationId, tableName, rowId])
  @@index([organizationId, userId, createdAt])
  @@index([organizationId, createdAt])
  @@map("audit_log")
}

model InviteToken {
  id             Int          @id @default(autoincrement())
  organizationId Int
  organization   Organization @relation(fields: [organizationId], references: [id])
  tokenHash      String       @unique @db.VarChar(255)
  role           Role
  createdById    Int
  createdBy      User         @relation("CreatedByUser", fields: [createdById], references: [id])
  expiresAt      DateTime
  usedAt         DateTime?
  createdAt      DateTime     @default(now())

  @@index([tokenHash])
  @@map("invite_tokens")
}
```

> **Note on `sessions` table:** `express-mysql-session` creates its own `sessions` table automatically when the session store initializes. Do NOT define it in `schema.prisma` — the package manages it independently via its own `mysql2` connection.

### Pattern 4: Express 5 App Setup

```typescript
// packages/backend/src/app.ts
// Express 5: async errors auto-forwarded to error handler — no .catch(next) needed
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import session from 'express-session';
import MySQLStore from 'express-mysql-session';
import mysql2 from 'mysql2/promise';

const MySQLSessionStore = MySQLStore(session);

export function createApp() {
  const app = express();

  // Security headers — must be first
  app.use(helmet());

  // CORS — configure per deployment
  app.use(cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }));

  // Logging
  app.use(morgan('dev'));

  // Body parsing
  app.use(express.json());
  // Express 5: urlencoded defaults to extended:false — be explicit
  app.use(express.urlencoded({ extended: false }));

  // Session store
  const sessionPool = mysql2.createPool({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const store = new MySQLSessionStore({
    expiration: 30 * 24 * 60 * 60 * 1000,  // 30 days in ms
    createDatabaseTable: true,               // creates sessions table if absent
    clearExpired: true,
    checkExpirationInterval: 900000,         // check every 15 minutes
    connectionLimit: 5,
  }, sessionPool);

  app.use(session({
    secret: process.env.SESSION_SECRET ?? 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  }));

  // Routes
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Global error handler — must be last, 4-parameter signature
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
  });

  return app;
}
```

```typescript
// packages/backend/src/index.ts
import 'dotenv/config';
import { createApp } from './app';
import { prisma } from './lib/prisma';

// Ensure TZ=UTC is set in the environment before Prisma connects
// (also set in package.json dev script: cross-env TZ=UTC tsx --watch ...)
if (process.env.TZ !== 'UTC') {
  console.warn('[WARNING] TZ env var is not UTC. Timestamp storage may be incorrect.');
}

const PORT = Number(process.env.PORT ?? 3001);

const app = createApp();

async function start() {
  try {
    // Verify Prisma connection
    await prisma.$connect();
    console.log('[prisma] connected');

    app.listen(PORT, () => {
      console.log(`[server] listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[fatal] startup failed:', err);
    process.exit(1);
  }
}

start();
```

### Pattern 5: UTC Configuration — All Three Required

**1. MySQL `my.cnf` (or `my.ini` on Windows):**

```ini
[mysqld]
default-time-zone = '+00:00'
```

Restart MySQL after this change. Verify: `SELECT @@global.time_zone;` should return `+00:00`.

**2. Prisma 7 `prisma.config.ts` (DATABASE_URL must include timezone param):**

The mariadb driver adapter accepts `timezone: 'Z'` in its constructor options (see Pattern 2 above). The driver-level timezone setting replaces the old `?timezone=UTC` query param from Prisma 5.

For the connection URL format in `.env` (used by Prisma CLI for migrations):
```
DATABASE_URL="mysql://user:pass@localhost:3306/alejinput_db?timezone=UTC"
```

**3. Node.js process `TZ=UTC`:**

In `package.json` scripts, use `cross-env` (or set directly in Docker/systemd env):

```json
{
  "scripts": {
    "dev:api": "cross-env TZ=UTC tsx --watch packages/backend/src/index.ts"
  }
}
```

Install: `npm install -D cross-env` (cross-platform TZ setting for Windows/Linux/Mac).

> **Validation:** After all three configs, insert a row via Prisma and verify `SELECT created_at, @@global.time_zone FROM tablename` shows UTC timestamps.

### Pattern 6: Seed Script (Prisma 7)

```typescript
// packages/backend/prisma/seed.ts
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma';
import bcrypt from 'bcrypt';

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 1,
  timezone: 'Z',
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // Upsert organization (idempotent seed)
  const org = await prisma.organization.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Default Organization' },
  });
  console.log(`[seed] organization: ${org.name} (id=${org.id})`);

  // Upsert admin user
  const passwordHash = await bcrypt.hash('admin1234', 12);
  const admin = await prisma.user.upsert({
    where: { organizationId_username: { organizationId: org.id, username: 'admin' } },
    update: {},
    create: {
      organizationId: org.id,
      username: 'admin',
      passwordHash,
      role: 'admin',
      canEdit: true,
      isActive: true,
    },
  });
  console.log(`[seed] admin user: ${admin.username} (id=${admin.id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
```

**package.json prisma.seed field (in backend package.json):**

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Run with: `npx prisma db seed` from inside `packages/backend/`.

### Pattern 7: Root package.json (npm workspaces)

```json
{
  "name": "alejinput",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "concurrently --kill-others-on-fail --names \"api,ui\" \"npm run dev:api\" \"npm run dev:ui\"",
    "dev:api": "cross-env TZ=UTC tsx --watch packages/backend/src/index.ts",
    "dev:ui": "vite --config packages/frontend/vite.config.ts",
    "build": "npm run build --workspaces",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "db:migrate": "cd packages/backend && prisma migrate dev",
    "db:seed": "cd packages/backend && prisma db seed",
    "db:studio": "cd packages/backend && prisma studio"
  },
  "devDependencies": {
    "concurrently": "^10.0.3",
    "cross-env": "^7.0.3",
    "eslint": "^10.5.0",
    "typescript-eslint": "^8.61.1",
    "prettier": "^3.8.4",
    "tsx": "^4.22.4"
  }
}
```

> **Note:** `tsx` is at the root because it runs the backend directly without workspace hoisting issues. Prisma CLI is a devDependency inside `packages/backend/package.json`.

### Pattern 8: ESLint Flat Config (Root)

```javascript
// eslint.config.js (root of monorepo)
// Source: https://typescript-eslint.io/troubleshooting/typed-linting/monorepos/
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/generated/**',   // Prisma generated client
      '**/migrations/**',
    ],
  },
  // TypeScript files in all packages
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
```

### Pattern 9: .env.example

```bash
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=alejinput_db

# Prisma (connection URL used by Prisma CLI for migrations)
DATABASE_URL="mysql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?timezone=UTC"

# Express
PORT=3001
NODE_ENV=development
SESSION_SECRET=replace-with-32-plus-random-bytes-hex-string

# Frontend (for CORS)
CLIENT_ORIGIN=http://localhost:5173
```

### Pattern 10: TypeScript Config Files

**Root `tsconfig.json` (base config):**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true
  }
}
```

**`packages/backend/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "node16",
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*", "prisma/seed.ts", "prisma/prisma.config.ts"]
}
```

**`packages/frontend/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*"]
}
```

**`packages/shared/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

### Pattern 11: Vite Config (Frontend Shell)

```typescript
// packages/frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

```tsx
// packages/frontend/src/App.tsx (Phase 1 placeholder — D-03)
function App() {
  return (
    <div>
      <h1>App coming soon</h1>
    </div>
  );
}

export default App;
```

---

## Common Pitfalls

### Pitfall 1: Installing `prisma@latest` Gets Prisma 7, Not 5

**What goes wrong:** The CLAUDE.md says "Prisma v5" but `npm install prisma` now installs 7.x. Prisma 7 has breaking changes (`$use` removed, new generator, `prisma.config.ts`, no auto `.env` loading).

**How to avoid:** Either pin explicitly to `7.x` (recommended — this research covers 7) or pin to `5.22.0` if you want the documented Prisma 5 behavior. This research uses Prisma 7 patterns throughout.

**Warning signs:** Build errors about "prisma-client-js" provider, import errors from `@prisma/client`, `$use is not a function`.

### Pitfall 2: React Installs as v19 Without Pinning

**What goes wrong:** `npm install react react-dom` installs React 19 (current `latest`). React 19 has breaking changes and the CLAUDE.md constraint says React 18.

**How to avoid:** Always install `react@18.3.1 react-dom@18.3.1`. Also pin `@types/react@^18 @types/react-dom@^18`.

**Warning signs:** Type errors about `ReactDOM.render` being removed, JSX transform errors.

### Pitfall 3: Prisma 7 No Longer Auto-Loads .env

**What goes wrong:** `process.env.DATABASE_URL` is undefined in seed scripts and server code unless `.env` is explicitly loaded. Prisma 5 loaded `.env` automatically via the Prisma CLI; Prisma 7 removed this.

**How to avoid:** Add `import 'dotenv/config'` as the FIRST line in every entry point: `index.ts`, `seed.ts`, `prisma.config.ts`. The `dotenv/config` import is side-effect only.

**Warning signs:** `Error: DATABASE_URL environment variable is not set`, undefined DB credentials.

### Pitfall 4: Soft-Delete Filter Overrides Caller's `where`

**What goes wrong:** The `$extends` pattern above does `args.where = { status: 'active', ...args.where }` — the caller's where conditions win but the default `status: 'active'` is always injected. If a caller explicitly passes `status: 'void'`, their value overrides the default. But if a caller passes `where: undefined`, the extension adds the filter. This is correct.

The edge case: admin queries that intentionally want all statuses (active + void). The caller must pass an explicit override.

**Pattern for admin override:**

```typescript
// Admin wants ALL sales including voided — explicitly override the injected default
const allSales = await prisma.sale.findMany({
  where: { status: { in: ['active', 'void'] }, organizationId },
});
```

**Warning signs:** Admin sales table showing only active rows even though admin should see voided rows.

### Pitfall 5: express-mysql-session Requires a Separate mysql2 Pool

**What goes wrong:** The `express-mysql-session` package manages the `sessions` table using its own bundled `mysql2`. However, you must pass it a `mysql2.createPool()` instance — not a `PrismaClient`. The session store and Prisma are independent connections.

**How to avoid:** Create a plain `mysql2` pool in `app.ts` (as shown in Pattern 4) and pass it to `MySQLSessionStore`. This is a second connection pool to MySQL, separate from the Prisma adapter pool. This is correct behavior.

**Warning signs:** Sessions not persisting after restart, `sessions` table not created.

### Pitfall 6: AuditLog `saleId` FK — Optional Reference

**What goes wrong:** The architecture research shows `AuditLog` with `tableName VARCHAR(100)` and `rowId INT` for generic row references. But since Phase 2+ will add the `saleId` direct FK for the drawer query, the schema should include it from day one.

**How to avoid:** The schema in Pattern 3 includes `saleId Int?` on AuditLog with a direct relation to Sale. This enables the efficient drawer query `audit_log WHERE saleId = :id` in Phase 3 without a migration. The `tableName` + `rowId` columns are also present for future global audit log queries.

### Pitfall 7: npm Workspaces — `prisma migrate dev` Must Run From Package Dir

**What goes wrong:** Running `prisma migrate dev` from the repo root fails because Prisma looks for `schema.prisma` relative to the CWD and the `prisma.config.ts` also needs to be found.

**How to avoid:** The `db:migrate` script in root `package.json` `cd`s to `packages/backend` first. During development, run migrations from inside `packages/backend/`.

### Pitfall 8: TypeScript 6 vs 5 Choice

**What goes wrong:** `npm install typescript` installs TypeScript 6.0.3 (current latest). TypeScript 6 removed `--outFile` and has other breaking changes. Ecosystem tooling (Vite 8, ESLint, tsx 4.x) should be compatible with TS 6, but if any tool has issues, TS 5.9.3 is the safe fallback.

**Recommendation:** Use TypeScript 5.9.3 (`~5.9.3` pinned) for Phase 1. The `~` prefix allows patch updates within 5.9.x. Upgrade to TS 6 only after verifying all toolchain compatibility.

---

## Version Decision Summary

| Package | Recommended Version | Rationale |
|---------|--------------------|-|
| `prisma` + `@prisma/client` | `^7.8.0` | Current `latest`; research covers Prisma 7 patterns |
| `express` | `^5.2.1` | Current `latest`; async error handling is a clear win |
| `react` + `react-dom` | `18.3.1` (pinned exact) | CLAUDE.md constraint; must NOT use `latest` (resolves to 19.x) |
| `typescript` | `~5.9.3` | Stable; avoids TS 6 ecosystem compatibility risk |
| `vite` | `^8.0.16` | Current `latest`; Phase 1 shell only needs basic Vite |
| `tailwindcss` | Deferred to Phase 2 | D-03: frontend shell only in Phase 1 |
| `express-mysql-session` | `^3.0.3` | Last release July 2024; actively maintained |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | Yes | v22.17.0 | — |
| npm | Package management | Yes | 10.9.2 | — |
| Docker | MySQL (if no local install) | Yes | 28.3.0 | — |
| MySQL (local) | Database | No | — | Docker: `docker run -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=alejinput_db -p 3306:3306 mysql:8` |
| MySQL port 3306 | Database connection | No | — | Start MySQL via Docker |

**MySQL is not running on port 3306.** The plan must include a step to either:
1. Start MySQL via Docker (Docker is available), OR
2. Install MySQL locally (instructions needed for Windows)

**Recommended for development:** Docker compose file for MySQL — repeatable, no installation required.

**docker-compose.yml (add at repo root for local dev):**

```yaml
version: '3.9'
services:
  mysql:
    image: mysql:8.4
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: alejinput_db
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    command: --default-time-zone=+00:00   # UTC via Docker command arg

volumes:
  mysql_data:
```

This satisfies the UTC configuration for MySQL without editing `my.cnf` on the host machine.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TypeScript 5.9.3 is compatible with Vite 8, tsx 4.x, and typescript-eslint 8.x | Standard Stack | Build failures; mitigation: test with TS 6 if 5.x causes issues |
| A2 | `@types/react@^18` and `@types/react-dom@^18` are still published and satisfy React 18.3.1 | Standard Stack | Type errors in frontend shell; mitigation: check `npm info @types/react versions` for 18.x entries |
| A3 | `express-mysql-session` v3.0.3 is compatible with `express-session` v1.19.0 | Standard Stack | Session store failures at runtime; mitigation: both packages are tested together per their shared GitHub CI |
| A4 | `mariadb` JS driver v3.5.3 connects to MySQL 8.x without issues | Standard Stack | Connection failures; mitigation: mariadb driver explicitly documents MySQL 8 support |
| A5 | The `$extends` soft-delete pattern with spread `{ status: 'active', ...args.where }` allows callers to override status for admin queries | Pattern 2 | Admin views accidentally filtered to active-only; mitigation: write an explicit test after implementation |

---

## Open Questions

1. **MySQL installation approach**
   - What we know: MySQL is not running locally. Docker is available.
   - What's unclear: Does the user want Docker-based MySQL or a local installation?
   - Recommendation: Use Docker Compose for local dev. Plan should include the `docker-compose.yml` and a `db:up` script.

2. **`@prisma/adapter-mariadb` authentication with MySQL 8 caching_sha2_password**
   - What we know: MySQL 8 defaults to `caching_sha2_password` authentication. The `mariadb` JS driver may need `ssl: { rejectUnauthorized: false }` or the MySQL server must be configured to use `mysql_native_password` for the user.
   - What's unclear: Whether `@prisma/adapter-mariadb` handles `caching_sha2_password` transparently.
   - Recommendation: In the Docker Compose file, set `command: --default-authentication-plugin=mysql_native_password` for the Phase 1 dev environment to avoid authentication complexity.

3. **TypeScript 6 vs 5 for the project**
   - What we know: TS 6 is the current `latest`. Prior research assumed TS 5.x.
   - Recommendation: Pin to `~5.9.3` in Phase 1. The planner should note that upgrading to TS 6 is a separate task if desired.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma 5 `$use()` middleware | Prisma 7 `$extends` query extension | Nov 2025 (Prisma 7 release) | All soft-delete examples from before Nov 2025 use the old API |
| Prisma 5 `provider = "prisma-client-js"` | Prisma 7 `provider = "prisma-client"` | Nov 2025 | Generator must be updated |
| Prisma 5 datasource `url` in schema | Prisma 7 `prisma.config.ts` | Nov 2025 | Schema no longer contains DB credentials |
| Prisma auto-loads `.env` | Prisma 7 requires explicit `import 'dotenv/config'` | Nov 2025 | All entry points need dotenv import |
| Express 4 (RC 5 in 2024) | Express 5.2.1 (stable since Oct 2024) | Oct 2024 | Async errors auto-forwarded; `req.body` defaults to `undefined` |
| React 18 as npm `latest` | React 19 is now npm `latest` (19.2.7) | 2024 | Must pin `react@18.3.1` explicitly |
| Tailwind v3 `tailwind.config.js` | Tailwind v4 CSS-first `@import "tailwindcss"` | Jan 2025 | No config file needed; `@tailwindcss/vite` plugin replaces PostCSS setup |
| TypeScript 5.x | TypeScript 6.0.3 now `latest` | 2025 | `--outFile` removed; `types` defaults to `[]` |

---

## Security Domain

> Phase 1 has no user-facing endpoints beyond `GET /health`. Full ASVS coverage begins in Phase 2.

### Applicable ASVS Categories for Phase 1 Infrastructure

| ASVS Category | Applies | Control Implemented |
|---------------|---------|---------------------|
| V2 Authentication | No (Phase 2) | — |
| V3 Session Management | Partial | Session store configured (express-mysql-session); `httpOnly`, `sameSite`, `secure` cookie flags set |
| V4 Access Control | No (Phase 2) | — |
| V5 Input Validation | No (no user input in Phase 1) | — |
| V6 Cryptography | Partial | bcrypt installed with correct cost factor 12 |
| V14 Configuration | Yes | `helmet` on from day one; `NODE_ENV`-aware cookie security |

### Phase 1 Security Checklist

- [ ] `SESSION_SECRET` in `.env.example` clearly marked as "replace before production"
- [ ] `cookie.secure = true` in production via `NODE_ENV === 'production'` check
- [ ] Helmet registered before all routes
- [ ] No secrets committed to git (`.env` in `.gitignore`)
- [ ] Seed admin password is `admin1234` — document as "change immediately after first login"

---

## Validation Architecture

> Note: `.planning/config.json` not found. Treating nyquist_validation as enabled (absent = enabled).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None configured — Phase 1 is infrastructure only; no test framework installed |
| Config file | None — see Wave 0 |
| Quick run command | N/A until Phase 2 |
| Full suite command | N/A until Phase 2 |

### Phase Requirements → Test Map

Phase 1 has no REQ-IDs (it is prerequisite infrastructure). Success is verified via the 5 criteria in ROADMAP.md, which are manually checkable:

| Criterion | Verification Method |
|-----------|---------------------|
| `npm run dev` starts both servers | Manual: observe console output, visit http://localhost:5173 and http://localhost:3001/health |
| `prisma migrate status` shows clean | Manual: run command, verify output |
| Seeded org and admin user exist | Manual: direct DB query `SELECT id, username, role FROM users;` |
| `GET /health` returns 200 + helmet headers | Manual: `curl -I http://localhost:3001/health` and check headers |
| UTC timestamps in MySQL | Manual: `SELECT @@global.time_zone;` and insert + query a test row |

### Wave 0 Gaps

- No test infrastructure needed for Phase 1 (all criteria are infrastructure-level, verified by commands not unit tests)
- Phase 2 should introduce the testing framework when the first testable business logic exists (auth endpoints)

---

## Sources

### Primary (HIGH confidence)
- npm registry (`registry.npmjs.org`) — all package versions verified 2026-06-17
- [Prisma 7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7) — breaking changes, prisma.config.ts, $extends
- [Prisma MySQL quickstart](https://www.prisma.io/docs/prisma-orm/quickstart/mysql) — Prisma 7 schema.prisma format, prisma.config.ts
- [Prisma database drivers docs](https://www.prisma.io/docs/orm/overview/databases/database-drivers) — @prisma/adapter-mariadb
- [Tailwind CSS v4 blog](https://tailwindcss.com/blog/tailwindcss-v4) — v4 stable, CSS-first config changes
- [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html) — breaking changes, stable since Oct 2024

### Secondary (MEDIUM confidence)
- [express-mysql-session GitHub](https://github.com/chill117/express-mysql-session) — maintenance status, v3.0.3, July 2024 release
- [Prisma soft-delete $extends pattern](https://matranga.dev/true-soft-deletion-in-prisma-orm/) — $extends query extension implementation
- [Express 5 InfoQ article](https://www.infoq.com/news/2025/01/express-5-released/) — Express 5 stable release confirmation

### Tertiary (LOW confidence — training knowledge used)
- npm workspaces setup patterns (root package.json structure, workspace hoisting)
- ESLint flat config for monorepos (standard `typescript-eslint` docs pattern)
- `@types/react@^18` existence as a separate tag from `@types/react@latest`

---

## Metadata

**Confidence breakdown:**
- Package versions: HIGH — all verified against npm registry on 2026-06-17
- Prisma 7 patterns: HIGH — verified via official Prisma docs
- Express 5 patterns: HIGH — verified via official Express docs
- Soft-delete `$extends` pattern: MEDIUM — verified via community source (not official Prisma docs page)
- ESLint flat config monorepo: MEDIUM — verified via typescript-eslint docs search, community patterns
- `@types/react@^18` pinning: LOW — assumed from knowledge of npm versioning; verify with `npm info @types/react versions`

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (30 days) — package versions are stable; Prisma 7 API is unlikely to change significantly
