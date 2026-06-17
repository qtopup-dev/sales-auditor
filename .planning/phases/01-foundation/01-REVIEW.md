---
phase: 01-foundation
reviewed: 2026-06-17T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - packages/shared/src/types/user.ts
  - packages/shared/src/types/product.ts
  - packages/shared/src/types/mop.ts
  - packages/shared/src/types/sale.ts
  - packages/shared/src/types/audit.ts
  - packages/shared/src/types/index.ts
  - packages/backend/prisma/schema.prisma
  - packages/backend/prisma.config.ts
  - packages/backend/prisma/seed.ts
  - packages/backend/src/lib/prisma.ts
  - packages/backend/src/app.ts
  - packages/backend/src/index.ts
  - packages/backend/src/middleware/errorHandler.ts
  - packages/backend/src/routes/health.ts
  - packages/frontend/vite.config.ts
  - packages/frontend/index.html
  - packages/frontend/src/main.tsx
  - packages/frontend/src/App.tsx
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Foundation scaffold covers shared TypeScript types, the Prisma schema, the Prisma client singleton with soft-delete extension, the Express app factory, backend entry point, error handler, and health route, plus a minimal Vite/React frontend shell.

The schema is well-structured and correctly enforces all ten CLAUDE.md architectural rules at the data-model level. Organization IDs, soft-delete columns, DECIMAL(10,2) for money, snapshot columns on Sale, and composite indexes are all present and correct. The type files are clean and accurately reflect the schema.

Two issues require fixes before Phase 2 begins because they will cause runtime failures:

1. The Vite dev proxy is configured without a path rewrite, so every frontend API call will 404 in development.
2. BigInt values from `AuditLog.id` will throw a `JSON.stringify` error at runtime if not converted before being sent in an API response.

Four additional warnings address gaps in the soft-delete extension and session security that should be resolved before business logic routes are added in Phase 2/3.

---

## Critical Issues

### CR-01: Vite proxy missing path rewrite — all /api calls will 404

**File:** `packages/frontend/vite.config.ts:20-23`

**Issue:** The Vite dev-server proxy is configured to forward `/api/*` to `http://localhost:3001`, but no `rewrite` function is provided. Without a rewrite, a frontend request to `/api/health` is forwarded as `http://localhost:3001/api/health`. However, the Express health route is mounted at `/health` (not `/api/health`), and Phase 2 auth routes will be mounted at `/api/auth`. With the rewrite absent the prefix doubles up: the proxy forwards `/api/auth/login` to `http://localhost:3001/api/auth/login` which Express will not find unless routes are explicitly mounted with the `/api` prefix. The vite config comment even contradicts itself: it says `fetch('/api/health')` hits `http://localhost:3001/health` but the actual behavior without a rewrite is `http://localhost:3001/api/health`.

One of the two must be made consistent:

**Option A — strip the `/api` prefix in Vite (recommended):** All frontend requests use `/api/*`, Vite strips it, Express routes have no `/api` prefix.

```ts
proxy: {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
},
```

**Option B — add `/api` prefix to all Express routes:** Keep Vite proxy as-is (no rewrite) and mount all Express routes under `/api`:

```ts
// app.ts
app.use('/api', healthRouter);       // GET /api/health
app.use('/api/auth', authRouter);    // Phase 2
app.use('/api', protectedRouter);    // Phase 2+
```

Option A is recommended because it keeps backend routes clean and is consistent with the comment already in the file.

---

### CR-02: BigInt serialization will throw at runtime for AuditLog responses

**File:** `packages/backend/prisma/schema.prisma:134` / `packages/shared/src/types/audit.ts:9`

**Issue:** `AuditLog.id` is `BigInt` in the Prisma schema. When any route handler passes a Prisma `AuditLog` result directly to `res.json()`, Node's `JSON.stringify` will throw `TypeError: Do not know how to serialize a BigInt`. The shared type documents this as safe because `Number.MAX_SAFE_INTEGER` is sufficient, but the conversion from `BigInt` to `number` must happen explicitly — it does not happen automatically.

