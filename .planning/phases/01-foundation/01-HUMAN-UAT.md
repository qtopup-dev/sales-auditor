---
status: partial
phase: 01-foundation
source: [01-VERIFICATION.md]
started: 2026-06-17T08:00:00Z
updated: 2026-06-17T08:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Full dev stack startup (SC-1 + SC-4)
expected: From repo root (Docker Desktop running, MySQL container healthy), run `npm run dev`. Both servers start without errors. Console shows `[prisma] connected`, `[server] listening on http://localhost:3001`, `TZ=UTC`, and `VITE v8.x ready` on port 5173. `curl -i http://localhost:3001/health` returns HTTP 200 with `X-Content-Type-Options: nosniff` and `X-Frame-Options: SAMEORIGIN`. Browser at `http://localhost:5173` shows "App coming soon".
result: [pending]

### 2. Seeded database state (SC-3)
expected: `SELECT id, username, role FROM users WHERE username='admin'` returns 1 row (id=1, admin). `SELECT COUNT(*) FROM organizations` returns 1. `SELECT @@global.time_zone` returns `+00:00`. `cd packages/backend && npx prisma migrate status` shows "Database schema is up to date".
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
