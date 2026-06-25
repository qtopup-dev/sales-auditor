# Phase 2: Auth + Catalogs — Pattern Map

**Mapped:** 2026-06-17
**Files analyzed:** 21 new/modified files
**Analogs found:** 21 / 21 (all files have at least a partial analog or research-derived pattern; 4 files have direct codebase analogs, 17 use research patterns grounded in existing codebase conventions)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/backend/src/app.ts` (modify) | config | request-response | `packages/backend/src/app.ts` | self — add mount points |
| `packages/backend/src/lib/db.ts` (new) | utility | — | `packages/backend/src/lib/prisma.ts` | role-match (lib singleton) |
| `packages/backend/src/middleware/requireAuth.ts` | middleware | request-response | `packages/backend/src/middleware/errorHandler.ts` | role-match (middleware) |
| `packages/backend/src/middleware/requireRole.ts` | middleware | request-response | `packages/backend/src/middleware/errorHandler.ts` | role-match (middleware) |
| `packages/backend/src/routes/auth.ts` | route | request-response | `packages/backend/src/routes/health.ts` | role-match (router pattern) |
| `packages/backend/src/routes/products.ts` | route | CRUD | `packages/backend/src/routes/health.ts` | role-match (router pattern) |
| `packages/backend/src/routes/mops.ts` | route | CRUD | `packages/backend/src/routes/health.ts` | role-match (router pattern) |
| `packages/backend/src/routes/users.ts` | route | CRUD | `packages/backend/src/routes/health.ts` | role-match (router pattern) |
| `packages/shared/src/types/index.ts` (modify) | model | — | `packages/shared/src/types/index.ts` | self — add exports |
| `packages/frontend/src/main.tsx` (modify) | config | — | `packages/frontend/src/main.tsx` | self — add providers |
| `packages/frontend/src/App.tsx` (replace) | config | — | `packages/frontend/src/App.tsx` | self — full replace |
| `packages/frontend/src/lib/axios.ts` | utility | request-response | `packages/backend/src/lib/prisma.ts` | role-match (lib singleton) |
| `packages/frontend/src/lib/queryClient.ts` | utility | — | `packages/backend/src/lib/prisma.ts` | role-match (lib singleton) |
| `packages/frontend/src/stores/authStore.ts` | store | — | `packages/backend/src/lib/prisma.ts` | role-match (singleton export) |
| `packages/frontend/src/router/index.tsx` | route | request-response | `packages/backend/src/routes/health.ts` | partial (router definition) |
| `packages/frontend/src/layouts/AuthenticatedLayout.tsx` | component | request-response | none | no analog |
| `packages/frontend/src/pages/LoginPage.tsx` | component | request-response | none | no analog |
| `packages/frontend/src/pages/InviteRegisterPage.tsx` | component | request-response | none | no analog |
| `packages/frontend/src/pages/DashboardPage.tsx` | component | — | none | no analog (placeholder) |
| `packages/frontend/src/pages/ProductsPage.tsx` | component | CRUD | none | no analog |
| `packages/frontend/src/pages/MopsPage.tsx` | component | CRUD | none | no analog |
| `packages/frontend/src/pages/SalesPage.tsx` | component | — | none | no analog (placeholder) |
| `packages/frontend/src/components/Modal.tsx` | component | — | none | no analog |
| `packages/frontend/src/components/StatusBadge.tsx` | component | — | none | no analog |
| `packages/frontend/src/components/catalog/ProductModal.tsx` | component | CRUD | none | no analog |
| `packages/frontend/src/components/catalog/MopModal.tsx` | component | CRUD | none | no analog |

---

## Pattern Assignments

### `packages/backend/src/app.ts` (modify — add route mounts)

**Analog:** `packages/backend/src/app.ts` (self)

**Existing mount section** (lines 80–83) — insert Phase 2 router mounts here:
```typescript
// 6. Routes
app.use('/', healthRouter);
// Phase 2 will add: app.use('/api/auth', authRouter);
// Phase 2 will add: app.use('/api', protectedRouter);
```

**Export sessionPool** — currently declared as `const sessionPool` inside `createApp()` at line 45. Must be promoted to module-level export so `lib/db.ts` can expose it. Pattern: follow how `prisma.ts` exports its singleton — export at module level, not inside a function.

**Modified mount section to replace lines 80–86:**
```typescript
// 6. Routes
app.use('/', healthRouter);
app.use('/api/auth', authRouter);        // unauthenticated auth endpoints
app.use('/api', requireAuth, protectedRouter); // all protected API endpoints