No AuditLog API route exists yet, but the fix must be established as a pattern before Phase 3 adds the audit drawer endpoint. Without it, any Phase 3 response that includes `auditLog.id` will crash the process in development (and return a 500 in production).

**Fix — add a serialization helper in the shared package and use it in every route that returns audit entries:**

```ts
// packages/shared/src/utils/serialization.ts
export function serializeAuditEntry(entry: {
  id: bigint;
  [key: string]: unknown;
}): AuditEntry {
  return { ...entry, id: Number(entry.id) } as AuditEntry;
}
```

Alternatively, install a JSON replacer on the Express app to handle BigInt globally:

```ts
// app.ts — add after body parsing middleware
app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? Number(value) : value,
);
```

The global replacer is simpler and prevents the issue from appearing in any future route.

---

## Warnings

### WR-01: Soft-delete extension does not cover findFirst for user, product, or mop

**File:** `packages/backend/src/lib/prisma.ts:38-57`

**Issue:** The `$extends` soft-delete filter covers `sale.findMany`, `sale.findFirst`, `user.findMany`, `product.findMany`, and `mop.findMany`. It does NOT intercept `user.findFirst`, `product.findFirst`, or `mop.findFirst`. CLAUDE.md Rule 8 states every list query on soft-deletable tables must filter by status. Phase 2 will add a login route that will almost certainly call `prisma.user.findFirst({ where: { username } })` — this lookup will return inactive (soft-deleted) users and allow them to authenticate.

**Fix — add `findFirst` overrides for user, product, and mop to mirror the sale pattern:**

```ts
user: {
  findMany({ args, query }) {
    args.where = { isActive: true, ...args.where };
    return query(args);
  },
  findFirst({ args, query }) {
    args.where = { isActive: true, ...args.where };
    return query(args);
  },
},
product: {
  findMany({ args, query }) {
    args.where = { isActive: true, ...args.where };
    return query(args);
  },
  findFirst({ args, query }) {
    args.where = { isActive: true, ...args.where };
    return query(args);
  },
},
mop: {
  findMany({ args, query }) {
    args.where = { isActive: true, ...args.where };
    return query(args);
  },
  findFirst({ args, query }) {
    args.where = { isActive: true, ...args.where };
    return query(args);
  },
},
```

---

### WR-02: Soft-delete extension does not cover findUnique for any model

**File:** `packages/backend/src/lib/prisma.ts:26-58`

**Issue:** `findUnique` is not intercepted for any model. Phase 3 will need to fetch a single Sale, User, or Product by primary key in contexts where deactivated records should not be accessible (e.g., `GET /api/sales/:id` must not return a voided sale to a moderator, and `GET /api/users/:id` must not return an inactive user). Without a `findUnique` override, callers must remember to add the filter manually every time — this is exactly the failure mode Rule 8 is designed to prevent.

**Fix — extend the soft-delete block to also cover `findUnique` for each model:**

```ts
sale: {
  findUnique({ args, query }) {
    // Note: findUnique does not accept arbitrary where conditions beyond unique fields.
    // Convert to findFirst to allow injecting the status filter.
    return (prisma as unknown as BasePrismaClient).sale.findFirst({
      ...args,
      where: { status: 'active', ...args.where },
    });
  },
  // ... findMany, findFirst
},
```

Alternatively, document explicitly that all `findUnique` calls on soft-deletable models must always add the filter manually, and add a lint rule or code-review checklist item to enforce it. The extension-based approach is strongly preferred.

---

### WR-03: SESSION_SECRET fallback silently uses a predictable value

**File:** `packages/backend/src/app.ts:66`

**Issue:** `secret: process.env.SESSION_SECRET ?? 'change-me-in-production'` silently falls back to a known string when the environment variable is absent. Any session signed with this fallback secret can be forged by any party who reads this source file. The application starts and accepts requests without warning the operator.

This is safe in a local dev environment where SESSION_SECRET is in `.env`, but it represents a risk in CI/CD pipelines or staging environments where the `.env` file may be absent and the variable unset.

**Fix — fail fast when SESSION_SECRET is missing, or at minimum emit a loud error:**

