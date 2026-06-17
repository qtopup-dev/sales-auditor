---
phase: 02-auth-catalogs
plan: "04"
subsystem: ui
tags: [react, tailwind, axios, react-query, zustand, react-router, typescript, vite]

# Dependency graph
requires:
  - phase: 02-auth-catalogs
    provides: "02-01: Express session auth middleware (requireAuth, requireRole) + shared AuthSession/InviteToken types"
  - phase: 02-auth-catalogs
    provides: "02-02: authRouter (login/logout) and usersRouter wired into protectedRouter — backend API ready"
provides:
  - "Tailwind CSS v3 configured at packages/frontend/ with correct ESM config and PostCSS pipeline"
  - "axios singleton with withCredentials: true and 401 interceptor that clears query cache and navigates to /login with returnTo state"
  - "QueryClient singleton with retry: 1 to prevent 401 retry flooding"
  - "Zustand v5 authStore with useAuthStore hook and getAuthUser() outside-React getter"
  - "React Router v6 createBrowserRouter with nested ProtectedRoute guards for authenticated + admin-only routes"
  - "AuthenticatedLayout with role-based sidebar nav (admin: 4 items; moderator: Sales Sheet only) and pessimistic logout"
  - "Placeholder pages: DashboardPage, SalesPage, UsersPage"
  - "main.tsx providing QueryClientProvider + RouterProvider; index.css with Tailwind directives"
affects:
  - 02-05
  - 02-06
  - 03-sales-sheet

# Tech tracking
tech-stack:
  added:
    - "react-router-dom@^6 — createBrowserRouter, RouterProvider, NavLink, Navigate, Outlet"
    - "axios@^1 — singleton with 401 interceptor"
    - "@tanstack/react-query@^5 — QueryClient with retry:1"
    - "zustand (v5) — authStore with outside-React getState() getter"
    - "react-hook-form@^7"
    - "react-select@^5"
    - "@tanstack/react-table@^8"
    - "@tanstack/react-virtual@^3"
    - "tailwindcss@^3 (devDep) — Tailwind CSS v3 with ESM config"
    - "postcss (devDep)"
    - "autoprefixer (devDep)"
    - "@types/node (devDep)"
  patterns:
    - "Singleton-outside-React: queryClient and router imported directly in axios interceptor (NOT hooks)"
    - "ProtectedRoute component wrapping <Outlet> for nested route auth guards"
    - "returnTo pattern: unauthenticated redirects store current path in React Router location.state only (never server-side)"
    - "Pessimistic logout: await server POST /auth/logout before clearing client auth state"
    - "Role-based sidebar: ADMIN_NAV vs MODERATOR_NAV arrays selected by user.role"
    - "Zustand v5 curried create<State>()() double-invocation syntax"

key-files:
  created:
    - "packages/frontend/tailwind.config.js — Tailwind v3 ESM config with content paths"
    - "packages/frontend/postcss.config.js — PostCSS pipeline for Tailwind + autoprefixer"
    - "packages/frontend/src/index.css — @tailwind base/components/utilities directives"
    - "packages/frontend/src/lib/queryClient.ts — QueryClient singleton, retry:1, staleTime:30s"
    - "packages/frontend/src/lib/axios.ts — axios singleton, withCredentials:true, 401 interceptor"
    - "packages/frontend/src/stores/authStore.ts — Zustand v5 auth store + getAuthUser()"
    - "packages/frontend/src/router/index.tsx — createBrowserRouter with ProtectedRoute"
    - "packages/frontend/src/layouts/AuthenticatedLayout.tsx — sidebar layout, role-based nav, logout"
    - "packages/frontend/src/pages/DashboardPage.tsx — placeholder (Phase 4)"
    - "packages/frontend/src/pages/SalesPage.tsx — placeholder (Phase 3)"
    - "packages/frontend/src/pages/UsersPage.tsx — placeholder (Phase 4)"
  modified:
    - "packages/frontend/src/main.tsx — full replace: QueryClientProvider + RouterProvider + index.css import"
    - "packages/frontend/src/App.tsx — replaced with no-op export (superseded by router)"
    - "packages/frontend/package.json — new runtime and devDependencies added"

