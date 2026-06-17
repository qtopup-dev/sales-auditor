# Phase 2: Auth + Catalogs — Research

**Researched:** 2026-06-17
**Domain:** Express session auth, RBAC middleware, invite/token flow, React Router v6 guards, TanStack Query v5, Tailwind CSS v3 setup, Prisma 7 Decimal serialization, catalog CRUD
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Admin resets a user's password by clicking Reset Password — backend generates a cryptographically random temporary password, hashes+stores it immediately, returns the plaintext ONCE in the API response so the admin can copy it and share verbally or via direct message.

**D-02:** No forced change on next login. The temp password becomes the user's actual password. No `mustChangePassword` flag or extra redirect flow required.

**D-03:** Password reset immediately invalidates all active sessions for that user by destroying all session records where `sess` contains that user's ID.

**D-04:** Sidebar navigation — persistent left sidebar for all authenticated users. One shared `AuthenticatedLayout` component with role-based nav items. Admin sees: Dashboard, Products, MOPs, Users. Moderator sees: Sales Sheet only.

**D-05:** Admin "Dashboard" sidebar item routes to `/dashboard` — placeholder page in Phase 2. Phase 4 fills it out. Route/layout structure must exist in Phase 2.

**D-06:** Moderator uses the same sidebar chrome as admin, just with filtered nav items. One layout component, not two.

**D-07:** Products and MOPs use the same UI pattern: read-only table + Add button (opens modal for create) + row click/Edit button (opens same modal pre-filled for edit).

**D-08:** Product table columns: Name | Price | Status badge | Actions. MOP table columns: Name | Status badge | Actions. Status badge = green "Active" / gray "Inactive". Actions = Edit + Toggle Active/Inactive per row.

**D-09:** Price displayed and sent as string with 2 decimal places ("1000.00"). Prisma.Decimal on backend, never JS float. API returns price as string.

**D-10:** Role-based redirect on login: Admin → `/dashboard`, Moderator → `/sales`. Backend login response includes the user's role.

**D-11:** `returnTo` pattern for intercepted routes. Store attempted path in React Router location state, redirect to `/login`, after successful login redirect back to stored path. Falls back to role-based default if no returnTo.

**D-12:** `requireAuth` middleware checks `req.session.userId` on every `/api` route (except `/api/auth/login` and invite/register routes). Returns 401 JSON `{ error: 'UNAUTHORIZED' }`. `requireRole('admin')` stacks on top. Returns 403 JSON `{ error: 'FORBIDDEN' }`.

### Claude's Discretion

- Exact CSS styling for sidebar (colors, width, hover states) — use Tailwind utility classes, keep clean and functional
- Form validation error message copy on login (generic "Invalid credentials")
- Modal component structure (shared Modal wrapper or per-entity modal)
- Password minimum length for invite registration and temp password (8 characters)
- Exact format of generated temp password (alphanumeric, 12 characters from crypto.randomBytes)
- API route naming within standard REST conventions (`/api/auth/login`, `/api/products`, `/api/mops`, `/api/users`)

### Deferred Ideas (OUT OF SCOPE)

- Brute-force / rate-limit protection on `/api/auth/login` — v2 requirement
- `mustChangePassword` flow — not needed (D-02)
- Email delivery for invite or reset links — out of scope for v1
- Multiple admin accounts with distinct permission levels — v2
- "Remember me" / extended session toggle — rolling 30-day session handles this (AUTH-02)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can log in with username and password | bcrypt.compare(), express-session req.session.userId, POST /api/auth/login |
| AUTH-02 | Session persists until explicit logout (no auto-expiry) | rolling: true session config already in app.ts; no server-side TTL per-request |
| AUTH-03 | User can log out from any page, invalidating session immediately | req.session.destroy() pattern, axios POST /api/auth/logout, queryClient.clear() |
| AUTH-04 | Admin can create moderator account by generating invite link | crypto.randomBytes token + sha256 hash stored; /api/auth/invite POST |
| AUTH-05 | Invited user can register by visiting invite link, setting password | GET /invite/:token renders form; POST consumes token, creates user |
| AUTH-06 | Invite link is single-use and expires after 48 hours | InviteToken.usedAt check + expiresAt < now() check on GET and POST |
| AUTH-07 | Admin can manually reset any user's password; invalidates sessions | sessionPool.query() on sessions table to find+destroy by userId in data JSON |
| ROLES-01 | System enforces two roles: Admin and Moderator | Role enum in schema; requireRole('admin') middleware |
| ROLES-02 | Admin can toggle edit rights on/off for any individual moderator | PATCH /api/users/:id canEdit field; backend validates requester is admin |
| ROLES-03 | Moderator with edit rights can edit sales rows they created | Phase 3 concern — RBAC middleware pattern established here |
| ROLES-04 | Moderator without edit rights can only create new rows | Phase 3 concern — Phase 2 establishes canEdit field and middleware pattern |
| ROLES-05 | Admin can edit any sales row | Phase 3 concern — admin role check in middleware |
| ROLES-06 | Only admin can void sales rows | Phase 3 concern |
| ROLES-07 | Moderator sees only sales sheet + own entry history | Frontend: nav items filtered by role; backend: 403 on admin routes |
| ROLES-08 | Admin sees dashboard, all sales, user mgmt, product catalog, MOP catalog | AuthenticatedLayout with admin nav items; D-04 |
| ROLES-09 | Backend enforces all ownership and role checks | requireAuth + requireRole middleware applied at router level |
| PROD-01 | Admin can create product with name and price | POST /api/products; DECIMAL(10,2) via Prisma |
| PROD-02 | Admin can edit product name and price | PATCH /api/products/:id |
| PROD-03 | Admin can toggle product status active/inactive | PATCH /api/products/:id { isActive } |
| PROD-04 | Admin can view all products (active and inactive) | GET /api/products — override soft-delete filter for admin catalog |
| PROD-05 | Inactive products hidden from combo box | Phase 3 concern — filter isActive=true on combo endpoint |
| PROD-06 | Existing sales rows retain product name even if product edited/deactivated | price_snapshot + productNameSnapshot already in schema |
| PROD-07 | Price snapshot stored at row creation | priceSnapshot field on Sale model — schema already enforces this |
| PAY-01 | Admin can create MOP with name | POST /api/mops |
| PAY-02 | Admin can edit MOP name | PATCH /api/mops/:id |
| PAY-03 | Admin can toggle MOP status active/inactive | PATCH /api/mops/:id { isActive } |
| PAY-04 | Admin can view all MOPs (active and inactive) | GET /api/mops — override soft-delete filter for admin catalog |
| PAY-05 | Inactive MOPs hidden from combo box | Phase 3 concern |
| PAY-06 | Existing sales rows retain MOP reference even if deactivated | mopNameSnapshot in Sale schema |
</phase_requirements>