// 7. Global error handler — MUST be last middleware
app.use(errorHandler);
```

---

### `packages/backend/src/lib/db.ts` (new — extract sessionPool)

**Analog:** `packages/backend/src/lib/prisma.ts` (lines 1–18)

**Imports pattern** (copy from `prisma.ts` lines 1–4):
```typescript
import 'dotenv/config';
import mysql2 from 'mysql2/promise';
```

**Core singleton pattern** (from `prisma.ts` lines 8–18 — same shape, different driver):
```typescript
// packages/backend/src/lib/db.ts
import 'dotenv/config';
import mysql2 from 'mysql2/promise';

export const sessionPool = mysql2.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
```

**Why extract:** `app.ts` currently creates `sessionPool` as a local variable inside `createApp()`. The password reset route needs to run `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?` — it cannot import a variable scoped inside a function. Extract to `lib/db.ts`, import in both `app.ts` (for `MySQLSessionStore`) and `routes/auth.ts` (for session invalidation).

---

### `packages/backend/src/middleware/requireAuth.ts` (new)

**Analog:** `packages/backend/src/middleware/errorHandler.ts` (lines 1–23)

**Imports pattern** (from `errorHandler.ts` lines 1–2):
```typescript
import { Request, Response, NextFunction } from 'express';
```

**SessionData augmentation** — must be in this file so it's available wherever `requireAuth` is imported:
```typescript
declare module 'express-session' {
  interface SessionData {
    userId: number;
    role: 'admin' | 'moderator';
  }
}
```

**Core middleware pattern** (modeled on `errorHandler.ts` 4-parameter shape, simplified to 3):
```typescript
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  next();
}
```

**Error response shape** — must match `errorHandler.ts` which uses `{ error: string, message: string }`. However, D-12 explicitly specifies `{ error: 'UNAUTHORIZED' }` for middleware responses (no `message` key). This is intentional — middleware returns minimal JSON, the global handler adds `message`.

---

### `packages/backend/src/middleware/requireRole.ts` (new)

**Analog:** `packages/backend/src/middleware/errorHandler.ts`

**Core pattern** (curried middleware — returns a middleware function):
```typescript
import { Request, Response, NextFunction } from 'express';

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

**Mount pattern** — from RESEARCH.md D-12: stack on top of `requireAuth` at router level, NOT per-route:
```typescript
// In protectedRouter or adminRouter setup:
adminRouter.use(requireRole('admin'));
// All routes registered on adminRouter automatically require admin role
```

---

### `packages/backend/src/routes/auth.ts` (new)

**Analog:** `packages/backend/src/routes/health.ts` (lines 1–13)

**Imports pattern** (from `health.ts` lines 1–2, extended):
```typescript
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { sessionPool } from '../lib/db.js';
```

**Router export pattern** (from `health.ts` line 4):
```typescript
export const authRouter = Router();
```

**Express 5 async handler pattern** (from `health.ts` line 8 — Express 5 auto-forwards async errors, no try/catch needed):
```typescript
// Express 5: no .catch(next) needed — async errors auto-forward to errorHandler
authRouter.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;  // explicit return after res.* in Express 5 void handlers
  }
  // ... handler body
});
```

**Validation array pattern** (from RESEARCH.md Pattern 2):
```typescript
const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];
```

**Session save pattern** (from RESEARCH.md Pitfall 4 — must await save before responding):
```typescript
// After setting req.session.userId and req.session.role:
await new Promise<void>((resolve, reject) =>
  req.session.save((err) => (err ? reject(err) : resolve()))
);
res.json({ user: { ... } });
```

**Session invalidation pattern** (from RESEARCH.md Pattern 3 — for password reset):
```typescript
// Direct DELETE — most efficient; no sessionStore reference needed
await sessionPool.query(
  `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?`,
  [targetUserId],
);
```

**Invite token pattern** (from RESEARCH.md Pattern 4):
```typescript
const rawToken = crypto.randomBytes(32).toString('base64url');
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
```

**Temp password pattern** (from RESEARCH.md Pattern 5):
```typescript
const tempPassword = crypto.randomBytes(9).toString('base64url'); // 12-char URL-safe
const passwordHash = await bcrypt.hash(tempPassword, 12);
```

