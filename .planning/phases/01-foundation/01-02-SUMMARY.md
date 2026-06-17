---
phase: 01-foundation
plan: "02"
subsystem: shared-types
tags: [typescript, api-contracts, domain-types, shared-package]
dependency_graph:
  requires: [01-01]
  provides: [shared-type-definitions]
  affects: [backend-routes, frontend-components]
tech_stack:
  added: []
  patterns: [barrel-re-export, esm-js-extensions, api-response-shapes]
key_files:
  created:
    - packages/shared/src/types/user.ts
    - packages/shared/src/types/product.ts
    - packages/shared/src/types/mop.ts
    - packages/shared/src/types/sale.ts
    - packages/shared/src/types/audit.ts
    - packages/shared/src/types/index.ts
  modified: []
decisions:
  - "Sale type includes productNameSnapshot and mopNameSnapshot as denormalized string fields; plan 03 Prisma schema must add these columns (cross-plan dependency)"
  - "index.ts uses .js extensions in import paths for ESM moduleResolution:node16 compatibility"
  - "AuditEntry.id typed as number (not BigInt) — safe for v1 scale (T-02-03 accept disposition)"
  - "passwordHash excluded from User interface at the type level — structurally impossible to leak in API responses"
metrics:
  duration: "2m"
  completed: "2026-06-17"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 1 Plan 2: Shared TypeScript Domain Types Summary

**One-liner:** TypeScript API response interfaces for all 6 domain entities with string-typed monetary fields and organizationId on every type, enforcing CLAUDE.md Rules 4, 5, and 6 at the type system level.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create shared type definitions for all domain entities | d7fab49 | packages/shared/src/types/{user,product,mop,sale,audit,index}.ts |

## Files Created

| File | Purpose |
|------|---------|
| `packages/shared/src/types/user.ts` | `User` interface + `Role` type + `Organization` interface |
| `packages/shared/src/types/product.ts` | `Product` interface with `price: string` |
| `packages/shared/src/types/mop.ts` | `Mop` interface with `isActive` soft-delete field |
| `packages/shared/src/types/sale.ts` | `Sale` interface + `SaleStatus` type with `priceSnapshot: string`, `productNameSnapshot`, `mopNameSnapshot` |
| `packages/shared/src/types/audit.ts` | `AuditEntry` interface + `AuditAction` type |
| `packages/shared/src/types/index.ts` | Barrel re-export — `import { User } from '@alejinput/shared'` |

## Cross-Plan Dependency: Plan 03 Schema Must Add Snapshot Columns

The `Sale` interface includes `productNameSnapshot: string` and `mopNameSnapshot: string`. These are API-response denormalized fields that satisfy CLAUDE.md Rule 4 (never join to products for display price or name on historical rows). Plan 03 (Prisma schema) must add these two columns to the `Sale` model in `schema.prisma`:

```prisma
model Sale {
  ...
  productNameSnapshot  String   @db.VarChar(255)  // Denormalized at creation
  mopNameSnapshot      String   @db.VarChar(255)  // Denormalized at creation
  ...
}
```

Without these columns in the Prisma schema, the backend route handlers that serialize Sale rows to the `Sale` type will have a type error.

## ESM Import Path Convention

All re-exports in `index.ts` use `.js` extensions (e.g., `from './user.js'`). This is required for ESM packages with `"type": "module"` and Node.js `moduleResolution: node16`. TypeScript resolves `.js` imports to `.ts` source files at compile time. This avoids runtime `ERR_MODULE_NOT_FOUND` errors.

## CLAUDE.md Rule Enforcement via Type System

| Rule | Enforcement |
|------|-------------|
| Rule 3 (soft-delete only) | `isActive: boolean` on User, Product, Mop; `status: SaleStatus` on Sale |
| Rule 4 (price snapshot) | `priceSnapshot: string` + `productNameSnapshot: string` + `mopNameSnapshot: string` on Sale |
| Rule 5 (organizationId everywhere) | `organizationId: number` on User, Product, Mop, Sale, AuditEntry |
| Rule 6 (prices as strings) | `price: string` on Product; `priceSnapshot: string` on Sale — TypeScript rejects `number` assignment |

## Security Notes (Threat Model)

| Threat | Disposition | Implementation |
|--------|-------------|----------------|
| T-02-01: passwordHash disclosure | Mitigated | `passwordHash` field absent from `User` interface — backend cannot accidentally include it in typed API responses |
| T-02-02: Float precision on prices | Mitigated | `price: string` and `priceSnapshot: string` — TypeScript rejects numeric assignment |
| T-02-03: AuditLog BigInt serialization | Accepted | `id: number` — safe up to 2^53-1 (9 quadrillion entries); sufficient for v1 |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] packages/shared/src/types/user.ts — exists, contains `Role`, `User`, `Organization`, `organizationId: number`, `isActive: boolean`
- [x] packages/shared/src/types/product.ts — exists, contains `price: string` (NOT `price: number`)
- [x] packages/shared/src/types/mop.ts — exists, contains `Mop` with `organizationId` and `isActive`
- [x] packages/shared/src/types/sale.ts — exists, contains `SaleStatus`, `priceSnapshot: string`, `productNameSnapshot: string`, `mopNameSnapshot: string`
- [x] packages/shared/src/types/audit.ts — exists, contains `AuditAction`, `AuditEntry`
- [x] packages/shared/src/types/index.ts — exists, re-exports all types with `.js` extensions
- [x] No `passwordHash` field in any interface (only in comments explaining its intentional absence)
- [x] No monetary field typed as `number`
- [x] Commit d7fab49 exists