---

## Summary

Phase 2 builds a complete authentication and catalog management system on top of the Phase 1 foundation. The backend delivers six route groups: auth (login, logout, invite generation, invite registration, password reset), users (RBAC middleware stubs), products (full CRUD with soft-delete toggle), and MOPs (same pattern). The frontend transforms the Phase 1 placeholder into a fully-routed React application with Tailwind CSS v3, React Router v6 data router, TanStack Query v5, Zustand, axios interceptors, react-hook-form v7, and @tanstack/react-table v8.

The three technically complex areas are: (1) session invalidation-by-userId at password reset — the sessions table stores session data as a JSON blob in a `data` column and has no indexed userId column, requiring a direct MySQL query against the sessions table using the existing sessionPool; (2) Tailwind CSS v3 setup in the Vite monorepo — requires installing `tailwindcss@3 postcss autoprefixer` as devDependencies in the frontend package with a `tailwind.config.js` content path pointing to `./index.html` and `./src/**/*.{js,ts,jsx,tsx}`; and (3) the axios 401 interceptor integrating with queryClient.clear() and React Router navigation, which requires the queryClient instance to be accessible from outside the React tree.

**Primary recommendation:** Build backend first (Wave 1: auth routes + RBAC middleware), then frontend infrastructure (Wave 2: Tailwind + routing + QueryProvider + axios interceptor), then catalog pages (Wave 3). This order ensures the API exists before the UI tries to call it, and the session invalidation pattern (most complex and riskiest piece) gets validated in isolation.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session storage + invalidation | API / Backend | — | express-session + express-mysql-session; no browser touch required |
| Password hashing | API / Backend | — | bcrypt cost 12; never exposed to frontend |
| Invite token generation + hashing | API / Backend | — | crypto.randomBytes, sha256 hash stored; raw token returned once |
| RBAC enforcement | API / Backend | — | requireAuth + requireRole at router level; ROLES-09 |
| Route guards (client-side redirect) | Frontend Server (SPA router) | — | React Router v6 loader + redirect(); UI-only complement to backend 401 |
| Auth state management | Frontend (React) | — | Zustand store holds session user; cleared on logout |
| Server state cache management | Frontend (React Query) | — | queryClient.clear() on logout; invalidateQueries after mutations |
| Product/MOP CRUD | API / Backend | Database / Storage | Express routes + Prisma queries |
| Decimal-to-string serialization | API / Backend | — | price.toFixed(2) or price.toString() before JSON response |
| Soft-delete filter override (admin catalog) | API / Backend | — | Explicit where: { isActive: { in: [true, false] } } overrides the $extends default |

---

## Standard Stack

### Core Backend (already installed in packages/backend)
| Library | Version Installed | Purpose | Notes |
|---------|------------------|---------|-------|
| express | ^5.2.1 | HTTP framework | Express 5 — async errors auto-forwarded to errorHandler |
| express-session | ^1.19.0 (latest: 1.19.0) | Session middleware | Already wired in app.ts |
| express-mysql-session | ^3.0.3 (latest: 3.0.3) | MySQL session store | Already wired in app.ts; sessions table auto-created |
| express-validator | ^7.3.2 (latest: 7.3.2) | Request validation | body(), validationResult() pattern |
| bcrypt | ^6.0.0 (latest: 6.0.0) | Password hashing | cost factor 12 per CLAUDE.md |
| @prisma/client + @prisma/adapter-mariadb | ^7.8.0 | ORM | Generated client at packages/backend/generated/prisma/client.js |
| mysql2 | ^3.22.5 | Session store connection | Separate pool from Prisma adapter |

[VERIFIED: npm registry — all versions confirmed 2026-06-17]

### Core Frontend (to be installed in packages/frontend)
| Library | Version to Install | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| tailwindcss | ^3.4.19 (latest v3) | Utility CSS | v3 chosen over v4 per UI-SPEC.md — v4 drops tailwind.config.js |
| postcss | latest | Tailwind transform pipeline | Required by Tailwind v3 |
| autoprefixer | latest | Vendor prefix automation | Required by Tailwind v3 |
| react-router-dom | ^6.30.4 | SPA routing + route guards | v6 data router; createBrowserRouter |
| axios | ^1.18.0 | HTTP client | 401 interceptor for session expiry |
| @tanstack/react-query | ^5.101.0 | Server state management | queryClient.clear() on logout |
| zustand | ^5.0.14 | UI state management (auth user) | Lightweight; v5 uses useSyncExternalStore |
| react-hook-form | ^7.79.0 | Form management | useForm + Controller for react-select |
| react-select | ^5.10.2 | Searchable combo boxes | Phase 3 concern — install now so types are available |
| @tanstack/react-table | ^8.21.3 | Headless table | Product + MOP catalog tables |