**Prisma import path** — from `prisma.ts` line 6. Note `.js` extension required (CLAUDE.md: `moduleResolution: node16`):
```typescript
import { PrismaClient } from '../../generated/prisma/client.js';
// But use the singleton:
import { prisma } from '../lib/prisma.js';
```

**organizationId hardcode** — from RESEARCH.md Assumption A1: all creates use `organizationId: 1` in Phase 2.

---

### `packages/backend/src/routes/products.ts` (new)

**Analog:** `packages/backend/src/routes/health.ts` (router pattern) + `packages/backend/src/lib/prisma.ts` (soft-delete override)

**Imports pattern:**
```typescript
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
```

**Router export pattern** (from `health.ts` line 4):
```typescript
export const productsRouter = Router();
```

**Admin catalog query — soft-delete override** (from `prisma.ts` lines 44–50, RESEARCH.md Pattern 6):
```typescript
// isActive: { in: [true, false] } overrides the $extends default of isActive: true
// Spread order in prisma.ts line 29: { isActive: true, ...args.where }
// Caller's explicit isActive key wins when spread last
const products = await prisma.product.findMany({
  where: {
    organizationId: 1,
    isActive: { in: [true, false] },
  },
  orderBy: { createdAt: 'desc' },
});
```

**Decimal serialization** (from RESEARCH.md Pattern 7 — always `.toFixed(2)`, never `.toNumber()`):
```typescript
res.json({
  ...product,
  price: product.price.toFixed(2), // "1000.00" — always 2 decimal places
});
```

**Validation for price** (from RESEARCH.md Code Examples):
```typescript
body('price')
  .trim()
  .notEmpty().withMessage('Price is required')
  .isDecimal({ decimal_digits: '0,2' }).withMessage('Enter a valid price (e.g., 10.00)'),
```

**Soft-delete toggle pattern** (PATCH — never DELETE, CLAUDE.md Rule 3):
```typescript
productsRouter.patch('/:id', async (req, res) => {
  // ... validation ...
  const product = await prisma.product.update({
    where: { id: Number(req.params.id), organizationId: 1 },
    data: { isActive: req.body.isActive }, // toggle; or update name/price
  });
  res.json({ ...product, price: product.price.toFixed(2) });
});
```

---

### `packages/backend/src/routes/mops.ts` (new)

**Analog:** `packages/backend/src/routes/products.ts` (same pattern, no price field)

Identical router pattern to `products.ts` with:
- No `price` field in create/update
- No Decimal serialization needed
- Model: `prisma.mop` instead of `prisma.product`
- Validation: only `body('name').trim().notEmpty().withMessage('Payment Method Name is required')`

---

### `packages/backend/src/routes/users.ts` (new)

**Analog:** `packages/backend/src/routes/health.ts` (router pattern)

Provides: `GET /api/users` (admin), `PATCH /api/users/:id` (canEdit toggle + password reset).

**Password reset endpoint pattern** (from RESEARCH.md Pattern 5):
```typescript
usersRouter.post('/:id/reset-password', requireRole('admin'), async (req, res) => {
  const tempPassword = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  await prisma.user.update({
    where: { id: Number(req.params.id), organizationId: 1 },
    data: { passwordHash },
  });
  await sessionPool.query(
    `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?`,
    [Number(req.params.id)],
  );
  res.json({ tempPassword }); // returned ONCE — admin copies and shares
});
```

---

### `packages/shared/src/types/index.ts` (modify — add InviteToken export)

**Analog:** `packages/shared/src/types/index.ts` (lines 1–12, self)

**Existing export pattern** (lines 8–12 — use same `export type { ... } from './file.js'` style):
```typescript
export type { Role, User, Organization } from './user.js';
export type { Product } from './product.js';
export type { Mop } from './mop.js';
export type { SaleStatus, Sale } from './sale.js';
export type { AuditAction, AuditEntry } from './audit.js';
```

**Add:**
```typescript
export type { InviteToken, AuthSession } from './auth.js';
```

**New file `packages/shared/src/types/auth.ts`** — follow exact shape of `user.ts` (lines 1–16):
```typescript
// API response shape for auth-related types
export interface InviteToken {
  id: number;
  organizationId: number;
  role: 'admin' | 'moderator';
  createdById: number;
  expiresAt: string;       // ISO 8601 UTC string
  usedAt: string | null;
  createdAt: string;
}

export interface AuthSession {
  user: {
    id: number;
    username: string;
    role: 'admin' | 'moderator';
    canEdit: boolean;
    organizationId: number;
  };
}
```

