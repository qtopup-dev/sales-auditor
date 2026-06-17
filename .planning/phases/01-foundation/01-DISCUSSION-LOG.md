# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 1-foundation
**Areas discussed:** Primary key strategy, Seed data scope, Frontend scaffold, Dev tooling

---

## Primary key strategy

| Option | Description | Selected |
|--------|-------------|----------|
| INT auto-increment | Simpler, smaller indexes, faster joins in MySQL. Research recommends INT for v1, migrate to UUID at multi-tenant v2. | ✓ |
| UUID v4 (string) | Globally unique, harder to enumerate. Stored as CHAR(36) — larger indexes, slightly slower joins. | |
| UUID as BINARY(16) | UUID semantics with INT-level storage. Requires Prisma db.Bytes() type and helper functions. | |

**User's choice:** INT auto-increment
**Notes:** Research notes from SUMMARY.md explicitly recommended INT for v1 simplicity; migrate to UUID as part of multi-tenant v2 effort.

---

## Seed data scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minimum: 1 org + 1 admin user | Exactly what Phase 1 success criteria requires. | ✓ |
| Rich dev seed: org + admin + sample products/MOPs | Seed 3-5 products and 2-3 MOPs for dev convenience. | |

**User's choice:** Minimum seed
**Notes:** User prefers developers create data through the app's own flows, ensuring the creation flows are tested from day one.

---

## Frontend scaffold

| Option | Description | Selected |
|--------|-------------|----------|
| Shell only: Vite + React + TS placeholder | Satisfies "npm run dev starts both servers" with minimal Phase 1 scope. Full setup in Phase 2. | ✓ |
| Full frontend skeleton: all dependencies configured | Wire up Tailwind, react-router, axios, React Query now. | |

**User's choice:** Shell only
**Notes:** Keeps Phase 1 focused on infrastructure. Phase 2 will wire up full frontend dependencies when auth pages are actually built.

---

## Dev tooling

| Area | Option | Description | Selected |
|------|--------|-------------|----------|
| TypeScript strictness | strict: true | All strict checks including strictNullChecks, noImplicitAny. | ✓ |
| TypeScript strictness | Relaxed | strictNullChecks only. | |
| Linting | ESLint + Prettier root-level | One config at monorepo root, applies to all packages. | ✓ |
| Linting | Skip | Add later. | |
| Backend dev reload | tsx --watch | Modern, fast, no Prisma compatibility issues. | ✓ |
| Backend dev reload | nodemon + ts-node | Classic combo, more config, slower restarts. | |

**User's choices:** strict: true, ESLint + Prettier at root, tsx --watch
**Notes:** All recommended defaults chosen. No surprises.

---

## Claude's Discretion

- Exact ESLint rule set (recommended defaults)
- Prettier formatting options (defaults)
- .env.example structure
- Express error handler JSON response shape
- Monorepo root package.json scripts
- Prisma composite index choices beyond schema-required ones

## Deferred Ideas

None.
