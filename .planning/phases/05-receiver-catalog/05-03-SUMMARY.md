---
phase: 05-receiver-catalog
plan: 03
subsystem: backend-api
tags: [typescript, express, prisma, receivers, sales, audit-log, soft-delete, rbac]

# Dependency graph
requires:
  - phase: 05-01
    provides: Receiver Prisma model (receiverId FK + receiverNameSnapshot on Sale schema)
  - phase: 05-02
    provides: Receiver TypeScript interface; Sale type updated (receiverId + receiverNameSnapshot replacing receiver:string)
provides:
  - POST /api/sales accepts receiverId (int) instead of receiver (string)
  - POST /api/sales validates receiver org-scope + isActive in same transaction
  - PATCH /api/sales/:id field='receiverId' atomically updates FK + snapshot + 2 audit entries
  - field='receiver' returns 400 VALIDATION_ERROR (removed from ALLOWED_PATCH_FIELDS)
  - serializeSale returns receiverId + receiverNameSnapshot (receiver string field gone)
affects:
  - 05-04 (frontend sales sheet must send receiverId not receiver string in POST/PATCH)
  - 05-05 (admin catalog page — no sales.ts impact)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "receiverId PATCH branch mirrors mopId pattern exactly: findFirst(isActive+orgScope) → update FK+snapshot → auditLog.createMany(2 entries)"
    - "Receiver lookup in POST uses tx.receiver.findFirst with explicit isActive:true because $extends NOT active in transactions"
    - "Old audit values captured from Prisma result BEFORE update (T-03-08 pattern prevents audit forgery)"

key-files:
  created: []
  modified:
    - packages/backend/src/routes/sales.ts

key-decisions:
  - "receiverId PATCH branch positioned between mopId and else(notes) fallback — same structural slot as mopId branch"
  - "tx.auditLog.createMany writes 2 entries (receiverId + receiverNameSnapshot) in receiverId PATCH branch — mirrors mopId audit pattern"
  - "else fallback comment updated: 'receiver or notes' changed to 'notes only' — receiver no longer handled by generic path"

requirements-completed: [PHASE5-SC5]

# Metrics
duration: 5min
completed: 2026-06-26
---

# Phase 5 Plan 03: Sales Routes — receiverId Migration Summary

**sales.ts fully migrated from free-text receiver string to receiverId FK + receiverNameSnapshot: serializeSale, validators, ALLOWED_PATCH_FIELDS, POST handler, and new PATCH receiverId branch all updated**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-26T13:30:43Z
- **Completed:** 2026-06-26T13:34:50Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- `serializeSale` parameter type: `receiver: string` removed; `receiverId: number` and `receiverNameSnapshot: string` added — return object updated to match
- `ALLOWED_PATCH_FIELDS` changed from `['productId', 'mopId', 'receiver', 'notes']` to `['productId', 'mopId', 'receiverId', 'notes']` — `field='receiver'` now returns 400 VALIDATION_ERROR
- `createSaleValidation`: `body('receiver').trim().notEmpty()` replaced with `body('receiverId').isInt({ min: 1 })` — POST now requires an integer receiver ID
- `patchSaleValidation`: integer check expanded from `isIn(['productId', 'mopId'])` to `isIn(['productId', 'mopId', 'receiverId'])`; `body('value').if(body('field').equals('receiver')).trim().notEmpty()` validator removed
- POST handler destructures `receiverId` (not `receiver` string); adds `tx.receiver.findFirst` lookup (org-scoped, isActive:true) in transaction; `tx.sale.create` now stores `receiverId: receiver.id` + `receiverNameSnapshot: receiver.name`
- PATCH handler: new `else if (field === 'receiverId')` branch added between mopId and else(notes) fallback — atomically updates FK + snapshot + writes 2 audit log entries (`receiverId` + `receiverNameSnapshot`) in same Prisma transaction

## Task Commits

1. **Task 1: Update serializeSale, validators, ALLOWED_PATCH_FIELDS, and POST handler** — `b8fb3e9` (feat)
2. **Task 2: PATCH receiverId branch (atomic FK + snapshot + 2 audit entries)** — `36db91b` (feat)

## Files Created/Modified

- `packages/backend/src/routes/sales.ts` — 6 targeted changes across serializeSale, validators, POST, and PATCH handler

## Decisions Made

- PATCH receiverId branch mirrors mopId branch exactly (same structural pattern: findFirst → update → auditLog.createMany with 2 entries), making the codebase consistent and reducing future cognitive load
- `tx.receiver.findFirst` uses explicit `isActive: true` in both POST and PATCH handlers because Prisma `$extends` soft-delete injection does NOT apply inside transactions

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Two pre-existing tsconfig errors exist in `packages/backend` (seed.ts rootDir mismatch + module/moduleResolution setting mismatch). These are NOT caused by this plan's changes and were present before execution. Our `sales.ts` changes produce no TypeScript errors.

## Known Stubs

None — this plan modifies API routes only. All data-flow paths are complete end-to-end.

## Threat Flags

No new security surface beyond what the plan's threat model covers. All four threats mitigated:

- T-05-09: `tx.receiver.findFirst` WHERE `organizationId = req.session.organizationId!` in PATCH receiverId branch — rejects cross-org receiver IDs
- T-05-10: `ALLOWED_PATCH_FIELDS` no longer contains `'receiver'`; express-validator rejects `field='receiver'` with 400
- T-05-11: POST handler receiver lookup uses `isActive: true` — inactive receivers rejected with 404
- T-05-12: `patchSaleValidation` validates `isInt({ min: 1 })` for receiverId; `createSaleValidation` validates same

## Next Phase Readiness

- `05-04` (frontend receiver combobox): POST `/api/sales` now requires `receiverId` (integer) instead of `receiver` (string); PATCH accepts `field='receiverId'`; GET returns `receiverId + receiverNameSnapshot` in every sale row
- `05-05` (admin catalog page): no dependency on `sales.ts` — not affected

---
*Phase: 05-receiver-catalog*
*Completed: 2026-06-26*
