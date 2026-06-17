---
phase: 02-auth-catalogs
plan: "03"
subsystem: api
tags: [products, mops, catalog, rbac, soft-delete, decimal-serialization, express-validator]

# Dependency graph
requires:
  - phase: 02-01
    provides: requireRole curried middleware factory (packages/backend/src/middleware/requireRole.ts)
  - phase: 02-02
    provides: protectedRouter inline assembly in app.ts, app.ts live route mount pattern
provides:
  - productsRouter with 4 endpoints (GET list, POST create, PATCH update, PATCH toggle)
  - mopsRouter with 4 endpoints (GET list, POST create, PATCH update, PATCH toggle)
  - app.ts protectedRouter extended with /products and /mops catalog routes
affects:
  - 02-04 and beyond (Phase 3 sales row creation will write priceSnapshot/productNameSnapshot/mopNameSnapshot from catalog API responses)
  - frontend catalog management UI (Phase 4)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Router-level requireRole('admin') — all sub-routes inherit admin check automatically
    - $extends soft-delete override — isActive: { in: [true, false] } in where clause wins over injected default isActive: true
    - Decimal serialization — price.toFixed(2) always; never .toString() (drops trailing zeros) or .toNumber() (float loss)
    - Serialize helper function — inline type annotation for Prisma model shape to avoid import of generated Prisma types directly
    - findFirst with isActive bypass — for toggle endpoint that must read current state of any record regardless of active status

key-files:
  created:
    - packages/backend/src/routes/products.ts
    - packages/backend/src/routes/mops.ts
  modified:
    - packages/backend/src/app.ts

key-decisions:
  - "Separate PATCH /:id/toggle endpoint from PATCH /:id to keep update semantics distinct from toggle semantics — cleaner REST contract for frontend"
  - "findFirst with isActive: { in: [true, false] } for toggle endpoint — cannot use findUnique (no unique index on id + organizationId alone for override) and must bypass $extends for inactive records"
  - "serializeProduct/serializeMop inline type annotation instead of Prisma.$Result import — avoids dependency on generated client internals, matches established pattern in auth.ts"

patterns-established:
  - "Admin list override: pass isActive: { in: [true, false] } to override $extends injected default and see all records"
  - "Decimal API serialization: always .toFixed(2) — documented pitfall from RESEARCH.md Pitfall 5"
  - "Toggle via fetch-then-update: findFirst (with bypass) to get current state, then update to !current.isActive"

requirements-completed:
  - PROD-01
  - PROD-02
  - PROD-03
  - PROD-04
  - PROD-06
  - PROD-07
  - PAY-01
  - PAY-02
  - PAY-03
  - PAY-04
  - PAY-06

# Metrics
duration: ~3min
completed: "2026-06-17"
---

# Phase 2 Plan 03: Catalog Routes Summary

**Admin-only products and MOPs CRUD API with soft-delete toggle, $extends override for admin list, and Decimal-to-string serialization — wired into the existing protectedRouter.**

## Performance

- **Duration:** ~3 minutes
- **Started:** 2026-06-17T17:23:58Z
- **Completed:** 2026-06-17T17:26:42Z
- **Tasks:** 3 (Task 3 was auto-approved checkpoint)
- **Files modified:** 3

## Accomplishments

- productsRouter delivers PROD-01 through PROD-04: POST create (with isDecimal validation), GET list (all active + inactive via $extends override), PATCH update (name and/or price), PATCH toggle (isActive flip without hard delete)
- mopsRouter mirrors the products pattern without a price field — PAY-01 through PAY-04
- PROD-06, PROD-07, and PAY-06 verified: priceSnapshot, productNameSnapshot, and mopNameSnapshot are confirmed present in the Phase 1 Prisma Sale model (schema.prisma lines 108-112); Phase 3 will write these fields from the catalog API responses at row creation time
- app.ts protectedRouter now fully assembled: /users (usersRouter), /products (productsRouter), /mops (mopsRouter) — all under requireAuth guard