---

### `packages/frontend/src/main.tsx` (modify — add providers)

**Analog:** `packages/frontend/src/main.tsx` (self, lines 1–15)

**Current pattern** (lines 1–15):
```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

**Modified pattern** (replace App with QueryClientProvider + RouterProvider, add CSS import):
```typescript
import './index.css';                          // Tailwind CSS v3 directives
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './lib/queryClient';
import { router } from './router';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
```

**Note:** `App.tsx` becomes `router/index.tsx`. The `App.tsx` file is either deleted or replaced with a thin re-export. Simplest path: replace `App.tsx` content with `export {}` (no-op) and do everything in `main.tsx` + `router/index.tsx`.

---

### `packages/frontend/src/lib/axios.ts` (new)

**Analog:** `packages/backend/src/lib/prisma.ts` (lib singleton export pattern)

**Core singleton pattern** (from `prisma.ts` lines 17–22 — named export of configured instance):
```typescript
// packages/frontend/src/lib/axios.ts
import axios from 'axios';
import { queryClient } from './queryClient';
import { router } from '../router';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Required — session cookie must be sent (RESEARCH.md Anti-Patterns)
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

**Critical:** Import `queryClient` directly (the singleton), NOT via `useQueryClient()`. The interceptor is created at module init time, before React mounts. See RESEARCH.md Anti-Patterns.

---

### `packages/frontend/src/lib/queryClient.ts` (new)

**Analog:** `packages/backend/src/lib/prisma.ts` (singleton export pattern)

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      // Do NOT use retry: 3 (default) — on 401, React Query would send 3 requests
      // before the interceptor fires. See RESEARCH.md Pitfall 6.
    },
  },
});
```

---

### `packages/frontend/src/stores/authStore.ts` (new)

**Analog:** `packages/backend/src/lib/prisma.ts` (named export of configured instance)

**Zustand v5 pattern** (curried `create<State>()()` — required for TypeScript, from RESEARCH.md Pattern 13):
```typescript
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

// Synchronous getter for use outside React (router loaders, axios interceptor)
export const getAuthUser = () => useAuthStore.getState().user;
```

**Note:** Zustand v5 (installed) requires `create<State>()()` with double invocation — NOT `create<State>()` (single). See RESEARCH.md State of the Art table.

---

### `packages/frontend/src/router/index.tsx` (new)

**Analog:** `packages/backend/src/routes/health.ts` (router definition export pattern)

**Router export pattern** — named export mirroring `health.ts` line 4:
```typescript
export const router = createBrowserRouter([...]);
```

**Auth guard pattern** (from RESEARCH.md Pattern 9 — ProtectedRoute component recommended for returnTo support):
```typescript
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { getAuthUser } from '../stores/authStore';

function ProtectedRoute({ requiredRole }: { requiredRole?: 'admin' | 'moderator' }) {
  const user = getAuthUser();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
  }
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'admin' ? '/dashboard' : '/sales'} replace />;
  }
  return <Outlet />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/invite/:token', element: <InviteRegisterPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { element: <AuthenticatedLayout />, children: [
        { path: '/sales', element: <SalesPage /> },
        { element: <ProtectedRoute requiredRole="admin" />, children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/products', element: <ProductsPage /> },
          { path: '/mops', element: <MopsPage /> },
        ]},
      ]},
    ],
  },
]);
```

---

### `packages/frontend/src/layouts/AuthenticatedLayout.tsx` (new)

**Analog:** none in codebase. Use RESEARCH.md Pattern + UI-SPEC.

**Structure pattern** (from UI-SPEC.md `AuthenticatedLayout` section):
- Outer: `flex h-screen` (sidebar + main)
- Sidebar: `w-60 flex-shrink-0 bg-gray-100 border-r border-gray-200 flex flex-col`
- Main: `flex-1 bg-gray-50 overflow-auto p-8`

**Nav item active detection** — use `useLocation()` + `NavLink` from react-router-dom:
```typescript
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/axios';
import { queryClient } from '../lib/queryClient';

// NavLink className pattern (active state from UI-SPEC):
<NavLink
  to="/dashboard"
  className={({ isActive }) =>
    isActive
      ? 'block px-4 py-2 text-sm text-blue-700 bg-blue-50 border-l-2 border-blue-600'
      : 'block px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 hover:text-gray-900'
  }
