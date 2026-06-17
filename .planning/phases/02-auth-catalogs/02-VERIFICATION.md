---
phase: 02-auth-catalogs
verified: 2026-06-18T12:00:00Z
status: human_needed
score: 23/23 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Login form UI — pessimistic disable and role-based redirect"
    expected: "Submit button shows 'Signing in...' and inputs are disabled during round-trip; admin lands on /dashboard, moderator lands on /sales"
    why_human: "isSubmitting state and navigation timing cannot be verified without a running browser"
  - test: "Invite link generation and registration flow"
    expected: "Admin generates invite URL; visiting URL shows registration form; submitting creates moderator account and redirects to /login; re-visiting same URL shows expired card"
    why_human: "End-to-end flow across backend and browser requires running app with live DB"
  - test: "Password reset invalidates active sessions"
    expected: "After admin POSTs reset-password, the target user's existing browser session gets a 401 on next request"
    why_human: "Requires two concurrent sessions and live MySQL to verify DELETE FROM sessions takes effect"
  - test: "401 interceptor redirects with returnTo"
    expected: "Unauthenticated visit to /products redirects to /login; after login the user lands on /products"
    why_human: "React Router navigation and location.state behavior requires a running browser"
  - test: "Role-based sidebar nav items"
    expected: "Admin sidebar shows Dashboard/Products/MOPs/Users; moderator sidebar shows only Sales Sheet"
    why_human: "DOM rendering requires browser"
  - test: "Catalog toggle (Deactivate/Activate) pessimistic per-row disable"
    expected: "Only the toggled row's button shows disabled state during the PATCH round-trip; other rows remain interactive"
    why_human: "Per-row pending state during async mutation requires browser interaction"
---

# Phase 2: Auth & Catalogs Verification Report