[VERIFIED: npm registry — all versions confirmed 2026-06-17]

### Installation Commands

```bash
# Frontend devDependencies (Tailwind CSS v3 pipeline)
npm install -D tailwindcss@^3 postcss autoprefixer --workspace=@alejinput/frontend

# Frontend runtime dependencies
npm install react-router-dom@^6 axios@^1 @tanstack/react-query@^5 zustand react-hook-form@^7 react-select@^5 @tanstack/react-table@^8 --workspace=@alejinput/frontend

# Types for react-select (if not bundled)
npm install -D @types/react-select --workspace=@alejinput/frontend
```

**Note:** react-select v5 ships its own types. The `@types/react-select` package is deprecated. Do not install it.

[VERIFIED: npm registry 2026-06-17]

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │
  ├─ GET /invite/:token ──────────────────────────── Invite Registration Page
  │                                                         │
  ├─ POST /api/auth/register ◄───────────────────── form submit (raw token in body)
  │                                                         │
  ├─ GET /login ──────────────────────────────────── Login Page
  │                                                         │
  ├─ POST /api/auth/login ◄────────────────────────  form submit
  │       │                                                 │
  │    Set-Cookie: connect.sid ──────────────────────► returnTo redirect or role-based
  │
  ├─ All /api/* routes (authenticated)
  │       │
  │    [requireAuth] ── no session.userId ──► 401 UNAUTHORIZED
  │       │
  │    [requireRole('admin')] ── wrong role ──► 403 FORBIDDEN
  │       │
  │    Route handlers ──► Prisma queries ──► MySQL
  │                              │
  │                        (soft-delete $extends
  │                         auto-filters inactive)
  │
Frontend React SPA
  │
  ├─ createBrowserRouter routes
  │       │
  │    loader: authLoader ── no session user ──► redirect('/login', { state: { returnTo } })
  │       │
  │    AuthenticatedLayout (sidebar)
  │       ├─ /dashboard   (admin)
  │       ├─ /products    (admin)
  │       ├─ /mops        (admin)
  │       ├─ /users       (admin — Phase 4 fills)
  │       └─ /sales       (moderator — Phase 3 fills)
  │
  ├─ axios instance
  │    interceptor: response 401 ──► queryClient.clear() + navigate('/login')
  │
  └─ React Query (server state)
       └─ Zustand (auth user, UI state)
```

### Recommended Project Structure

```
packages/
├── backend/src/
│   ├── routes/
│   │   ├── auth.ts          # /api/auth/* (login, logout, invite, register, reset)
│   │   ├── products.ts      # /api/products (CRUD + toggle)
│   │   ├── mops.ts          # /api/mops (CRUD + toggle)
│   │   └── health.ts        # existing
│   ├── middleware/
│   │   ├── requireAuth.ts   # checks req.session.userId
│   │   ├── requireRole.ts   # checks req.session.role
│   │   └── errorHandler.ts  # existing
│   └── lib/
│       └── prisma.ts        # existing — soft-delete $extends
│
└── frontend/src/
    ├── router/
    │   └── index.tsx        # createBrowserRouter + all routes
    ├── layouts/
    │   └── AuthenticatedLayout.tsx
    ├── pages/
    │   ├── LoginPage.tsx
    │   ├── InviteRegisterPage.tsx
    │   ├── DashboardPage.tsx    # placeholder
    │   ├── ProductsPage.tsx
    │   ├── MopsPage.tsx
    │   └── SalesPage.tsx        # placeholder (Phase 3)
    ├── components/
    │   ├── Modal.tsx            # shared modal wrapper
    │   ├── StatusBadge.tsx
    │   └── catalog/
    │       ├── ProductModal.tsx
    │       └── MopModal.tsx
    ├── lib/
    │   ├── axios.ts             # axios instance + interceptor
    │   └── queryClient.ts       # QueryClient singleton
    └── stores/
        └── authStore.ts         # Zustand auth user state
```

---

### Pattern 1: requireAuth Middleware

**What:** Checks `req.session.userId` on every protected route.
**When to use:** Mount at the top of every protected router group.

```typescript
// Source: express-session docs + CONTEXT.md D-12
// packages/backend/src/middleware/requireAuth.ts
import { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
  interface SessionData {
    userId: number;
    role: 'admin' | 'moderator';
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  next();
}

export function requireRole(role: 'admin' | 'moderator') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.session.role !== role) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }
    next();
  };
}
```

**Critical:** The `declare module 'express-session'` SessionData augmentation must be in a file that is imported at startup. Placing it in `requireAuth.ts` works because auth routes import this middleware.

[CITED: expressjs.com/en/resources/middleware/session/]

---

### Pattern 2: Login Route

**What:** POST /api/auth/login — validates credentials, sets session, returns user + role.
**When to use:** Unauthenticated endpoint in authRouter.

```typescript
// Source: CONTEXT.md D-10, CLAUDE.md Rule 1
// packages/backend/src/routes/auth.ts (partial)
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';

const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

authRouter.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }

  const { username, password } = req.body;
  // Override soft-delete filter to allow finding any user by username
  const user = await prisma.user.findFirst({
    where: { username, isActive: true, organizationId: 1 },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    return;
  }

  req.session.userId = user.id;
  req.session.role = user.role;

  // Save session before responding (Express 5 + express-session best practice)
  await new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve()))
  );

  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      canEdit: user.canEdit,
      organizationId: user.organizationId,
    },
  });
});
```

[CITED: express-session npm README, bcrypt README]

---

### Pattern 3: Session Invalidation by UserId (AUTH-07 / Password Reset)

**What:** Destroy all active sessions for a given userId. The sessions table has no indexed userId column — the userId is inside the JSON `data` blob.

**The challenge:** `req.sessionStore.all()` is optional in the Store API. express-mysql-session v3 implements it, but iterating all sessions in-process and filtering by JSON parse is O(n) across all active sessions.

**Correct approach:** Use a direct SQL query against the sessions table via the existing `sessionPool` — more efficient and avoids loading all session data into Node memory.

```typescript
// Source: express-mysql-session GitHub Issue #72 + express-session Store API docs
// packages/backend/src/lib/invalidateUserSessions.ts
import { sessionPool } from '../app.js'; // export sessionPool from app.ts

export async function invalidateUserSessions(userId: number): Promise<void> {
  // Sessions table schema: session_id VARCHAR, expires BIGINT, data TEXT (JSON)
  // JSON_CONTAINS searches the data column for the userId.
  // MySQL 8.4 supports JSON_CONTAINS natively.
  const [rows] = await sessionPool.query<{ session_id: string }[]>(
    `SELECT session_id FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?`,
    [userId],
  );
  for (const row of rows) {
    await new Promise<void>((resolve) =>
      req.sessionStore.destroy(row.session_id, () => resolve())
    );
  }
}
```

**Alternative (simpler, no store reference needed):**
```typescript
// Direct DELETE — bypasses express-session entirely, uses raw SQL
await sessionPool.query(
  `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?`,
  [userId],
);
```

**Recommendation:** Use direct DELETE SQL. It is atomic, requires no sessionStore reference outside the handler, and avoids the session store's in-memory state. This is the pattern described in the CONTEXT.md specifics section.

**IMPORTANT: Export sessionPool from app.ts.** Currently `sessionPool` is scoped inside `createApp()`. Phase 2 must either export it or move it to a separate `lib/db.ts` module so auth routes can import it.

[CITED: expressjs.com/en/resources/middleware/session/ (Store API), github.com/chill117/express-mysql-session Issue #72]

---

### Pattern 4: Invite Token Flow

**What:** Generate a secure single-use invite link with 48h expiry.

```typescript
// Source: CONTEXT.md §Specifics, Node.js crypto docs
import crypto from 'crypto';
import bcrypt from 'bcrypt';

// Generate invite token
const rawToken = crypto.randomBytes(32).toString('base64url'); // URL-safe, 43 chars
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

await prisma.inviteToken.create({
  data: {
    tokenHash,
    role: 'moderator',
    createdById: adminUserId,
    expiresAt,
    organizationId: 1,
  },
});

// Return to admin: `${process.env.CLIENT_ORIGIN}/invite/${rawToken}`

// On GET /invite/:token — look up by hash (no mutation)
const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
const invite = await prisma.inviteToken.findUnique({ where: { tokenHash } });
// Check: invite exists, usedAt is null, expiresAt > now()

// On POST /invite/:token — consume token + create user in transaction
await prisma.$transaction(async (tx) => {
  await tx.inviteToken.update({
    where: { tokenHash },
    data: { usedAt: new Date() },
  });
  const passwordHash = await bcrypt.hash(password, 12);
  await tx.user.create({ data: { username, passwordHash, role: invite.role, organizationId: 1, ... } });
});
```

[CITED: nodejs.org/api/crypto.html, CONTEXT.md §Specifics]

---

### Pattern 5: Temp Password Reset

**What:** Admin-triggered password reset that invalidates sessions and returns plaintext once.

```typescript
// Source: CONTEXT.md D-01, D-03
const tempPassword = crypto.randomBytes(9).toString('base64url'); // 12-char URL-safe
const passwordHash = await bcrypt.hash(tempPassword, 12);

await prisma.user.update({
  where: { id: targetUserId },
  data: { passwordHash },
});

// Invalidate all sessions for this user (direct SQL via sessionPool)
await sessionPool.query(
  `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?`,
  [targetUserId],
);

res.json({ tempPassword }); // Returned ONCE — admin copies and shares manually
```

[CITED: CONTEXT.md D-01, D-03]

---

### Pattern 6: Soft-Delete Filter Override for Admin Catalog

**What:** The Prisma `$extends` in `prisma.ts` auto-injects `isActive: true` for `findMany`. Admin catalog routes need ALL records (active + inactive).

```typescript
// Source: packages/backend/src/lib/prisma.ts (existing soft-delete extension pattern)
// Override in admin catalog route — spread isActive into where after default
const products = await prisma.product.findMany({
  where: {
    organizationId: 1,
    isActive: { in: [true, false] }, // explicit override trumps the $extends default
  },
  orderBy: { createdAt: 'desc' },
});
```

**Why this works:** The `$extends` query override does `args.where = { isActive: true, ...args.where }`. If the caller provides `isActive: { in: [true, false] }`, it spreads over the default and wins.

[VERIFIED: packages/backend/src/lib/prisma.ts — confirmed spread order]

---

### Pattern 7: Decimal-to-String Serialization

**What:** Prisma returns `Decimal` instances. Return as string for API responses to honor CLAUDE.md Rule 6.

```typescript
// Source: Prisma docs on Decimal fields, CLAUDE.md Rule 6
const product = await prisma.product.findFirst({ where: { id } });
// product.price is a Decimal instance — NOT a JS number
res.json({
  ...product,
  price: product.price.toFixed(2), // "1000.00" — string, 2 decimal places always
});
```

**Never use:** `product.price.toNumber()` — this converts to JS float and risks precision loss.

[CITED: prisma.io/docs/orm/prisma-client/special-fields-and-types]

---

### Pattern 8: Tailwind CSS v3 Setup in Vite Monorepo

```bash
# Run from monorepo root, targeting frontend workspace
npm install -D tailwindcss@^3 postcss autoprefixer --workspace=@alejinput/frontend
npx tailwindcss init -p --prefix packages/frontend/
```

**tailwind.config.js** (at `packages/frontend/tailwind.config.js`):
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: { extend: {} },
  plugins: [],
}
```

**packages/frontend/src/index.css** (create if absent):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**packages/frontend/src/main.tsx** — import `./index.css` at top.

**postcss.config.js** (auto-generated by `init -p`, at `packages/frontend/postcss.config.js`):
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

[CITED: v3.tailwindcss.com/docs/guides/vite]

---

### Pattern 9: React Router v6 Auth Guard

**What:** createBrowserRouter with loader-based auth check. Redirect unauthenticated users with returnTo state.

```typescript
// Source: reactrouter.com/6.30.4/routers/create-browser-router
// packages/frontend/src/router/index.tsx
import { createBrowserRouter, redirect } from 'react-router-dom';
import { getAuthUser } from '../stores/authStore';

async function requireAuthLoader() {
  const user = getAuthUser(); // read from Zustand store (synchronous)
  if (!user) {
    // Redirect with returnTo state stored in location.state (D-11)
    // Note: loader redirect does not have access to current URL easily;
    // use a ProtectedRoute component pattern with <Navigate> for returnTo
    return redirect('/login');
  }
  return null;
}

async function requireAdminLoader() {
  const user = getAuthUser();
  if (!user) return redirect('/login');
  if (user.role !== 'admin') return redirect('/sales');
  return null;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/invite/:token', element: <InviteRegisterPage /> },
  {
    element: <AuthenticatedLayout />,
    loader: requireAuthLoader,
    children: [
      { path: '/dashboard', element: <DashboardPage />, loader: requireAdminLoader },
      { path: '/products', element: <ProductsPage />, loader: requireAdminLoader },
      { path: '/mops', element: <MopsPage />, loader: requireAdminLoader },
      { path: '/sales', element: <SalesPage /> },  // Phase 3 fills content
    ],
  },
]);
```

**returnTo handling:** The loader redirect approach does not carry location.state natively. Use a `<ProtectedRoute>` wrapper component using `useLocation` + `<Navigate to="/login" state={{ returnTo: location.pathname }} replace />` inside an Outlet-based pattern for returnTo support. Both patterns are valid; the component pattern is simpler for returnTo.

[CITED: reactrouter.com/6.30.4/routers/create-browser-router]

---

### Pattern 10: Axios Instance + 401 Interceptor

**What:** Shared axios instance with 401 response interceptor. On 401: clear RQ cache, navigate to login.

```typescript
// Source: TanStack Query v5 docs + axios interceptor pattern
// packages/frontend/src/lib/axios.ts
import axios from 'axios';
import { queryClient } from './queryClient';
import { router } from '../router';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Required for session cookie to be sent
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      queryClient.clear();
      const currentPath = router.state.location.pathname;
      router.navigate('/login', {
        state: { returnTo: currentPath },
        replace: true,
      });
    }
    return Promise.reject(error);
  },
);
```

**packages/frontend/src/lib/queryClient.ts:**
```typescript
import { QueryClient } from '@tanstack/react-query';
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});
```

**packages/frontend/src/main.tsx:**
```typescript
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './lib/queryClient';
import { router } from './router';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

[CITED: tanstack.com/query/v5/docs/reference/QueryClient, axios.js (interceptors docs)]

---

### Pattern 11: react-hook-form + Validation Pattern

```typescript
// Source: react-hook-form.com/docs
import { useForm } from 'react-hook-form';

type LoginFormData = { username: string; password: string };

const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>();

const onSubmit = async (data: LoginFormData) => {
  // api.post('/auth/login', data) — async, errors bubble to catch
};

// In JSX:
<form onSubmit={handleSubmit(onSubmit)}>
  <input {...register('username', { required: 'Username is required' })} />
  {errors.username && <span>{errors.username.message}</span>}
  <button type="submit" disabled={isSubmitting}>
    {isSubmitting ? 'Signing in...' : 'Log In'}
  </button>
</form>
```

[CITED: react-hook-form.com/get-started]

---

### Pattern 12: @tanstack/react-table v8 for Catalog Tables

```typescript
// Source: tanstack.com/table/v8/docs
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import type { Product } from '@alejinput/shared';

const columns: ColumnDef<Product>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'price', header: 'Price', meta: { align: 'right' } },
  { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge active={row.original.isActive} /> },
  { id: 'actions', header: 'Actions', cell: ({ row }) => <RowActions product={row.original} /> },
];

const table = useReactTable({
  data: products,
  columns,
  getCoreRowModel: getCoreRowModel(),
});
```

[CITED: tanstack.com/table/v8/docs]

---

### Pattern 13: Zustand Auth Store (v5)

```typescript
// Source: zustand.docs.pmnd.rs/learn/guides/beginner-typescript
import { create } from 'zustand';
import type { User } from '@alejinput/shared';

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

// For use outside React (in router loaders and axios interceptor):
export const getAuthUser = () => useAuthStore.getState().user;
```

[CITED: zustand.docs.pmnd.rs]

---

### Anti-Patterns to Avoid

- **Setting session before bcrypt.compare:** Always await the compare before calling `req.session.userId = ...`.
- **Checking invite token expiry with >= instead of >:** Use `invite.expiresAt < new Date()` — expired tokens should be rejected even at the boundary millisecond.
- **Returning price as a Prisma Decimal directly in res.json():** Decimal serializes to string in JSON but not necessarily as "1000.00". Always use `.toFixed(2)` explicitly.
- **Mounting requireRole middleware globally instead of per admin-router:** New routes added outside the protected admin router would bypass the role check. Mount at router level.
- **Using queryClient from context inside the axios interceptor:** The interceptor is created at module initialization time, before React mounts. Import the queryClient singleton directly, not via useQueryClient().
- **Forgetting `withCredentials: true` on axios instance:** Without this, the browser will not send the session cookie on cross-origin requests.
- **Trusting req.session.role alone without checking the DB:** For password reset and canEdit toggle, refetch the target user from DB — do not rely solely on the requester's session role (defense in depth).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash function | `bcrypt` (cost 12) | Timing-safe, adaptive cost, widely audited |
| Secure token generation | Math.random() or UUID | `crypto.randomBytes(32).toString('base64url')` | Cryptographically secure; UUID is not |
| Form validation (backend) | Manual req.body checks | `express-validator` body() chains | Consistent error shape, sanitization, async validators |
| Session store | In-memory Map | `express-mysql-session` | Survives server restart; already wired |
| Request validation error response | Per-route custom format | `validationResult(req).array()` | Consistent shape across all routes |
| Table rendering | Raw `<table>` with manual sort/filter | `@tanstack/react-table v8` | Headless; handles column types, row model, extensible to Phase 3 virtual scroll |
| Form state management | React.useState per field | `react-hook-form` useForm | Minimal re-renders, validation integration, isSubmitting state |

**Key insight:** The session invalidation-by-userId is the one area where hand-rolling a direct SQL query is the CORRECT approach — the MySQLStore.all() callback iteration is O(n) sessions in memory and adds unnecessary complexity. A targeted `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?` is O(1) with MySQL's JSON function optimizer.

---

## Common Pitfalls

### Pitfall 1: sessionPool Not Exported from app.ts

**What goes wrong:** `createApp()` creates `sessionPool` as a local variable. Auth routes that need to run `DELETE FROM sessions` cannot import it.
**Why it happens:** Phase 1 only needed the pool inside `createApp()` for configuring the session store. Phase 2 introduces the password reset flow that needs the pool externally.
**How to avoid:** Export `sessionPool` from `app.ts` (or extract to `lib/db.ts`). Plan must include this as a prerequisite step before implementing password reset.
**Warning signs:** TypeScript "cannot find name 'sessionPool'" in auth route files.

[VERIFIED: packages/backend/src/app.ts inspection — pool is currently local]

### Pitfall 2: Soft-Delete $extends Override Order

**What goes wrong:** Admin product/MOP catalog queries return only active records instead of all records.
**Why it happens:** The $extends query interceptor does `args.where = { isActive: true, ...args.where }`. If the caller passes `where: { organizationId: 1 }`, the default `isActive: true` is NOT overridden.
**How to avoid:** Explicit override: `where: { organizationId: 1, isActive: { in: [true, false] } }`. The caller's explicit `isActive` key overrides the default.
**Warning signs:** Admin catalog page shows 0 inactive items even after creating them.

[VERIFIED: packages/backend/src/lib/prisma.ts line 29 — spread order confirmed]

### Pitfall 3: Tailwind Config Missing Monorepo Path Context

**What goes wrong:** Tailwind purges all classes from the built CSS because `content` paths don't resolve from the config file's location.
**Why it happens:** `tailwind.config.js` is at `packages/frontend/` but Vite may be invoked from the repo root. Content paths like `"./src/**/*.{ts,tsx}"` are relative to the config file — which IS `packages/frontend/` — so they're correct as long as the config is co-located with the code.
**How to avoid:** Place `tailwind.config.js` and `postcss.config.js` at `packages/frontend/` (same level as `vite.config.ts`). Vite picks up PostCSS config automatically from the project root (the Vite `root` option set to `__dirname` in `vite.config.ts`).
**Warning signs:** Build succeeds but no Tailwind classes are applied; CSS file is tiny (~3KB instead of expected utility output).