>
  Dashboard
</NavLink>
```

**Logout handler** (pessimistic — await server, then clear client state):
```typescript
const handleLogout = async () => {
  await api.post('/auth/logout');
  queryClient.clear();
  setUser(null);
  navigate('/login', { replace: true });
};
```

---

### `packages/frontend/src/pages/LoginPage.tsx` (new)

**Analog:** none in codebase. Use RESEARCH.md Pattern 11 (react-hook-form) + UI-SPEC.

**Form pattern** (from RESEARCH.md Pattern 11):
```typescript
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/axios';
import { useAuthStore } from '../stores/authStore';

type LoginForm = { username: string; password: string };

const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<LoginForm>();

const onSubmit = async (data: LoginForm) => {
  // Express 5 auto-forwards errors — axios throws on 4xx; handle here
  const res = await api.post('/auth/login', data);
  setUser(res.data.user);
  const returnTo = location.state?.returnTo;
  navigate(returnTo ?? (res.data.user.role === 'admin' ? '/dashboard' : '/sales'), { replace: true });
};
```

**Pessimistic UI** (CLAUDE.md Rule 10 + UI-SPEC):
- `disabled={isSubmitting}` on all inputs and submit button
- Button label: `{isSubmitting ? 'Signing in...' : 'Log In'}`

**Error display** (from UI-SPEC Copywriting Contract + UI-SPEC input error styling):
- Generic single error below form: `<p className="text-red-600 text-sm mt-1">Invalid username or password.</p>`
- Map 401 API response → set a single form-level error (not per-field)

**Input classes** (from UI-SPEC `Input field anatomy`):
```
h-10 w-full border border-gray-300 rounded-md px-3 py-2 text-sm
focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
```

---

### `packages/frontend/src/pages/InviteRegisterPage.tsx` (new)

**Analog:** `packages/frontend/src/pages/LoginPage.tsx` (same card layout + form pattern)

Differences from LoginPage:
- Fetches invite validity on mount: `GET /api/auth/invite/:token` — if expired/used, show error card (no form)
- Two password fields with cross-field validation: `watch('password')` !== `watch('confirmPassword')`
- On success: navigate to `/login` (no state needed — fresh login)
- Button label progression: "Create Account" → "Creating account..."

**Token from URL** (react-router-dom v6):
```typescript
import { useParams } from 'react-router-dom';
const { token } = useParams<{ token: string }>();
```

---

### `packages/frontend/src/pages/ProductsPage.tsx` (new)

**Analog:** none in codebase. Use RESEARCH.md Pattern 12 (@tanstack/react-table) + UI-SPEC.

**React Query data fetch pattern** (from RESEARCH.md Code Examples — useQuery):
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/axios';

const { data: products = [] } = useQuery({
  queryKey: ['products'],
  queryFn: () => api.get('/products').then(r => r.data),
});
```

**Mutation + cache invalidation pattern** (from RESEARCH.md Code Examples):
```typescript
const queryClient = useQueryClient();
const createProduct = useMutation({
  mutationFn: (data: { name: string; price: string }) =>
    api.post('/products', data).then(r => r.data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
});
```

**Table columns** (from RESEARCH.md Pattern 12 + UI-SPEC Products table):
```typescript
const columns: ColumnDef<Product>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'price', header: 'Price' },   // already a string "1000.00" from API
  { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge active={row.original.isActive} /> },
  { id: 'actions', header: 'Actions', cell: ({ row }) => <RowActions ... /> },
];
```

**State for modal open/close** — local `useState<Product | null>(null)` for edit target, `useState<boolean>` for create open. Keeping modal state local to the page (not Zustand) — Zustand is for auth state only.

---

### `packages/frontend/src/pages/MopsPage.tsx` (new)

**Analog:** `packages/frontend/src/pages/ProductsPage.tsx` (same pattern, no price column)

Identical to ProductsPage with:
- queryKey: `['mops']`
- API endpoint: `/mops`
- Table columns: Name | Status | Actions (no Price)
- Modal: MopModal instead of ProductModal

---

### `packages/frontend/src/pages/DashboardPage.tsx` + `SalesPage.tsx` (new — placeholders)

**Analog:** `packages/frontend/src/App.tsx` (lines 1–12 — placeholder pattern)

