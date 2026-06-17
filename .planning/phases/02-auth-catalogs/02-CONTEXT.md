# Phase 2: Auth + Catalogs - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can securely log in, invite new moderators, manage sessions, and the admin can maintain the product and MOP catalogs that the sales sheet depends on.

Delivers: login/logout, invite flow, password reset, RBAC middleware, session guards, product catalog CRUD, MOP catalog CRUD, admin shell with sidebar navigation, moderator sales shell (placeholder — Phase 3 fills it out).

</domain>

<decisions>
## Implementation Decisions

### Password Reset UX
- **D-01:** Admin resets a user's password by clicking Reset Password — backend generates a cryptographically random temporary password, hashes+stores it immediately, returns the plaintext ONCE in the API response so the admin can copy it and share verbally or via direct message.
- **D-02:** No forced change on next login. The temp password becomes the user's actual password. Admin can reset again if needed. No `mustChangePassword` flag or extra redirect flow required.
- **D-03:** Password reset (AUTH-07/USERS-06) immediately invalidates all active sessions for that user by destroying all session records where `sess` contains that user's ID. This is the core correctness test for the express-session architecture.

### Admin Navigation Layout
- **D-04:** Sidebar navigation — persistent left sidebar for all authenticated users. One shared `AuthenticatedLayout` component with role-based nav items. Admin sees: Dashboard, Products, MOPs, Users. Moderator sees: Sales Sheet only (one item).
- **D-05:** In Phase 2, admin "Dashboard" sidebar item routes to `/dashboard` — this is a placeholder page (e.g., "Dashboard coming in a future update"). Phase 4 fills it out with charts, stats, and the sales view. The route/layout structure must exist in Phase 2 so Phase 4 doesn't require restructuring.
- **D-06:** Moderator does NOT get a different layout — same sidebar chrome, just filtered nav items. Simplifies the React component tree (no duplicate layouts).

### Catalog Management UI
- **D-07:** Products and MOPs use the same UI pattern: read-only table listing all items (active and inactive) + Add button that opens a modal form for creating. Clicking a row in the table opens the same modal pre-filled for editing.
- **D-08:** Product table columns: Name | Price | Status badge | Actions. MOP table columns: Name | Status badge | Actions. "Status badge" = colored chip (green "Active" / gray "Inactive"). "Actions" = Edit button + Toggle Active/Inactive button per row.
- **D-09:** Price in the Products table and modal is displayed as a string with 2 decimal places (e.g., "1000.00"). All price arithmetic on the backend uses Prisma.Decimal — never JS float. API returns price as string.

### Post-Login Routing + Auth Guards
- **D-10:** Role-based redirect on login: Admin → `/dashboard`, Moderator → `/sales`. Backend `/api/auth/login` returns the user's role so the frontend can redirect accordingly.
- **D-11:** `returnTo` pattern for intercepted routes. If an unauthenticated user hits a protected URL, store the attempted path in frontend state (or React Router location state), redirect to `/login`, and after successful login redirect back to the stored path. Falls back to role-based default if no returnTo is stored.
- **D-12:** Backend auth guard: a `requireAuth` middleware checks `req.session.userId` on every `/api` route (except `/api/auth/login` and the invite/register routes). Returns 401 JSON `{ error: 'UNAUTHORIZED' }` if not authenticated. A `requireRole('admin')` middleware stacks on top for admin-only routes. Returns 403 JSON `{ error: 'FORBIDDEN' }` if wrong role.