[CITED: v3.tailwindcss.com/docs/guides/vite]

### Pitfall 4: Session Not Saved Before Response on Login

**What goes wrong:** The client receives the login success response but the session cookie is not yet committed to MySQL. Subsequent API requests fail with 401.
**Why it happens:** Express-session is async — `req.session.save()` is triggered automatically, but in Express 5 with async handlers, the response can be sent before the session write completes.
**How to avoid:** Explicitly `await req.session.save()` (promisified) before calling `res.json()` in the login handler.
**Warning signs:** Login page shows "success" but the next page load immediately redirects back to `/login`.

[CITED: express-session npm README, save() callback behavior]

### Pitfall 5: Decimal Serialization Inconsistency

**What goes wrong:** `res.json({ price: product.price })` works in development but produces unexpected string format — Prisma's Decimal .toString() may produce "1000" instead of "1000.00" for round numbers.
**Why it happens:** Prisma Decimal uses Decimal.js internally. `toString()` drops trailing zeros. `toFixed(2)` always produces exactly 2 decimal places.
**How to avoid:** Always use `.toFixed(2)` on every price field before returning from API.
**Warning signs:** Frontend displays "1000" instead of "1000.00"; UI tests fail on price formatting.

[CITED: prisma.io/docs/orm/prisma-client/special-fields-and-types]

