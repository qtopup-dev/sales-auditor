---
phase: 02-auth-catalogs
reviewed: 2026-06-18T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - packages/backend/src/app.ts
  - packages/backend/src/lib/db.ts
  - packages/backend/src/lib/prisma.ts
  - packages/backend/src/middleware/requireAuth.ts
  - packages/backend/src/middleware/requireRole.ts
  - packages/backend/src/routes/auth.ts
  - packages/backend/src/routes/users.ts
  - packages/backend/src/routes/products.ts
  - packages/backend/src/routes/mops.ts
  - packages/frontend/src/lib/axios.ts
  - packages/frontend/src/stores/authStore.ts
  - packages/frontend/src/router/index.tsx
  - packages/frontend/src/layouts/AuthenticatedLayout.tsx
  - packages/frontend/src/pages/LoginPage.tsx
  - packages/frontend/src/pages/InviteRegisterPage.tsx
  - packages/frontend/src/pages/ProductsPage.tsx
  - packages/frontend/src/pages/MopsPage.tsx
  - packages/frontend/src/components/Modal.tsx
  - packages/frontend/src/components/catalog/ProductModal.tsx
  - packages/frontend/src/components/catalog/MopModal.tsx
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Reviewed the full auth and catalog phase: session management, invite flow, user/product/MOP CRUD endpoints, soft-delete middleware, and all frontend pages and components.

The overall architecture is solid — session fixation is handled, timing attacks on login are mitigated, bcrypt cost factor is correct, soft-delete extension is in place, and the RBAC layering (requireAuth at router level, requireRole per sub-router) is clean. The main concerns are two correctness issues that need to be fixed before the next phase adds more routes on top of them.

---

## Critical Issues

### CR-01: `/api/auth/invite` — `requireRole` applied without `requireAuth`, returns 403 instead of 401 for unauthenticated callers

**File:** `packages/backend/src/routes/auth.ts:101`

**Issue:** The `POST /api/auth/invite` endpoint (which generates invite links) sits on `authRouter`, which is mounted at `/api/auth` — outside the `protectedRouter` block that has `requireAuth` applied. `requireRole('admin')` is applied inline, but `requireRole` only checks `req.session.role`; it never verifies that `req.session.userId` is set (i.e., that there is a real authenticated session). An unauthenticated request with no session will have `req.session.role === undefined`, which causes `requireRole` to return 403 (FORBIDDEN) instead of 401 (UNAUTHORIZED).

The effective security outcome is correct in that unauthenticated users cannot create invite tokens, but the HTTP semantics are wrong and the protection depends on an implicit side-effect of `requireRole` rather than an explicit authentication check. Any future change to `requireRole`'s internals could silently break this.

**Fix:** Move `POST /api/auth/invite` and `GET/POST /api/auth/invite/:token` to a dedicated inviteRouter that is mounted under `/api` inside the `protectedRouter`, or stack `requireAuth` before `requireRole` inline on this route. The GET validation endpoint should remain unauthenticated (it must be accessible before login), but the POST invite generation must be explicitly authenticated:

```typescript
// In app.ts — move the invite-generation route into the protected block:
protectedRouter.use('/invite', inviteAdminRouter); // requireAuth already applied by protectedRouter

// In the new inviteAdminRouter file:
inviteAdminRouter.use(requireRole('admin'));
inviteAdminRouter.post('/', async (req, res) => { /* ... */ });

// Keep the public validate/register routes on authRouter (no auth needed):
authRouter.get('/invite/:token', ...);   // validate token — public
authRouter.post('/invite/:token', ...);  // register — public (token is the credential)
```

---

### CR-02: `PATCH /api/users/:id` and `POST /api/users/:id/reset-password` — missing `param('id')` validation; NaN reaches Prisma

**File:** `packages/backend/src/routes/users.ts:56-57` and `packages/backend/src/routes/users.ts:82-84`

**Issue:** Both routes call `Number(req.params.id)` without a preceding `param('id').isInt({ min: 1 })` validator. If the path parameter is non-numeric (e.g., `PATCH /api/users/abc`), `Number('abc')` returns `NaN`. Prisma's `update({ where: { id: NaN } })` and `findFirst({ where: { id: NaN } })` will throw a Prisma validation error at runtime, bubbling to the global error handler as a 500 instead of a clean 400. The products and mops routes correctly use `param('id').isInt({ min: 1 })` — users should match.

