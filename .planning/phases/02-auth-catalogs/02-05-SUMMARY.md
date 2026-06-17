---
phase: 02-auth-catalogs
plan: "05"
subsystem: ui
tags: [react, react-hook-form, react-router, tailwind, axios, zustand, typescript]

# Dependency graph
requires:
  - phase: 02-auth-catalogs
    provides: "02-04: Frontend infrastructure — axios singleton, authStore, router with ProtectedRoute, inline LoginPage/InviteRegisterPage placeholders"
  - phase: 02-auth-catalogs
    provides: "02-02: Backend auth routes — POST /api/auth/login (401 on bad creds), GET/POST /api/auth/invite/:token"
provides:
  - "LoginPage: card layout with react-hook-form, pessimistic UI disable, single 401 error, returnTo redirect, role-based default route"
  - "InviteRegisterPage: token validation on mount via GET, expired error card, password cross-field validation, min 8 chars, redirect to /login on success"
  - "router/index.tsx: real LoginPage and InviteRegisterPage imports replacing Plan 04 inline placeholders"
affects:
  - 02-06
  - 03-sales-sheet

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "react-hook-form setError('root', ...) for form-level 401 errors — avoids per-field error that could enumerate usernames"
    - "Pessimistic UI: both inputs and submit button disabled on isSubmitting — CLAUDE.md Rule 10"
    - "InviteRegisterPage: three-state loading pattern (null=loading, true=valid, false=invalid) for async token validation"
    - "returnTo: read location.state?.returnTo before API call, apply after setUser — ensures correct navigation after auth"

key-files:
  created:
    - "packages/frontend/src/pages/LoginPage.tsx — Login form with card layout, react-hook-form, pessimistic submit, 401 handling"
    - "packages/frontend/src/pages/InviteRegisterPage.tsx — Invite registration with token validation, error card, password confirm"
  modified:
    - "packages/frontend/src/router/index.tsx — replaced inline LoginPage/InviteRegisterPage consts with real imports"

key-decisions:
  - "Single form-level error for 401 (setError('root')) not per-field — avoids confirming username existence (T-02-P05-01)"
  - "axios 401 interceptor already guards /login path — no circular redirect on login failure (T-02-P05-02)"
  - "Token validation via stateless GET on mount — stateless means no consumption; only POST consumes token"

patterns-established:
  - "Pattern: Login 401 errors use setError('root') not per-field errors — canonical anti-enumeration approach"
  - "Pattern: InviteRegisterPage three-state: null/true/false — loading→form or error-card, never both"
  - "Pattern: All page files in packages/frontend/src/pages/ — import via ../pages/Name from router"

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
  - AUTH-05
  - AUTH-06

# Metrics
duration: ~15min
completed: "2026-06-17"
---

# Phase 02 Plan 05: Auth Pages Summary

**LoginPage with pessimistic-UI form, single 401 error, and returnTo redirect; InviteRegisterPage with async token validation, expired error card, and password cross-field validation — both wired into router replacing Plan 04 inline placeholders**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-17T18:10:00Z
- **Completed:** 2026-06-17T18:22:03Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- LoginPage: card layout with exact UI-SPEC.md Tailwind classes and copywriting, react-hook-form with pessimistic UI (all inputs + button disabled on isSubmitting), single form-level 401 error "Invalid username or password.", returnTo navigation honoring location.state, role-based default route (admin→/dashboard, moderator→/sales)
- InviteRegisterPage: three-state async token validation on mount (null=loading, true=valid, false=expired), expired/used token error card with exact UI-SPEC copy, password confirm cross-field validation, min 8 characters enforcement per UI-SPEC copywriting contract, redirect to /login on success
- router/index.tsx: replaced inline `const LoginPage = () => <div>Login</div>` and `const InviteRegisterPage = () => <div>Register</div>` with real imports from pages directory — no route structure changes needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement LoginPage and InviteRegisterPage** - `1bb9f73` (feat)
2. **Task 2: Wire real page imports into router** - `93556a1` (feat)

## Files Created/Modified

- `packages/frontend/src/pages/LoginPage.tsx` — Login form: react-hook-form, pessimistic UI (isSubmitting disables all inputs + button), single 401/network error via setError('root'), returnTo read from location.state, navigate to role-default after setUser
- `packages/frontend/src/pages/InviteRegisterPage.tsx` — Invite registration: useEffect GET /api/auth/invite/:token on mount, three-state tokenValid, expired card, username/password/confirmPassword fields with per-field validation, Passwords do not match cross-field, min 8 chars, redirect to /login on POST success
- `packages/frontend/src/router/index.tsx` — Added imports for LoginPage and InviteRegisterPage; removed inline placeholder const declarations

## Decisions Made

- **Single form-level error for 401** — setError('root') fires for all 401 responses from POST /api/auth/login; no per-field errors that could confirm username existence (T-02-P05-01 mitigation). This is the canonical anti-enumeration approach.
- **axios interceptor already guards /login** — The existing axios 401 interceptor in lib/axios.ts checks `if (currentPath !== '/login')` before redirecting; login form 401s are caught in onSubmit try/catch before the interceptor fires, preventing circular redirect (T-02-P05-02 accepted).
- **Stateless GET for token validation** — GET /api/auth/invite/:token validates without consuming; only POST consumes the token. This matches the backend contract from Plan 02 and prevents security scanner false-consumption.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all functionality specified in this plan is fully implemented. Remaining stubs from Plan 04 (ProductsPage, MopsPage inline placeholders) are tracked in 02-04-SUMMARY.md and resolved by Plan 06.

## Issues Encountered

None - TypeScript compiled cleanly on first pass. No dependency issues.

## User Setup Required

None - no external service configuration required. Login page is functional once backend is running.

## Next Phase Readiness

- **Plan 02-06 (Catalog UI):** Can now replace ProductsPage and MopsPage inline placeholders in router, same pattern used here. AuthenticatedLayout sidebar nav already links to /products and /mops.
- **Phase 3 (Sales Sheet):** SalesPage placeholder ready for real implementation; AuthenticatedLayout + ProtectedRoute already in place.
- No blockers.

## Self-Check

- `packages/frontend/src/pages/LoginPage.tsx` — exists, exports LoginPage
- `packages/frontend/src/pages/InviteRegisterPage.tsx` — exists, exports InviteRegisterPage
- `packages/frontend/src/router/index.tsx` — has real imports, no inline placeholders for login/register
- Commits `1bb9f73` and `93556a1` exist in git log
- TypeScript compiles with 0 errors

## Self-Check: PASSED

---
*Phase: 02-auth-catalogs*
*Completed: 2026-06-17*
