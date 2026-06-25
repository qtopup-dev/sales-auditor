---
status: complete
phase: 02-auth-catalogs
source: [02-VERIFICATION.md]
started: 2026-06-18T00:00:00Z
updated: 2026-06-25T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Login pessimistic UI and role-based redirect
expected: Clicking "Sign in" disables all inputs and shows "Signing in..." during round-trip; admin lands on /dashboard, moderator lands on /sales after successful login
result: pass

### 2. Invite flow end-to-end
expected: Admin generates invite link from POST /api/auth/invite; new user visits link, sees registration form (GET is stateless), submits to register, link cannot be reused (second POST returns INVITE_INVALID)
result: pass

### 3. Password reset session invalidation
expected: Admin calls POST /api/users/:id/reset-password; target user's existing session cookie returns 401 on any authenticated API call immediately after reset (confirms express-session-over-JWT decision)
result: pass

### 4. 401 interceptor returnTo navigation
expected: Unauthenticated visit to /products redirects to /login; after login, user lands back on /products (not /dashboard)
result: pass

### 5. Role-based sidebar
expected: Admin sees 4 nav items (Dashboard, Sales, Products, MOPs/Users); moderator sees only Sales item
result: pass

### 6. Per-row pessimistic toggle on catalog pages
expected: Toggling active/inactive on one product row disables only that row's toggle button, not others; button re-enables after response
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