```typescript
// DashboardPage.tsx — from UI-SPEC Dashboard placeholder spec
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Dashboard</h1>
      <p className="text-sm text-gray-500">Dashboard coming in a future update.</p>
    </div>
  );
}

// SalesPage.tsx — Phase 3 fills this
export default function SalesPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Sales Sheet</h1>
      <p className="text-sm text-gray-500">Sales sheet coming in a future update.</p>
    </div>
  );
}
```

---

### `packages/frontend/src/components/Modal.tsx` (new — shared wrapper)

**Analog:** none in codebase.

**Pattern** (from UI-SPEC Modal section — overlay + card structure):
```typescript
// Shared modal wrapper — receives open, onClose, title, children, footer
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

// Overlay: fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50
// Card: bg-white rounded-lg shadow-xl w-[480px] max-h-[90vh] overflow-y-auto
// Escape key close: useEffect + document.addEventListener('keydown')
// Backdrop click close: onClick on overlay div, stopPropagation on card
// Close blocked while saving: parent passes onClose={isSubmitting ? undefined : handleClose}
```

---

### `packages/frontend/src/components/StatusBadge.tsx` (new)

**Analog:** none in codebase.

**Pattern** (from UI-SPEC Status badge section):
```typescript
export function StatusBadge({ active }: { active: boolean }) {
  return active
    ? <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-normal bg-green-100 text-green-800">Active</span>
    : <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-normal bg-gray-200 text-gray-600">Inactive</span>;
}
```

---

### `packages/frontend/src/components/catalog/ProductModal.tsx` (new)

**Analog:** none in codebase. Use RESEARCH.md Pattern 11 (react-hook-form) + Modal.tsx wrapper.

**Pattern** — react-hook-form inside Modal, receives product (null = create, non-null = edit):
```typescript
// Props: product: Product | null, onClose: () => void
// useForm default values: product ? { name: product.name, price: product.price } : {}
// onSubmit: calls createProduct.mutateAsync or updateProduct.mutateAsync
// isSubmitting = createProduct.isPending || updateProduct.isPending
// Pessimistic UI: all inputs + both buttons disabled during isPending
// Price input: type="text" (NOT number — avoids float issues, per CLAUDE.md Rule 6)
```

---

### `packages/frontend/src/components/catalog/MopModal.tsx` (new)

**Analog:** `packages/frontend/src/components/catalog/ProductModal.tsx` (same pattern, no price field)

---

## Shared Patterns

### Session Cookie Transmission

**Source:** `packages/backend/src/app.ts` lines 26–31 (CORS `credentials: true`)
**Apply to:** `packages/frontend/src/lib/axios.ts`

The backend CORS config sets `credentials: true`. The frontend axios instance MUST set `withCredentials: true` or the session cookie will not be sent on cross-origin requests. The Vite dev proxy (`/api` → `localhost:3001`) makes this same-origin in development, but `withCredentials: true` must still be set for production deployment.

```typescript
// app.ts (backend) — already set:
cors({ origin: process.env.CLIENT_ORIGIN, credentials: true })
// axios.ts (frontend) — must set:
axios.create({ withCredentials: true })
```

---

### `.js` Extension on All Backend Imports

**Source:** `packages/backend/src/app.ts` line 12, `packages/backend/src/index.ts` lines 4–5
**Apply to:** All new backend route and middleware files

```typescript
// Correct (node16 moduleResolution):
import { prisma } from '../lib/prisma.js';
import { sessionPool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
// Wrong (omitting .js causes runtime resolution failure):
import { prisma } from '../lib/prisma';
```

---

### Soft-Delete Filter Override for Admin Queries

**Source:** `packages/backend/src/lib/prisma.ts` lines 23–58
**Apply to:** `routes/products.ts`, `routes/mops.ts`, `routes/users.ts` (GET list endpoints)

The `$extends` in `prisma.ts` injects `{ isActive: true, ...args.where }`. Admin catalog list queries must explicitly pass `isActive: { in: [true, false] }` to override the default and see all records.

```typescript
// prisma.ts $extends spread order (line 29):
args.where = { isActive: true, ...args.where };
// Caller override — isActive key from caller wins when spread after default:
prisma.product.findMany({ where: { organizationId: 1, isActive: { in: [true, false] } } })
```

---

### organizationId on Every Create

**Source:** `packages/backend/prisma/schema.prisma` lines 51–52 (all models have `organizationId Int`)
**Apply to:** All `prisma.*.create()` calls in routes/auth.ts, routes/products.ts, routes/mops.ts, routes/users.ts

