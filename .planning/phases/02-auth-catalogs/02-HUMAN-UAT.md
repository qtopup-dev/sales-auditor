---
status: partial
phase: 02-auth-catalogs
source: [02-VERIFICATION.md]
started: 2026-06-18T00:00:00Z
updated: 2026-06-18T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Login pessimistic UI and role-based redirect
expected: Clicking "Sign in" disables all inputs and shows "Signing in..." during round-trip; admin lands on /dashboard, moderator lands on /sales after successful login
result: [pending]

### 2. Invite flow end-to-end
expected: Admin generates invite link from POST /api/auth/invite; new user visits link, sees registration form (GET is stateless), submits to register, link cannot be reused (second POST returns INVITE_INVALID)
result: [pending]

### 3. Password reset session invalidation
expected: Admin calls POST /api/users/:id/reset-password; target user's existing session cookie returns 401 on any authenticated API call immediately after reset (confirms express-session-over-JWT decision)
result: [pending]

### 4. 401 interceptor returnTo navigation
expected: Unauthenticated visit to /products redirects to /login; after login, user lands back on /products (not /dashboard)
result: [pending]

### 5. Role-based sidebar
expected: Admin sees 4 nav items (Dashboard, Sales, Products, MOPs/Users); moderator sees only Sales item
result: [pending]

### 6. Per-row pessimistic toggle on catalog pages
expected: Toggling active/inactive on one product row disables only that row's toggle button, not others; button re-enables after response
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