key-decisions:
  - "Tailwind CSS v3 chosen (not v4) per CLAUDE.md Tech Choices — v4 not yet verified stable"
  - "axios singleton with module-level interceptor (not React hook) — interceptor must fire before React mounts"
  - "retry: 1 on QueryClient — default retry:3 would send 3× requests before 401 interceptor fires (RESEARCH.md Pitfall 6)"
  - "returnTo stored in React Router location.state only — never in URL params or server-side (no open redirect risk)"
  - "ProtectedRoute as component wrapping <Outlet>, not loader-based — supports returnTo state cleanly"
  - "Logout is pessimistic: await api.post('/auth/logout') before queryClient.clear() + setUser(null) — CLAUDE.md Rule 10"
  - "getAuthUser() = useAuthStore.getState().user — synchronous outside-React access for ProtectedRoute and interceptor"

patterns-established:
  - "Pattern: Tailwind config at packages/frontend/ (same level as vite.config.ts) — content paths relative to that dir"
  - "Pattern: All axios API calls use the api singleton, never raw axios — ensures withCredentials and interceptors apply"
  - "Pattern: Auth state = Zustand store only; page refresh clears state, forcing re-validation with server"
  - "Pattern: Inline placeholder components (LoginPage, InviteRegisterPage, ProductsPage, MopsPage) in router — replaced plan-by-plan without router restructure"
  - "Pattern: NavLink className function for active state — Tailwind class swap on isActive boolean"

requirements-completed:
  - ROLES-07
  - ROLES-08
  - AUTH-01
  - AUTH-03

# Metrics
duration: ~45min
completed: "2026-06-18"
---

# Phase 02 Plan 04: Frontend Infrastructure Summary

**React 18 + React Router v6 + Tailwind v3 bootstrap: axios/queryClient/authStore singletons, ProtectedRoute auth guards with returnTo pattern, role-based AuthenticatedLayout sidebar, and QueryClient with 401 interceptor wired before React mounts**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-18T00:00:00Z
- **Completed:** 2026-06-18
- **Tasks:** 2
- **Files modified:** 14 (7 created/modified in Task 1; 7 created/modified in Task 2)

## Accomplishments

- Tailwind CSS v3 fully configured (ESM config, postcss pipeline, index.css directives) — utility classes available across all frontend files
- Core infrastructure singletons created: axios singleton with `withCredentials: true` and 401 interceptor that clears query cache and navigates with returnTo state; QueryClient with `retry: 1`; Zustand v5 authStore with `getAuthUser()` outside-React getter
- React Router v6 with nested ProtectedRoute guards: unauthenticated users redirect to /login with returnTo in location.state; admin-only subrouter guards /dashboard, /products, /mops, /users; role-mismatch redirects to role default page
- AuthenticatedLayout with role-based sidebar (ADMIN_NAV 4 items / MODERATOR_NAV 1 item), pessimistic logout (await server before clearing client state), NavLink active-state classes per UI-SPEC.md
- main.tsx fully replaced with QueryClientProvider + RouterProvider; App.tsx superseded by router

## Task Commits

Each task was committed atomically:

1. **Task 1: Install frontend dependencies, configure Tailwind CSS v3, create singletons and authStore** - `711a281` (feat)
2. **Task 2: Create router with ProtectedRoute guards, AuthenticatedLayout, placeholder pages, and update main.tsx** - `30280b9` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `packages/frontend/package.json` — react-router-dom, axios, @tanstack/react-query, zustand, react-hook-form, react-select, @tanstack/react-table, @tanstack/react-virtual added; tailwindcss/postcss/autoprefixer devDeps added
- `packages/frontend/tailwind.config.js` — Tailwind v3 ESM export default with content paths ./index.html + ./src/**/*.{js,ts,jsx,tsx}
- `packages/frontend/postcss.config.js` — tailwindcss + autoprefixer plugins
- `packages/frontend/src/index.css` — @tailwind base/components/utilities directives
- `packages/frontend/src/lib/queryClient.ts` — QueryClient singleton, retry:1, staleTime:30s
- `packages/frontend/src/lib/axios.ts` — axios singleton with withCredentials:true and 401 interceptor (queryClient.clear + router.navigate with returnTo + /login guard)
- `packages/frontend/src/stores/authStore.ts` — Zustand v5 curried create<AuthState>()(); useAuthStore hook + getAuthUser() module-level getter
- `packages/frontend/src/router/index.tsx` — createBrowserRouter; ProtectedRoute component; admin-only subrouter; returnTo Navigate; inline LoginPage/InviteRegisterPage/ProductsPage/MopsPage placeholders
- `packages/frontend/src/layouts/AuthenticatedLayout.tsx` — sidebar layout; ADMIN_NAV/MODERATOR_NAV; NavLink with className function; pessimistic handleLogout
- `packages/frontend/src/pages/DashboardPage.tsx` — placeholder (Phase 4 fills with charts/stats)
- `packages/frontend/src/pages/SalesPage.tsx` — placeholder (Phase 3 fills with virtual-scroll sheet)
- `packages/frontend/src/pages/UsersPage.tsx` — placeholder (Phase 4 fills with user management table)
- `packages/frontend/src/main.tsx` — full replace: import ./index.css first; QueryClientProvider + RouterProvider; null-guard on rootElement
- `packages/frontend/src/App.tsx` — replaced with no-op `export {}` (superseded by router/index.tsx)

