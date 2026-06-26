---
phase: 05-receiver-catalog
plan: 02
subsystem: backend-api
tags: [typescript, express, prisma, receivers, shared-types, crud, soft-delete]

# Dependency graph
requires:
  - phase: 05-01
    provides: Receiver Prisma model with organizationId, accountNumber, isActive, timestamps
provides:
  - Receiver TypeScript interface in @alejinput/shared
  - Updated Sale interface with receiverId + receiverNameSnapshot (receiver: string removed)
  - receiversRouter: GET/POST/PATCH/toggle at /api/receivers (admin-only)
  - GET /api/catalog/receivers (all authenticated users, active receivers only)
  - prisma.ts $extends receiver soft-delete filter
affects:
  - 05-03 (sales backend routes need updated Sale type with receiverId)
  - 05-04 (frontend receiver combobox consumes GET /api/catalog/receivers)
  - 05-05 (admin catalog page uses GET/POST/PATCH/toggle on /api/receivers)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "receiversRouter follows mopsRouter pattern but uses req.session.organizationId (not hardcoded 1)"
    - "prisma.$extends query block extended with receiver.findMany soft-delete injection"

key-files:
  created:
    - packages/shared/src/types/receiver.ts
    - packages/backend/src/routes/receivers.ts
  modified:
    - packages/shared/src/types/sale.ts
    - packages/shared/src/types/index.ts
    - packages/backend/src/lib/prisma.ts
    - packages/backend/src/routes/catalog.ts
    - packages/backend/src/app.ts

key-decisions:
  - "receiversRouter uses req.session.organizationId! on all queries — never hardcoded 1 (mops.ts bug avoided)"
  - "GET /api/receivers uses isActive: undefined to bypass $extends default and show all records for admin"
  - "GET /api/catalog/receivers lets $extends apply isActive: true automatically — no explicit where clause needed"
  - "accountNumber treated as optional on PATCH — only updated when key present in request body"

# Metrics
duration: 12min
completed: 2026-06-26
---

# Phase 5 Plan 02: Receiver Catalog Backend Types and Routes Summary

**Receiver TypeScript interface added to shared package; Sale type updated to replace free-text receiver with receiverId FK + receiverNameSnapshot; receiversRouter (admin CRUD + toggle) and catalog /receivers endpoint implemented and wired**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-06-26
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `packages/shared/src/types/receiver.ts` created — `Receiver` interface mirrors Prisma model shape (id, organizationId, name, accountNumber nullable, isActive, ISO timestamps)
- `Sale` interface updated: `receiver: string` removed; `receiverId: number` and `receiverNameSnapshot: string` added after `mopNameSnapshot`
- `Receiver` exported from `packages/shared/src/types/index.ts` (uses `.js` ESM extension convention)
- `packages/backend/src/routes/receivers.ts` created — admin-only router (requireRole at router level) with 4 handlers:
  - `GET /` — all receivers (active + inactive) via `isActive: undefined` override
  - `POST /` — creates receiver; validates name (required, max 255) + accountNumber (optional, max 100)
  - `PATCH /:id` — updates name and/or accountNumber; accountNumber only updated if key present
  - `PATCH /:id/toggle` — flips isActive; returns 404 if receiver not found
- `packages/backend/src/lib/prisma.ts` — receiver section added to `$extends` query block; `receiver.findMany` injects `isActive: true` by default
- `packages/backend/src/routes/catalog.ts` — `GET /api/catalog/receivers` endpoint added; response shape `{ id, name, accountNumber }` per receiver; `$extends` applies active filter automatically
- `packages/backend/src/app.ts` — `receiversRouter` imported and mounted after `mopsRouter`, before `salesRouter` in `protectedRouter`

## Task Commits

1. **Task 1: Shared types** — `5cd8ec5` (feat)
2. **Task 2: receiversRouter + prisma.ts extension** — `a83b036` (feat)
3. **Task 3: catalog.ts + app.ts wiring** — `66e9085` (feat)

## Receiver API Response Shape

```json
{
  "id": 1,
  "organizationId": 1,
  "name": "Juan dela Cruz",
  "accountNumber": "0012345678",
  "isActive": true,
  "createdAt": "2026-06-26T09:10:00.000Z",
  "updatedAt": "2026-06-26T09:10:00.000Z"
}
```

Catalog endpoint (`GET /api/catalog/receivers`) returns a lighter shape:

```json
{ "id": 1, "name": "Juan dela Cruz", "accountNumber": "0012345678" }
```

## How $extends Soft-Delete Extension Works for Receiver

In `packages/backend/src/lib/prisma.ts`, the `$extends` block's `query` section now includes a `receiver` entry after `mop`:

```typescript
receiver: {
  findMany({ args, query }) {
    args.where = { isActive: true, ...args.where };
    return query(args);
  },
},
```

This means every `prisma.receiver.findMany(...)` call automatically adds `isActive: true` to the `where` clause unless the caller explicitly overrides it. The admin `GET /api/receivers` route overrides with `isActive: undefined` to see all records.

## TypeScript Errors Encountered and Resolved

None. `packages/shared` compiled without errors after all three tasks. Backend TypeScript (`packages/backend`) will have errors until Plan 03 is applied (sales routes still reference the old `receiver: string` field on the Sale type).

## Deviations from Plan

None — plan executed exactly as written. The pattern for receiversRouter matched the mops reference without deviation.

## Known Stubs

None — this plan delivers API routes only (no UI). All data-flow paths are wired end-to-end from the Prisma model through to JSON responses.

## Threat Flags

No new security surface beyond what the plan's threat model covers. All five threats mitigated:
- T-05-04: `receiversRouter.use(requireRole('admin'))` at router level
- T-05-05: `organizationId` always from `req.session.organizationId!`, never from `req.body`
- T-05-06: `body('name').trim().notEmpty()` with express-validator
- T-05-07: `body('accountNumber').isLength({ max: 100 })`
- T-05-08: `where: { organizationId: req.session.organizationId! }` in catalog handler

---
*Phase: 05-receiver-catalog*
*Completed: 2026-06-26*