**Fix:** Add the same `param` validator already used in products/mops:

```typescript
// PATCH /api/users/:id
usersRouter.patch(
  '/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid user ID'),  // ADD THIS
    body('canEdit').isBoolean().withMessage('canEdit must be a boolean'),
  ],
  async (req, res) => { /* ... */ }
);

// POST /api/users/:id/reset-password
usersRouter.post(
  '/:id/reset-password',
  [param('id').isInt({ min: 1 }).withMessage('Invalid user ID')],  // ADD THIS
  async (req, res) => { /* ... */ }
);

// Also add the validationResult check at the top of each handler:
const errors = validationResult(req);
if (!errors.isEmpty()) {
  res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
  return;
}
```

Also add `import { param } from 'express-validator';` to `users.ts` — currently only `body` and `validationResult` are imported.

---

## Warnings

### WR-01: `SESSION_SECRET` insecure fallback — no startup guard in production

**File:** `packages/backend/src/app.ts:64`

**Issue:** `secret: process.env.SESSION_SECRET ?? 'change-me-in-production'` silently uses a hardcoded weak secret when the env var is not set. In production with a forgotten `SESSION_SECRET`, all sessions are signed with a publicly-known string, making session cookies forgeable. The app starts and appears healthy with no indication of the misconfiguration.

**Fix:** Fail fast at startup when `NODE_ENV=production` and `SESSION_SECRET` is absent. Add a guard in `index.ts` (or at the top of `createApp`):

```typescript
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET must be set in production');
  process.exit(1);
}
```

---

### WR-02: `bcrypt.hash()` called inside a Prisma transaction — holds DB connection during CPU-bound work

**File:** `packages/backend/src/routes/auth.ts:150-178`

**Issue:** `bcrypt.hash(password, 12)` is called at line 167 inside a `prisma.$transaction()` block. bcrypt with cost factor 12 takes roughly 80–200ms of CPU time. Holding an open database transaction for this duration wastes a connection from the pool and increases the chance of transaction timeouts or deadlock cascades under concurrent load. The token mark-used step and the user creation should be atomic, but bcrypt does not need to be inside that transaction.

**Fix:** Compute the password hash before opening the transaction:

```typescript
authRouter.post('/invite/:token', registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }

  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const { username, password } = req.body as { username: string; password: string };

  // Hash BEFORE the transaction — CPU work, not DB work
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const invite = await tx.inviteToken.findUnique({ where: { tokenHash } });
    if (!invite || invite.usedAt !== null || invite.expiresAt < new Date()) {
      const err = Object.assign(new Error('Invite link is invalid or has expired'), {
        statusCode: 400, code: 'INVITE_INVALID',
      });
      throw err;
    }
    await tx.inviteToken.update({ where: { tokenHash }, data: { usedAt: new Date() } });
    await tx.user.create({
      data: { username, passwordHash, role: invite.role, organizationId: invite.organizationId },
    });
  });

  res.status(201).json({ ok: true });
});
```

---

### WR-03: Soft-delete `$extends` does not cover `findFirst` for `user`, `product`, and `mop`

**File:** `packages/backend/src/lib/prisma.ts:39-58`

**Issue:** The `softDeleteFilter` extension overrides `findMany` and `findFirst` for `sale`, but only `findMany` for `user`, `product`, and `mop`. Any future call to `prisma.user.findFirst()`, `prisma.product.findFirst()`, or `prisma.mop.findFirst()` without an explicit `isActive` filter will silently return soft-deleted (inactive) records. Current callers in this phase all supply explicit `isActive` filters, so there is no active bug today — but the gap makes the safety net incomplete and will cause silent bugs as more routes are added in Phase 3 and beyond.

**Fix:** Add `findFirst` overrides for `user`, `product`, and `mop` to match the pattern used for `sale`:

```typescript
user: {
  findMany({ args, query }) {
    args.where = { isActive: true, ...args.where };
    return query(args);
  },
  findFirst({ args, query }) {  // ADD THIS
    args.where = { isActive: true, ...args.where };
    return query(args);
  },
},
product: {
  findMany({ args, query }) {
    args.where = { isActive: true, ...args.where };
    return query(args);
  },
  findFirst({ args, query }) {  // ADD THIS
    args.where = { isActive: true, ...args.where };
    return query(args);
  },
},
mop: {
  findMany({ args, query }) {
    args.where = { isActive: true, ...args.where };
    return query(args);
  },
  findFirst({ args, query }) {  // ADD THIS
    args.where = { isActive: true, ...args.where };
    return query(args);
  },
},
```

Existing callers that explicitly pass `isActive: { in: [true, false] }` will continue to override the default correctly — the spread order (`{ isActive: true, ...args.where }`) means caller-supplied values win.

---

### WR-04: `sessionPool` `connectionLimit` setting in MySQLStore options is silently ignored when a pool is provided externally

**File:** `packages/backend/src/app.ts:57` and `packages/backend/src/lib/db.ts:8-14`

**Issue:** The MySQLStore options object includes `connectionLimit: 5` (app.ts line 57), but `express-mysql-session` ignores `connectionLimit` when an existing pool is passed as the second argument. The pool in `db.ts` uses mysql2's default of 10 connections. The `connectionLimit: 5` comment in the store options creates a false impression that the session pool is limited to 5 connections — it is not.

**Fix:** Set `connectionLimit` directly on the pool in `db.ts` and remove the misleading option from the store config:

```typescript
// lib/db.ts
export const sessionPool = mysql2.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5, // MOVE HERE — this is where it actually takes effect
});

// app.ts — remove connectionLimit from MySQLStore options (it's ignored)
const store = new MySQLSessionStore(
  {
    expiration: 30 * 24 * 60 * 60 * 1000,
    createDatabaseTable: true,
    clearExpired: true,
    checkExpirationInterval: 900_000,
    // connectionLimit removed — set on pool in lib/db.ts
  },
  sessionPool,
);
```

---

## Info

### IN-01: `param` not imported in `users.ts` — unused import `crypto` could be a future issue

**File:** `packages/backend/src/routes/users.ts:1-7`

**Issue:** `users.ts` imports `crypto` and `bcrypt` which are correctly used. However, as noted in CR-02, `param` from `express-validator` is not imported even though it should be used for path parameter validation. This is a companion note to CR-02 — the fix there requires adding `param` to the import line:

```typescript
import { body, param, validationResult } from 'express-validator';
```

---

### IN-02: `Modal.tsx` — no focus trap; focus can escape modal while open

**File:** `packages/frontend/src/components/Modal.tsx:13-66`

**Issue:** The modal renders with `role="dialog"` and `aria-modal="true"`, which semantically declares a focus trap to assistive technologies, but no actual focus containment is implemented in JavaScript. Keyboard users can Tab out of the modal into the obscured background content. For an internal admin tool this is a lower-priority concern but the aria contract is misleading.

**Fix:** On modal open, move focus to the first focusable element inside the dialog (e.g., the first input or the close button). On unmount, return focus to the trigger element. A minimal approach:

```typescript
// In Modal.tsx, add a ref and useEffect:
const dialogRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!open) return;
  const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  firstFocusable?.focus();
}, [open]);

// Add ref={dialogRef} to the dialog div
```

---

### IN-03: `ProductsPage.tsx` / `MopsPage.tsx` — `setPendingToggleId` called inside `mutationFn`, not `onMutate`

**File:** `packages/frontend/src/pages/ProductsPage.tsx:32-34` and `packages/frontend/src/pages/MopsPage.tsx:30-32`

**Issue:** `setPendingToggleId(productId)` is called synchronously inside `mutationFn` before the API call. `mutationFn` runs in a microtask context and calling a React state setter there may trigger a React state update warning in strict mode ("Cannot update a component while rendering a different component"). The idiomatic place for pre-mutation side effects is `onMutate`:

```typescript
const toggleMutation = useMutation({
  mutationFn: (productId: number) =>
    api.patch<Product>(`/products/${productId}/toggle`).then((r) => r.data),
  onMutate: (productId) => {
    setPendingToggleId(productId); // MOVE HERE — correct lifecycle hook
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    setPendingToggleId(null);
  },
  onError: () => setPendingToggleId(null),
  onSettled: () => setPendingToggleId(null), // also clear on success via onSettled if preferred
});
```

---

_Reviewed: 2026-06-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