## Decisions Made

- **Tailwind v3 not v4** — CLAUDE.md Tech Choices explicitly calls out "VERIFY v4 stable before starting"; v3 used as directed
- **axios singleton module-level interceptor** — The interceptor must reference queryClient and router at creation time (before React mounts). Cannot use useQueryClient hook here; must import the queryClient singleton directly. This is the canonical pattern for React Query + axios (RESEARCH.md Anti-Patterns)
- **retry: 1 on QueryClient** — default retry:3 causes 3 redundant API calls before the 401 interceptor fires and redirects. retry:1 balances resilience vs. flooding (RESEARCH.md Pitfall 6, T-02-P04-05)
- **returnTo in location.state only** — URL-param-based returnTo is an open redirect vector. React Router location.state is in-memory and client-side only; backend never sees it (T-02-P04-02)
- **Inline placeholder components in router** — LoginPage, InviteRegisterPage, ProductsPage, MopsPage defined inline in router/index.tsx as one-liner components. Plans 05 and 06 replace them with real imports without restructuring the router
- **Pessimistic logout** — await `api.post('/auth/logout')` completes before `queryClient.clear()` + `setUser(null)` + navigate. CLAUDE.md Rule 10 (no optimistic UI updates in v1)
- **Zustand v5 curried syntax** — `create<AuthState>()()` double-invocation is required in Zustand v5; single invocation `create<AuthState>()` is Zustand v4 (RESEARCH.md State of the Art)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

The following placeholder page components are intentional stubs — they are tracked here so verifiers do not flag them as defects:

| File | Stub | Resolved In |
|------|------|------------|
| `packages/frontend/src/pages/DashboardPage.tsx` | "Dashboard coming in a future update." | Phase 4 |
| `packages/frontend/src/pages/SalesPage.tsx` | "Sales sheet coming in a future update." | Phase 3 |
| `packages/frontend/src/pages/UsersPage.tsx` | "User management coming in a future update." | Phase 4 |
| `packages/frontend/src/router/index.tsx` | `LoginPage`, `InviteRegisterPage` inline one-liners | Plan 02-05 |
| `packages/frontend/src/router/index.tsx` | `ProductsPage`, `MopsPage` inline one-liners | Plan 02-06 |
| `packages/frontend/src/App.tsx` | no-op `export {}` | Not needed — App.tsx superseded by router |

These stubs are intentional: the plan's goal is the infrastructure bootstrap, not the page implementations. Every subsequent plan (02-05, 02-06, 03-xx) depends on this infrastructure existing.

## Issues Encountered

None - all files compiled cleanly with TypeScript.

## User Setup Required

None - no external service configuration required. Dev server startup requires the backend to be running (`npm run dev` from monorepo root) for the /api proxy to resolve.

## Next Phase Readiness

- **Plan 02-05 (Login + Invite Register pages):** Depends directly on router/index.tsx (replace LoginPage/InviteRegisterPage inline stubs with real imports), authStore (setUser on login success), and axios singleton (POST /api/auth/login). All three are present.
- **Plan 02-06 (Catalog UI pages):** Depends on router/index.tsx (replace ProductsPage/MopsPage stubs), AuthenticatedLayout (already renders sidebar with Products/MOPs nav links), and axios singleton for catalog API calls. All ready.
- **Phase 3 (Sales Sheet):** Depends on AuthenticatedLayout + SalesPage placeholder route + axios singleton. All present.
- No blockers.

---
*Phase: 02-auth-catalogs*
*Completed: 2026-06-18*