```typescript
// Every create must include organizationId: 1 (Phase 2 hardcode — single org)
await prisma.product.create({
  data: { name, price, organizationId: 1 }
});
```

---

### Decimal Price Serialization

**Source:** `packages/backend/prisma/schema.prisma` line 75 (`price Decimal @db.Decimal(10, 2)`) + RESEARCH.md Pattern 7
**Apply to:** Every API response in `routes/products.ts` that returns a product

```typescript
// Always .toFixed(2) — never .toNumber() or direct spread
res.json({ ...product, price: product.price.toFixed(2) });
```

---

### React Query Mutation + Invalidation

**Source:** RESEARCH.md Code Examples (React Query Mutation for Product Create)
**Apply to:** All mutation operations in ProductsPage, MopsPage

```typescript
useMutation({
  mutationFn: (data) => api.post('/products', data).then(r => r.data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  // onError: display inline error — React Query v5 removed per-query onError option
  // Handle errors in the component via mutation.error
});
```

---

### Pessimistic UI Disable Pattern

**Source:** CLAUDE.md Rule 10 + UI-SPEC Interaction Contracts
**Apply to:** LoginPage, InviteRegisterPage, ProductModal, MopModal, AuthenticatedLayout (logout)

```typescript
// Pattern: disable ALL interactive elements during round-trip, no optimistic updates
<button type="submit" disabled={isSubmitting}>
  {isSubmitting ? 'Saving...' : 'Save Changes'}
</button>
<input {...register('name')} disabled={isSubmitting} />
// Close is blocked: onClose={isSubmitting ? undefined : handleClose}
```

---

### Express 5 Async Error Forwarding

**Source:** `packages/backend/src/middleware/errorHandler.ts` lines 1–23 + `packages/backend/src/routes/health.ts` line 8
**Apply to:** All new route handlers in auth.ts, products.ts, mops.ts, users.ts

Express 5 automatically forwards async errors to `errorHandler` — no `try/catch` or `.catch(next)` needed. Validation errors are the only explicit early returns.

```typescript
// Correct (Express 5):
router.post('/endpoint', async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({...}); return; }
  const result = await prisma.product.create({...}); // throws auto-forwarded to errorHandler
  res.status(201).json(result);
});
// Wrong (Express 4 pattern — unnecessary in Express 5):
router.post('/endpoint', async (req, res, next) => {
  try { ... } catch (e) { next(e); }
});
```

---

## Configuration Files

### `packages/frontend/tailwind.config.js` (new)

**Source:** RESEARCH.md Pattern 8
**Location:** MUST be at `packages/frontend/tailwind.config.js` (same level as `vite.config.ts`) per Pitfall 3

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

**Note:** ESM `export default` (not `module.exports`) — Vite config is ESM, Tailwind config must match.

### `packages/frontend/postcss.config.js` (new)

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### `packages/frontend/src/index.css` (new)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## No Analog Found

Files with no close codebase match — planner uses RESEARCH.md patterns for these:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/frontend/src/layouts/AuthenticatedLayout.tsx` | component | request-response | No layout components exist yet |
| `packages/frontend/src/pages/LoginPage.tsx` | component | request-response | No page components exist yet |
| `packages/frontend/src/pages/InviteRegisterPage.tsx` | component | request-response | No page components exist yet |
| `packages/frontend/src/pages/ProductsPage.tsx` | component | CRUD | No page components exist yet |
| `packages/frontend/src/pages/MopsPage.tsx` | component | CRUD | No page components exist yet |
| `packages/frontend/src/components/Modal.tsx` | component | — | No component library exists yet |
| `packages/frontend/src/components/StatusBadge.tsx` | component | — | No component library exists yet |
| `packages/frontend/src/components/catalog/ProductModal.tsx` | component | CRUD | No component library exists yet |
| `packages/frontend/src/components/catalog/MopModal.tsx` | component | CRUD | No component library exists yet |

**Note:** All nine have detailed contracts in `02-UI-SPEC.md` (component contracts, Tailwind classes, copywriting) and `02-RESEARCH.md` (Patterns 9–13). The absence of codebase analogs is expected — this is a greenfield frontend.

---

## Metadata

**Analog search scope:** `packages/backend/src/`, `packages/frontend/src/`, `packages/shared/src/`
**Files scanned:** 13 source files (complete codebase as of Phase 1 completion)
**Pattern extraction date:** 2026-06-17