**Phase Goal:** Users can securely log in, invite new moderators, manage sessions, and the admin can maintain the product and MOP catalogs that the sales sheet depends on.
**Verified:** 2026-06-18T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every /api/* request (except /api/auth/* and /invite/*) is rejected with 401 if req.session.userId is absent | VERIFIED | `requireAuth` in `middleware/requireAuth.ts`; mounted at `app.use('/api', requireAuth, protectedRouter)` in `app.ts` line 87 |
| 2 | Every admin-only /api/* request is rejected with 403 if req.session.role is not 'admin' | VERIFIED | `requireRole('admin')` mounted at router level in `usersRouter`, `productsRouter`, `mopsRouter` (lines 13, 9, 9 respectively) |
| 3 | sessionPool is importable from lib/db.ts by auth routes | VERIFIED | `import { sessionPool } from '../lib/db.js'` in `users.ts` line 6; used for DELETE FROM sessions |
| 4 | InviteToken and AuthSession types exported from @alejinput/shared | VERIFIED | `packages/shared/src/types/auth.ts` exists; re-exported from `index.ts` |
| 5 | POST /api/auth/login returns 200 with user object and sets session cookie | VERIFIED | `auth.ts` lines 35-81: bcrypt compare, session.regenerate(), session.save(), res.json({user}) |
| 6 | POST /api/auth/login with invalid credentials returns 401 INVALID_CREDENTIALS without enumeration | VERIFIED | `auth.ts` lines 50-56: dummy hash timing attack prevention; generic error returned |
| 7 | POST /api/auth/logout destroys session and clears connect.sid cookie | VERIFIED | `auth.ts` lines 86-95: session.destroy() + res.clearCookie('connect.sid') |
| 8 | POST /api/auth/invite (admin only) returns inviteUrl with raw token; sha256 hash stored | VERIFIED | `auth.ts` lines 102-119: requireAuth+requireRole guard; crypto.randomBytes(32); sha256 hash stored; 48h expiry |
| 9 | GET /api/auth/invite/:token validates without consuming | VERIFIED | `auth.ts` lines 126-136: findUnique + validity check; no usedAt mutation |
| 10 | POST /api/auth/invite/:token creates User and marks InviteToken.usedAt atomically | VERIFIED | `auth.ts` lines 142-181: prisma.$transaction; usedAt set before user.create |
| 11 | POST /api/users/:id/reset-password generates temp password, stores bcrypt hash, deletes sessions | VERIFIED | `users.ts` lines 82-123: bcrypt.hash(12), prisma.user.update, DELETE FROM sessions WHERE JSON_EXTRACT |
| 12 | PATCH /api/users/:id can toggle canEdit on a moderator | VERIFIED | `users.ts` lines 46-73: requireRole at router level; updates canEdit |
| 13 | POST /api/products creates product with name and DECIMAL price; returns price as string '1000.00' | VERIFIED | `products.ts` lines 63-78: price string accepted; serializeProduct uses .toFixed(2) |
| 14 | GET /api/products returns ALL products (active and inactive) | VERIFIED | `products.ts` lines 39-48: isActive: { in: [true, false] } overrides $extends default |
| 15 | PATCH /api/products/:id updates name/price; PATCH /api/products/:id/toggle toggles isActive | VERIFIED | `products.ts` lines 94-154: both endpoints implemented with soft-delete only |
| 16 | All MOP endpoints mirror products pattern (no price field) | VERIFIED | `mops.ts`: GET/POST/PATCH/PATCH-toggle all present; no price field |
| 17 | Price returned as string with exactly 2 decimal places | VERIFIED | serializeProduct in `products.ts` line 27: `p.price.toFixed(2)` |
| 18 | Schema contains priceSnapshot, productNameSnapshot, mopNameSnapshot on Sale model | VERIFIED | `schema.prisma` lines 108-112: all three fields confirmed present |
| 19 | Unauthenticated visit to protected route redirects to /login with returnTo | VERIFIED | `router/index.tsx` lines 20-23: ProtectedRoute Navigate with state={{ returnTo: location.pathname }} |
| 20 | Admin login redirects to /dashboard; moderator to /sales | VERIFIED | `LoginPage.tsx` line 37: role === 'admin' ? '/dashboard' : '/sales' |
| 21 | 401 from any /api endpoint clears React Query cache and redirects to /login with returnTo | VERIFIED | `axios.ts` lines 19-23: queryClient.clear() + router.navigate('/login', { state: { returnTo } }) |
| 22 | AuthenticatedLayout renders role-based sidebar nav | VERIFIED | `AuthenticatedLayout.tsx`: ADMIN_NAV (4 items) and MODERATOR_NAV (1 item) arrays, selected by user.role |
| 23 | Logout clears auth store, query cache, and redirects to /login | VERIFIED | `AuthenticatedLayout.tsx` handleLogout: api.post + queryClient.clear() + setUser(null) + navigate |

**Score:** 23/23 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/src/lib/db.ts` | sessionPool singleton | VERIFIED | export const sessionPool confirmed |
| `packages/backend/src/middleware/requireAuth.ts` | requireAuth + SessionData augmentation | VERIFIED | declare module 'express-session' present; export function requireAuth |
| `packages/backend/src/middleware/requireRole.ts` | requireRole factory | VERIFIED | export function requireRole confirmed |
| `packages/shared/src/types/auth.ts` | InviteToken and AuthSession | VERIFIED | Both interfaces present |
| `packages/backend/src/routes/auth.ts` | authRouter with 5 endpoints | VERIFIED | login, logout, invite POST, invite GET, invite register POST |
| `packages/backend/src/routes/users.ts` | usersRouter with 3 endpoints | VERIFIED | GET list, PATCH canEdit, POST reset-password |
| `packages/backend/src/routes/products.ts` | productsRouter with 4 endpoints | VERIFIED | GET, POST, PATCH update, PATCH toggle |
| `packages/backend/src/routes/mops.ts` | mopsRouter with 4 endpoints | VERIFIED | GET, POST, PATCH update, PATCH toggle |
| `packages/backend/src/app.ts` | All routes wired | VERIFIED | authRouter at /api/auth; protectedRouter at /api with requireAuth |
| `packages/backend/prisma/schema.prisma` | Sale model snapshot fields | VERIFIED | priceSnapshot, productNameSnapshot, mopNameSnapshot confirmed |
| `packages/frontend/src/lib/axios.ts` | axios with 401 interceptor | VERIFIED | withCredentials:true; queryClient.clear(); router.navigate |
| `packages/frontend/src/lib/queryClient.ts` | QueryClient with retry:1 | VERIFIED | new QueryClient with retry:1 |
| `packages/frontend/src/stores/authStore.ts` | Zustand v5 store + getAuthUser | VERIFIED | create<AuthState>()() double invocation; export const getAuthUser |
| `packages/frontend/src/router/index.tsx` | createBrowserRouter with ProtectedRoute | VERIFIED | No inline placeholders remain; real imports for all pages |
| `packages/frontend/src/layouts/AuthenticatedLayout.tsx` | Sidebar with role nav | VERIFIED | ADMIN_NAV/MODERATOR_NAV; pessimistic logout |
| `packages/frontend/src/pages/LoginPage.tsx` | Login form | VERIFIED | react-hook-form; pessimistic; setError('root') for 401; returnTo |
| `packages/frontend/src/pages/InviteRegisterPage.tsx` | Invite registration | VERIFIED | Three-state token validation; password cross-field validation |
| `packages/frontend/src/pages/ProductsPage.tsx` | Products catalog page | VERIFIED | react-table v8; useQuery; toggle mutation; empty state |
| `packages/frontend/src/pages/MopsPage.tsx` | MOPs catalog page | VERIFIED | Same pattern; no price column |
| `packages/frontend/src/components/Modal.tsx` | Shared modal wrapper | VERIFIED | Escape key handler; backdrop stopPropagation; onClose=undefined blocks close |
| `packages/frontend/src/components/StatusBadge.tsx` | StatusBadge chip | VERIFIED | green Active / gray Inactive |
| `packages/frontend/src/components/catalog/ProductModal.tsx` | ProductModal | VERIFIED | price type=text; isPending disables; queryKey=['products'] invalidation |
| `packages/frontend/src/components/catalog/MopModal.tsx` | MopModal | VERIFIED | Same pattern; no price field |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| app.ts | requireAuth middleware | import + mount at /api | WIRED | Line 12: `import { requireAuth }`; line 87: `app.use('/api', requireAuth, protectedRouter)` |
| app.ts | auth.ts routes | import + mount at /api/auth | WIRED | Line 14: `import { authRouter }`; line 80: `app.use('/api/auth', authRouter)` |
| app.ts | users/products/mops routes | protectedRouter mounts | WIRED | Lines 84-86: protectedRouter.use for all three |
| users.ts | lib/db.ts | sessionPool for session DELETE | WIRED | Line 6: import sessionPool; line 116: sessionPool.query DELETE |
| auth.ts | lib/prisma.ts | prisma.inviteToken and prisma.user | WIRED | Line 5: import prisma; used throughout |
| LoginPage.tsx | authStore.ts | setUser after login | WIRED | Line 14: import useAuthStore; line 34: setUser(res.data.user) |
| LoginPage.tsx | axios.ts | api.post('/auth/login') | WIRED | Line 3: import api; line 33: api.post('/auth/login') |
| axios.ts | queryClient.ts | queryClient.clear() on 401 | WIRED | Line 19: queryClient.clear() confirmed |
| axios.ts | router/index.tsx | router.navigate on 401 | WIRED | Line 21: router.navigate('/login') confirmed |
| router/index.tsx | authStore.ts | getAuthUser() in ProtectedRoute | WIRED | Line 2: import getAuthUser; line 17: const user = getAuthUser() |
| ProductsPage.tsx | axios.ts | api.get('/products') in useQuery | WIRED | useQuery with queryFn: api.get('/products') |
| ProductModal.tsx | queryClient | invalidateQueries(['products']) | WIRED | onSuccess: queryClient.invalidateQueries({ queryKey: ['products'] }) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| ProductsPage.tsx | products | useQuery → api.get('/products') → productsRouter → prisma.product.findMany | Yes — Prisma DB query with isActive override | FLOWING |
| MopsPage.tsx | mops | useQuery → api.get('/mops') → mopsRouter → prisma.mop.findMany | Yes — Prisma DB query with isActive override | FLOWING |
| LoginPage.tsx | res.data.user | api.post('/auth/login') → authRouter → prisma.user.findFirst + bcrypt | Yes — real user lookup from DB | FLOWING |
| InviteRegisterPage.tsx | tokenValid | api.get('/auth/invite/:token') → authRouter → prisma.inviteToken.findUnique | Yes — real token lookup | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — app requires running MySQL database and live server. No runnable entry points can be tested without infrastructure.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 02-02, 02-04, 02-05 | Login with username and password | SATISFIED | authRouter POST /login; LoginPage.tsx |
| AUTH-02 | 02-02 | Session persists until explicit logout | SATISFIED | rolling:true in app.ts session config; no automatic expiry |
| AUTH-03 | 02-02, 02-04, 02-05 | User can log out from any page | SATISFIED | POST /logout + handleLogout in AuthenticatedLayout |
| AUTH-04 | 02-02 | Admin generates invite link | SATISFIED | POST /api/auth/invite with requireAuth+requireRole('admin') |
| AUTH-05 | 02-02, 02-05 | Invited user registers via invite link | SATISFIED | GET + POST /api/auth/invite/:token; InviteRegisterPage |
| AUTH-06 | 02-02, 02-05 | Invite is single-use and expires 48h | SATISFIED | usedAt check + expiresAt check in both GET and POST; $transaction marks usedAt |
| AUTH-07 | 02-02 | Admin resets password; invalidates sessions immediately | SATISFIED | POST /api/users/:id/reset-password; DELETE FROM sessions SQL |
| ROLES-01 | 02-02 | Two roles: Admin and Moderator | SATISFIED | Role enum in schema; role returned in user object from login |
| ROLES-02 | 02-02 | Admin toggles canEdit per moderator | SATISFIED | PATCH /api/users/:id updates canEdit |
| ROLES-07 | 02-04, 02-06 | Moderator sees only sales sheet | SATISFIED | MODERATOR_NAV array in AuthenticatedLayout; ProtectedRoute requiredRole='admin' blocks /products, /mops, /dashboard |
| ROLES-08 | 02-04, 02-06 | Admin sees dashboard, all catalogs, user management | SATISFIED | ADMIN_NAV in AuthenticatedLayout; /dashboard, /products, /mops, /users all in admin ProtectedRoute |
| ROLES-09 | 02-01, 02-02, 02-03 | Backend enforces all role checks | SATISFIED | requireAuth at /api level; requireRole('admin') at router level in all admin routers |
| PROD-01 | 02-03, 02-06 | Admin creates product with name and price | SATISFIED | POST /api/products; ProductModal create mode |
| PROD-02 | 02-03, 02-06 | Admin edits product name and price | SATISFIED | PATCH /api/products/:id; ProductModal edit mode |
| PROD-03 | 02-03, 02-06 | Admin toggles product status | SATISFIED | PATCH /api/products/:id/toggle; Deactivate/Activate in ProductsPage |
| PROD-04 | 02-03, 02-06 | Admin views all products (active + inactive) | SATISFIED | GET /api/products with isActive override; ProductsPage table |
| PROD-06 | 02-03 | Existing sales rows retain product name snapshot | SATISFIED (schema contract) | productNameSnapshot on Sale model in schema.prisma; Phase 3 writes this at row creation |
| PROD-07 | 02-03 | Price at creation stored as priceSnapshot | SATISFIED (schema contract) | priceSnapshot DECIMAL(10,2) on Sale model; Phase 3 writes this |
| PAY-01 | 02-03, 02-06 | Admin creates MOP with name | SATISFIED | POST /api/mops; MopModal create mode |
| PAY-02 | 02-03, 02-06 | Admin edits MOP name | SATISFIED | PATCH /api/mops/:id; MopModal edit mode |
| PAY-03 | 02-03, 02-06 | Admin toggles MOP status | SATISFIED | PATCH /api/mops/:id/toggle; Deactivate/Activate in MopsPage |
| PAY-04 | 02-03, 02-06 | Admin views all MOPs (active + inactive) | SATISFIED | GET /api/mops with isActive override; MopsPage table |
| PAY-06 | 02-03 | Existing sales rows retain MOP reference | SATISFIED (schema contract) | mopNameSnapshot on Sale model in schema.prisma; Phase 3 writes this |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| auth.ts | 102 | `requireAuth` applied per-route on POST /invite inside authRouter, not at router level | INFO | Functional but deviates from plan design; the plan specified requireRole only (router-level requireAuth at /api covers protected routes, but /api/auth is the unauthenticated router). The per-route requireAuth is actually correct security here — invite generation must be authenticated. No behavioral problem. |
| pages/DashboardPage.tsx | — | "Dashboard coming in a future update." placeholder | INFO | Intentional Phase 4 stub — documented in 02-04-SUMMARY.md |
| pages/SalesPage.tsx | — | "Sales sheet coming in a future update." placeholder | INFO | Intentional Phase 3 stub — documented in 02-04-SUMMARY.md |
| pages/UsersPage.tsx | — | "User management coming in a future update." placeholder | INFO | Intentional Phase 4 stub — documented in 02-04-SUMMARY.md |

No blockers. The three placeholder pages are explicitly tracked as intentional stubs in the plan summaries, resolved in later phases. The requireAuth per-route addition on invite generation is a security improvement, not a defect.

### Human Verification Required

#### 1. Login Form Pessimistic UI and Role Redirect

**Test:** With backend running, visit /login, enter valid admin credentials, click Log In
**Expected:** Button shows "Signing in..." and inputs are disabled during the round-trip; after success, browser navigates to /dashboard. Repeat with moderator credentials — should land on /sales.
**Why human:** isSubmitting state and navigation timing cannot be verified programmatically without a browser

#### 2. Invite Link Full Flow

**Test:** As admin, POST /api/auth/invite to generate an invite URL. Visit the URL in a browser. Fill in username and password, submit. Verify redirect to /login. Visit the same invite URL again.
**Expected:** Registration form shown on first visit; redirect to /login on submit; "Invite Link Invalid" card shown on second visit (single-use enforced).
**Why human:** End-to-end flow across backend and browser requires a live DB with a seed admin user

#### 3. Password Reset Session Invalidation

**Test:** Log in as a user in Browser A. In Browser B as admin, POST /api/users/:id/reset-password for that user. In Browser A, make any authenticated API request.
**Expected:** Browser A receives 401; the axios interceptor redirects to /login.
**Why human:** Requires two concurrent browser sessions and live MySQL to verify the DELETE FROM sessions SQL takes effect and the 401 interceptor fires

#### 4. 401 Interceptor ReturnTo Flow

**Test:** Without logging in, navigate directly to /products in the browser.
**Expected:** Redirected to /login. Log in as admin. Land on /products (returnTo honored).
**Why human:** React Router location.state and navigation behavior requires browser rendering

#### 5. Role-Based Sidebar Nav

**Test:** Log in as admin — verify sidebar shows: Dashboard, Products, MOPs, Users. Log out and log in as moderator — verify sidebar shows only: Sales Sheet.
**Expected:** Exactly 4 nav items for admin; exactly 1 for moderator.
**Why human:** DOM rendering requires browser

#### 6. Per-Row Pessimistic Toggle in Catalog

**Test:** On /products page with multiple products, click Deactivate on one row while watching the other rows.
**Expected:** Only the clicked row's buttons disable during the PATCH round-trip; other rows remain fully interactive.
**Why human:** pendingToggleId state behavior during async mutation requires browser interaction

### Gaps Summary

No gaps found. All 23 must-have truths verified, all required artifacts exist and are substantive, all key links are wired, data flows through real DB queries. The three placeholder pages (Dashboard, Sales, Users) are intentional Phase 3/4 stubs explicitly documented in the plan summaries.

The phase goal is architecturally achieved: authentication infrastructure is complete, catalog CRUD is complete, and the frontend UI wires to all backend endpoints. Human verification is needed to confirm end-to-end behavior in a running browser with a live database.

---

_Verified: 2026-06-18T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