### Pitfall 6: React Query Retry on 401 Floods the Server

**What goes wrong:** When the session expires, React Query retries failed queries 3 times (default) before the interceptor fires. This produces 3× the number of 401 requests.
**Why it happens:** React Query's default `retry: 3` applies before the interceptor processes the 401.
**How to avoid:** Set `defaultOptions: { queries: { retry: false } }` or `retry: (failureCount, error) => error.response?.status !== 401` in QueryClient config.
**Warning signs:** Network tab shows 3 identical 401 requests per session-expired API call.

[CITED: tanstack.com/query/v5/docs/reference/QueryClient]

### Pitfall 7: InviteToken GET Renders Form Statelessly

**What goes wrong:** A GET request to `/invite/:token` that calls `tokenStore.markUsed()` — security scanners (and some browser prefetch mechanisms) will consume the token before the user sees the form.
**Why it happens:** Treating the GET as a side-effectful operation.
**How to avoid:** GET renders the form only (validates token is present and unexpired — no mutation). POST consumes the token. This is already documented in CONTEXT.md and STATE.md pitfalls.
**Warning signs:** Admin generates invite link, user visits URL, but registration form shows "expired" on first visit.

[VERIFIED: packages/backend/prisma/schema.prisma — InviteToken.usedAt is nullable, set only on POST]