## Task Commits

1. **Task 1: Implement products.ts and mops.ts catalog routes** - `70e41c8` (feat)
2. **Task 2: Wire catalog routes into protectedRouter in app.ts** - `1046371` (feat)
3. **Task 3: Verify Phase 1 schema snapshot fields** - Auto-approved checkpoint (no code commit — schema verified via grep)

## Files Created/Modified

- `packages/backend/src/routes/products.ts` — productsRouter: GET list, POST create, PATCH update, PATCH toggle with requireRole('admin') at router level and price.toFixed(2) serialization
- `packages/backend/src/routes/mops.ts` — mopsRouter: GET list, POST create, PATCH update, PATCH toggle with requireRole('admin') at router level (no price field)
- `packages/backend/src/app.ts` — added productsRouter and mopsRouter imports; replaced Plan 03 comment stubs with live mounts on protectedRouter

## Decisions Made

- Separate PATCH /:id/toggle endpoint from PATCH /:id: keeps update and activate/deactivate semantics clearly separated in the REST contract. The toggle endpoint returns the updated record so the frontend can reflect the new state without a separate GET.
- findFirst with isActive bypass for toggle endpoint: the toggle must read the current isActive state of any record regardless of whether it is active. findFirst with `isActive: { in: [true, false] }` in the where clause overrides the $extends default and is consistent with the GET list pattern.
- Inline serialize helper function type annotation: avoids importing generated Prisma types directly. Matches the pattern established in auth.ts.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The two pre-existing TypeScript errors (TS5110: module/moduleResolution mismatch; TS6059: seed.ts outside rootDir) were present before this plan and are documented in the Plan 01 SUMMARY.md as out-of-scope.

## Known Stubs

None — all endpoints have real logic. organizationId: 1 is a deliberate Phase 2 single-org hardcode per plan spec (not a stub — Phase 2 explicitly defers multi-tenant isolation to v2).

## Threat Surface Scan

All five STRIDE threats from the plan's threat model are mitigated as implemented:

- T-02-P03-01 (Elevation of Privilege): requireRole('admin') at router level on both productsRouter and mopsRouter
- T-02-P03-02 (Tampering): organizationId: 1 in all where clauses prevents cross-tenant update
- T-02-P03-03 (Information Disclosure): price.toFixed(2) on every response — no float precision loss
- T-02-P03-04 (Tampering): No DELETE endpoint defined in either router
- T-02-P03-05 (Tampering): isDecimal({ decimal_digits: '0,2' }) validation on price field in POST and PATCH

No new threat surface beyond what the plan's threat model covers.

## Next Phase Readiness

- Phase 3 (sales core) can now call GET /api/products and GET /api/mops to populate combo boxes
- Phase 3 sales row creation will copy `name` and `price` from catalog API responses into `productNameSnapshot`, `priceSnapshot`, and `mopNameSnapshot` columns (schema contract confirmed present in this plan)
- The requireRole + soft-delete override + Decimal serialization patterns are fully established for any future catalog-style routes

---
*Phase: 02-auth-catalogs*
*Completed: 2026-06-17*

## Self-Check: PASSED

Files confirmed present:
- packages/backend/src/routes/products.ts: FOUND (created in Task 1, commit 70e41c8)
- packages/backend/src/routes/mops.ts: FOUND (created in Task 1, commit 70e41c8)
- packages/backend/src/app.ts: FOUND (modified in Task 2, commit 1046371)

Commits confirmed:
- 70e41c8: feat(02-03): implement productsRouter and mopsRouter catalog routes
- 1046371: feat(02-03): wire productsRouter and mopsRouter into protectedRouter in app.ts

Schema fields confirmed:
- priceSnapshot at schema.prisma line 109: FOUND
- productNameSnapshot at schema.prisma line 108: FOUND
- mopNameSnapshot at schema.prisma line 112: FOUND