```ts
// In index.ts, before createApp():
if (!process.env.SESSION_SECRET) {
  console.error(
    '[fatal] SESSION_SECRET environment variable is not set. ' +
      'Copy .env.example to .env and set a strong secret before starting.'
  );
  process.exit(1);
}
```

If a non-crashing fallback is truly desired for local dev, emit a console.error at minimum (not a silent fallback) and ensure NODE_ENV checks gate it:

```ts
secret: process.env.SESSION_SECRET ??
  (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must be set in production');
    }
    console.error('[WARNING] SESSION_SECRET not set — using insecure default. DO NOT use in production.');
    return 'dev-only-insecure-secret';
  })(),
```

---

### WR-04: MySQL session pool missing UTC timezone setting

**File:** `packages/backend/src/app.ts:45-51`

**Issue:** The `mysql2.createPool` for the session store does not include `timezone: 'Z'`. CLAUDE.md Rule 7 requires UTC at every MySQL connection level. The Prisma adapter pool correctly sets `timezone: 'Z'` (see `prisma.ts:16`), but the session pool does not. The `sessions` table has an `expires` column; if the session pool connection runs in the server's local timezone and MySQL's global `time_zone` differs from UTC, session expiry timestamps will be calculated incorrectly, leading to sessions expiring too early or too late.

**Fix:**

```ts
const sessionPool = mysql2.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z', // CLAUDE.md Rule 7 — UTC on every MySQL connection
});
```

---

## Info

### IN-01: MySQLSessionStore connectionLimit option is ineffective when pool is passed externally

**File:** `packages/backend/src/app.ts:57-62`

**Issue:** `connectionLimit: 5` is passed inside the `MySQLSessionStore` options object, but when an existing pool (`sessionPool`) is passed as the second argument to `new MySQLSessionStore(options, pool)`, the store uses the provided pool directly and ignores any `connectionLimit` in options. The connection limit for the session store is controlled by the pool passed as the second argument. The `connectionLimit: 5` here is dead configuration that can mislead future maintainers into thinking the store's connection limit is being managed here.

**Fix — remove the misleading option from the store options and set connection limit on the pool instead:**

```ts
const sessionPool = mysql2.createPool({
  // ...
  connectionLimit: 5, // move here — this is where it takes effect
});

const store = new MySQLSessionStore(
  {
    expiration: 30 * 24 * 60 * 60 * 1000,
    createDatabaseTable: true,
    clearExpired: true,
    checkExpirationInterval: 900_000,
    // connectionLimit: 5 — remove from here
  },
  sessionPool,
);
```

---

### IN-02: Seed always computes bcrypt hash even when admin user already exists

**File:** `packages/backend/prisma/seed.ts:32`

**Issue:** `bcrypt.hash('admin1234', 12)` runs unconditionally on every seed invocation. At cost factor 12 this takes ~250ms. The `upsert` update clause is `update: {}`, so the computed hash is discarded on subsequent runs — the expense is pure waste. This is a minor annoyance in development (slow seed re-runs) but will add up in CI pipelines that re-seed frequently.

**Fix — gate the hash computation on a create-only path, or use a try/catch create approach:**

```ts
// Only hash when we know we need to create
const existingAdmin = await prisma.user.findUnique({
  where: { organizationId_username: { organizationId: org.id, username: 'admin' } },
});

if (!existingAdmin) {
  const passwordHash = await bcrypt.hash('admin1234', 12);
  const admin = await prisma.user.create({
    data: {
      organizationId: org.id,
      username: 'admin',
      passwordHash,
      role: 'admin',
      canEdit: true,
      isActive: true,
    },
  });
  console.log(`[seed] admin user created: ${admin.username} (id=${admin.id})`);
} else {
  console.log(`[seed] admin user already exists: ${existingAdmin.username} (id=${existingAdmin.id})`);
}
```

Note: this lookup will bypass the soft-delete extension (which filters out inactive users), so an inactive admin would not be found and would be re-created with a duplicate-key error. Use `baseClient` (before `$extends`) if you need to find soft-deleted users in seed logic, or handle the conflict.

---

_Reviewed: 2026-06-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