---

## Code Examples

### Express 5 Route Pattern with Validation (Backend)

```typescript
// Source: express-validator docs + Express 5 async error handling
// Express 5: no need for try/catch or .catch(next) — async errors auto-forward to errorHandler
import { Router } from 'express';
import { body, validationResult } from 'express-validator';

const router = Router();

router.post(
  '/products',
  [
    body('name').trim().notEmpty().withMessage('Product Name is required'),
    body('price')
      .trim()
      .notEmpty()
      .withMessage('Price is required')
      .isDecimal({ decimal_digits: '0,2' })
      .withMessage('Enter a valid price (e.g., 10.00)'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }
    const product = await prisma.product.create({
      data: {
        name: req.body.name,
        price: req.body.price, // Prisma accepts decimal string for Decimal fields
        organizationId: 1,
      },
    });
    res.status(201).json({
      ...product,
      price: product.price.toFixed(2),
    });
  },
);
```

### Logout Handler

```typescript
// packages/backend/src/routes/auth.ts
authRouter.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'LOGOUT_FAILED' });
      return;
    }
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});
```

### React Query Mutation for Product Create

```typescript
// Source: tanstack.com/query/v5/docs/framework/react/guides/mutations
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/axios';

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; price: string }) =>
      api.post('/products', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind `tailwind.config.js` with CommonJS | ESM `export default` config | Tailwind v3.3+ | Use `export default` not `module.exports` since Vite config is ESM |
| Zustand `create()` (no TypeScript generic) | `create<State>()()` curried | Zustand v4+ | Required for TypeScript type inference |
| React Query `useQuery({ onError })` option | `useQuery` + `queryClient.getQueryDefaults` or error boundary | React Query v5 | v5 removed per-query `onError` callback — handle in mutation `onError` or global error handler |
| express-session `$use` middleware (Prisma) | Prisma `$extends` query override | Prisma 5+ | `$use` removed in Prisma 7; confirmed in lib/prisma.ts |
| Prisma `generator client { provider = "prisma-client-js" }` | `provider = "prisma-client"` | Prisma 7 | Schema already correct; import from `generated/prisma/client.js` |
| `tailwind.config.js` in project root | `tailwind.config.js` co-located with Vite config | Tailwind v3 monorepo | Must be in `packages/frontend/` for PostCSS to pick it up via Vite root |

**Deprecated/outdated in this stack:**
- `@types/react-select`: Deprecated — react-select v5 ships its own TypeScript types. Do not install.
- `MemoryStore` for sessions: Never use in production. Already mitigated in app.ts.
- Prisma `$use`: Removed in Prisma 7. Use `$extends` — already done in lib/prisma.ts.

---

## Project Constraints (from CLAUDE.md)

| Directive | Area | Enforcement |
|-----------|------|-------------|
| express-session over JWT — no exceptions | Auth architecture | requireAuth reads req.session.userId; never issue JWTs |
| Audit log in same transaction | Mutations (Phase 3 concern) | Not applicable in Phase 2 — no sales mutations |
| Soft-delete only (is_active BOOLEAN / status ENUM) | Data model | Toggle isActive; never DELETE from products or mops tables |
| Price snapshot at creation | Sale creation (Phase 3 concern) | Phase 2 must ensure Product.price is returned as string so Phase 3 can copy it |
| organization_id on every business table | All create operations | Pass organizationId: 1 on every prisma.create() call in Phase 2 |
| DECIMAL(10,2) for monetary values | Products price | Prisma schema: Decimal; API response: price.toFixed(2) string |
| UTC everywhere | Timestamps | TZ=UTC in Node (already enforced in index.ts); no new config needed |
| Soft-delete filter enforcement | All findMany queries | $extends handles it; admin catalog overrides with isActive: { in: [true, false] } |
| Backend enforces RBAC | Route middleware | requireAuth + requireRole at router level; never rely on frontend checks |
| Pessimistic UI updates | Forms and row actions | Disable inputs + show "Saving..." during round-trip; no optimistic cache updates |
| React 18.3.1 exact pin | package.json | Do not change React version |
| Prisma 7 client at packages/backend/generated/prisma/client.js | Imports | Import as `from '../../generated/prisma/client.js'` |
| Backend tsconfig moduleResolution: node16 | TypeScript imports | All backend imports must use `.js` extensions |

---

## Runtime State Inventory

This is a greenfield phase (new feature development on top of Phase 1 foundation). Not a rename/refactor/migration phase.

**Stored data:** No existing production data to migrate. The seeded admin user (from Phase 1 seed) is the only existing row.

**Live service config:** No external service configurations reference Phase 2 entities yet.

**OS-registered state:** None.

**Secrets/env vars:** `SESSION_SECRET` must be set in `packages/backend/.env` — if it falls back to the default `'change-me-in-production'` value in `app.ts`, sessions will be insecure. Plan must include a note to set this.

**Build artifacts:** None — Phase 1 frontend was a placeholder with no built output to invalidate.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All JS execution | Yes | v22.17.0 | — |
| Docker | MySQL 8.4 via docker-compose | Yes | 28.3.0 | — |
| npm workspaces | Package installs | Yes | (via Node 22) | — |
| MySQL 8.4 (in Docker) | All database operations | Assumed running | 8.4 | Start docker-compose |

[VERIFIED: node --version → v22.17.0, docker --version → 28.3.0, confirmed 2026-06-17]

**Missing dependencies with no fallback:** None identified.

**Note:** MySQL is assumed running in Docker from Phase 1 setup. The plan should include a note to verify `docker-compose up -d` before running migrations or seeding.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `organizationId: 1` hardcoded — single org in v1 | All create patterns | If org seed created with different ID, all FK constraints fail. Verify seed output. |
| A2 | The `sessions` table `data` column stores JSON with `userId` key matching `req.session.userId` | Pattern 3 (session invalidation) | If express-mysql-session serializes differently, `JSON_EXTRACT(data, '$.userId')` returns NULL. Verify by logging a session row after login. |
| A3 | PostCSS config auto-discovered by Vite when `postcss.config.js` is at `packages/frontend/` (Vite root) | Tailwind setup pattern | If PostCSS is not found, Tailwind classes will not be processed. |

---

## Open Questions

1. **SESSION_SECRET value in .env**
   - What we know: `app.ts` falls back to `'change-me-in-production'` if `SESSION_SECRET` is unset.
   - What's unclear: Has a real value been set in `packages/backend/.env`? (File is gitignored — cannot inspect.)
   - Recommendation: Plan must include a task to verify/set `SESSION_SECRET` before testing auth flows.

2. **Organization seed ID**
   - What we know: The Phase 1 seed creates one Organization row. All Phase 2 creates hardcode `organizationId: 1`.
   - What's unclear: Confirm the seeded organization has ID 1 (it should — auto_increment starts at 1).
   - Recommendation: Include DB verification step in Wave 1 smoke test.

3. **Sessions table column names from express-mysql-session**
   - What we know: Default schema has columns `session_id`, `expires`, `data`. Data is JSON text.
   - What's unclear: Exact key names inside the `data` JSON blob that express-mysql-session stores.
   - Recommendation: After implementing login, log `SELECT data FROM sessions LIMIT 1;` to confirm the JSON structure before implementing the password reset SQL query.

---

## Validation Architecture

> `workflow.nyquist_validation` is `false` in config.json — this section is SKIPPED per config.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | bcrypt cost 12; generic error message "Invalid credentials" (no username enumeration) |
| V3 Session Management | Yes | express-session; httpOnly + sameSite lax cookies; rolling: true; destroy on logout |
| V4 Access Control | Yes | requireAuth + requireRole at router level; organizationId on every query |
| V5 Input Validation | Yes | express-validator body() chains on all mutation endpoints |
| V6 Cryptography | Yes | crypto.randomBytes for tokens; bcrypt for passwords; sha256 for token storage |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Session fixation | Elevation of privilege | Regenerate session ID after login: `req.session.regenerate()` before setting userId |
| Username enumeration via timing | Information disclosure | Generic "Invalid credentials" message; constant-time bcrypt.compare() |
| Invite token brute-force | Elevation of privilege | 32 bytes of randomness = 256 bits; sha256 hash in DB; short 48h window |
| Open redirect via returnTo | Spoofing | Keep returnTo in React Router location state only — never server-side; validate it's a relative path |
| XSS access to session cookie | Tampering | httpOnly: true already in app.ts; no change needed |
| CSRF | Tampering | sameSite: 'lax' already in app.ts; no additional token needed for internal tool |
| Storing raw password reset token | Information disclosure | Never store raw token; only store bcrypt hash of temp password (D-01 pattern) |

**Session regeneration note:** After successful login, call `req.session.regenerate()` before setting `req.session.userId`. This prevents session fixation attacks where an attacker pre-plants a session ID. This is not in the current CONTEXT.md patterns but is a best practice.

[CITED: expressjs.com/en/resources/middleware/session/ — regenerate() method]

---

## Sources

### Primary (HIGH confidence)
- packages/backend/src/app.ts — confirmed session store configuration, sessionPool local scope
- packages/backend/src/lib/prisma.ts — confirmed $extends spread order for soft-delete override
- packages/backend/prisma/schema.prisma — confirmed InviteToken model, User.passwordHash, Decimal types
- packages/shared/src/types/product.ts, user.ts, mop.ts — confirmed API response shape contracts
- packages/frontend/package.json — confirmed no frontend deps installed yet (Phase 2 installs all)
- packages/backend/package.json — confirmed all backend deps installed
- npm registry — all version numbers verified 2026-06-17

### Secondary (MEDIUM confidence)
- [expressjs.com/en/resources/middleware/session/](https://expressjs.com/en/resources/middleware/session/) — Store API methods (all(), destroy(), get())
- [v3.tailwindcss.com/docs/guides/vite](https://v3.tailwindcss.com/docs/guides/vite) — tailwind.config.js content paths, postcss.config.js setup
- [reactrouter.com/6.30.4/routers/create-browser-router](https://reactrouter.com/6.30.4/routers/create-browser-router) — loader + redirect() auth guard pattern
- [tanstack.com/query/v5/docs/reference/QueryClient](https://tanstack.com/query/v5/docs/reference/QueryClient) — queryClient.clear() on logout
- [prisma.io/docs/orm/prisma-client/special-fields-and-types](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types) — Decimal.toFixed(2) serialization

### Tertiary (LOW confidence — flagged)
- github.com/chill117/express-mysql-session Issue #72 — sessions table JSON structure, userId in data blob (needs runtime verification per Assumption A2)
- WebSearch results on Zustand v5 TypeScript patterns — consistent with official docs but not directly verified via official docs URL

---

## Metadata

**Confidence breakdown:**
- Standard stack (backend): HIGH — all packages pre-installed and confirmed in package.json
- Standard stack (frontend installs): HIGH — npm registry verified versions
- Architecture patterns: HIGH — based on official docs + direct codebase inspection
- Session invalidation by userId: MEDIUM — approach derived from express-mysql-session docs + GitHub issue; runtime JSON key structure is ASSUMED (A2)
- Tailwind v3 Vite monorepo setup: HIGH — official Tailwind v3 Vite guide confirmed
- Security domain: HIGH — ASVS standard controls with well-known mitigations

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (stable ecosystem — 30-day validity)