### Claude's Discretion
- Exact CSS styling for sidebar (colors, width, hover states) — use Tailwind utility classes, keep it clean and functional
- Form validation error message copy on login (generic "Invalid credentials" — security best practice for internal tools too)
- Modal component structure (whether to use a shared Modal wrapper or per-entity modal)
- Password minimum length for invite registration and temp password (8 characters is reasonable)
- Exact format of generated temp password (alphanumeric, e.g., 12 characters from crypto.randomBytes)
- API route naming within standard REST conventions (`/api/auth/login`, `/api/products`, `/api/mops`, `/api/users`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture — non-negotiable locked decisions
- `CLAUDE.md` §Critical Architecture Rules — Rules 1–10 must be respected. Especially: Rule 1 (express-session over JWT), Rule 3 (soft-delete only), Rule 6 (DECIMAL(10,2) for money), Rule 7 (UTC everywhere), Rule 8 (soft-delete filter enforcement), Rule 9 (backend enforces RBAC).
- `.planning/STATE.md` §Key Decisions Locked — 14 locked decisions including express-mysql-session pool separate from Prisma adapter, session cookie settings already wired in `app.ts`, Prisma 7 client generation path.

### Phase 2 requirements
- `.planning/ROADMAP.md` §Phase 2 — goal, 5 success criteria, full REQ-ID list (AUTH-01 through AUTH-07, ROLES-01 through ROLES-09, PROD-01 through PROD-07, PAY-01 through PAY-06).
- `.planning/REQUIREMENTS.md` — Full requirement text for all Phase 2 REQ-IDs.

### Existing infrastructure (Phase 2 builds on top of these)
- `packages/backend/src/app.ts` — Express app factory. Session store already configured (30-day rolling, httpOnly, sameSite lax). Phase 2 adds auth routes at `app.use('/api/auth', authRouter)` and protected routes at `app.use('/api', requireAuth, protectedRouter)`. Comments in file already mark where Phase 2 mounts.
- `packages/backend/src/index.ts` — Entry point. `TZ=UTC` guard present.
- `packages/backend/prisma/schema.prisma` — Full schema. InviteToken model has: `tokenHash`, `role`, `createdById`, `expiresAt`, `usedAt`. User model has: `passwordHash`, `role`, `canEdit`, `isActive`. All organization_id FKs present.
- `packages/backend/generated/prisma/` — Prisma 7 generated client. Entry point is `client.js` (not `index.js`).
- `packages/shared/src/types/user.ts` — Shared `User` and `Organization` TypeScript interfaces. `passwordHash` intentionally omitted from the API response type.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/backend/src/middleware/errorHandler.ts` — Global error handler reads `err.statusCode` and `err.code`. Phase 2 auth errors should throw `{ statusCode: 401, code: 'UNAUTHORIZED' }` and `{ statusCode: 403, code: 'FORBIDDEN' }` — the handler already handles these patterns.
- `packages/backend/src/lib/prisma.ts` — Prisma client singleton. All Phase 2 queries use this instance.
- `packages/shared/src/types/` — Shared types for User, Product, Mop, Sale, AuditEntry. Phase 2 should add `InviteToken` and `AuthSession` interfaces to this package.

### Established Patterns
- Express 5 router pattern already established via `healthRouter`. Phase 2 creates `authRouter` and `protectedRouter` following the same pattern.
- Session store already wired — `req.session.userId` is the field to set on login, destroy on logout.
- Prisma query pattern: use `prisma.user.findFirst` etc. with the generated client from `packages/backend/generated/prisma/client.js`.

### Integration Points
- `packages/backend/src/app.ts` line 82–83: Comments already mark where Phase 2 mounts auth and protected routers.
- Frontend: Phase 1 delivered a Vite + React placeholder. Phase 2 installs and wires: `react-router-dom` v6, `axios` v1 (with 401 interceptor), `@tanstack/react-query` v5, `Zustand`, `Tailwind CSS` (verify v3 vs v4 before pinning), `react-select` v5, `react-hook-form` v7.
- The `axios` 401 interceptor must redirect to `/login` on session expiry — this is the frontend complement to backend's `requireAuth` middleware.

</code_context>

<specifics>
## Specific Ideas

- Invite link format: `/invite/:token` where `:token` is the raw token (NOT the hash). Backend looks up by `crypto.createHash('sha256').update(token).digest('hex')` to find the InviteToken row. This prevents timing attacks and avoids storing the raw token.
- Same hashing strategy for temp password reset: backend generates `crypto.randomBytes(9).toString('base64url')` (12-char URL-safe), hashes it with bcrypt (cost 12), stores the hash, returns the plaintext once.
- Session destroy on password reset: `req.sessionStore.all()` to find sessions belonging to the target user by `sess.userId`, then `req.sessionStore.destroy(sid)` for each. OR: store `userId` in the session row and query the sessions table directly via the mysql2 pool.
- The `returnTo` path should be validated server-side or frontend-only (not open redirect). Simplest: keep it in React Router location state — never touches the server, no open redirect risk.
- USERS-05 says "generates a new invite-style reset link OR sets a new password directly" — we chose "display temp password" which is the "sets a new password directly" variant (admin-visible, no link required).

</specifics>

<deferred>
## Deferred Ideas

- Brute-force / rate-limit protection on `/api/auth/login` — explicitly listed in v2 requirements. Do not add in Phase 2.
- `mustChangePassword` flow — not needed (D-02). Would be a Phase 2 addition if the user changes their mind.
- Email delivery for invite or reset links — out of scope for v1. Invite link and temp password are shared manually.
- Multiple admin accounts with distinct permission levels — v2.
- "Remember me" / extended session toggle — not needed. AUTH-02 says sessions persist until explicit logout; rolling 30-day session already handles this.

</deferred>

---

*Phase: 02-auth-catalogs*
*Context gathered: 2026-06-17*
