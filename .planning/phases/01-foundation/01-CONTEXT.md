# Phase 1: Foundation - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Bootstrap the monorepo, define the full Prisma schema with all required tables and constraints, seed the database with the minimum required data, and stand up an Express skeleton — such that every subsequent phase can build on this infrastructure without touching it again.

Success requires: `npm run dev` starts both backend and frontend dev servers without errors; `prisma migrate status` shows clean; GET /health returns 200 with helmet security headers present; one organization and one admin user exist in the database.

</domain>

<decisions>
## Implementation Decisions

### Primary Key Strategy
- **D-01:** All tables use `INT AUTO_INCREMENT` as primary key — not UUID. Decision is explicit for v1 simplicity; migrate to UUID as part of multi-tenant v2 if needed. Applies to: organizations, users, products, mops, sales, audit_log, invite_tokens, sessions.

### Seed Data
- **D-02:** Minimum seed only — one `organizations` row and one admin `users` row. No sample products or MOPs. Developers create catalog data through the app UI in Phase 2/3, ensuring the creation flows are exercised from day one.

### Frontend Scaffold
- **D-03:** Phase 1 delivers a shell only — Vite + React + TypeScript initialized, running a placeholder "App coming soon" page. This satisfies the "npm run dev starts both servers" success criterion. Full frontend dependencies (Tailwind, react-router, axios, React Query, Zustand) are wired up in Phase 2 when auth pages are actually built.

### TypeScript Configuration
- **D-04:** `strict: true` enabled in all tsconfig.json files across all packages. This includes `strictNullChecks`, `noImplicitAny`, and all other strict checks. Non-negotiable for a Prisma project where null/undefined runtime bugs are common without strict checking.

### Linting and Formatting
- **D-05:** ESLint + Prettier configured at the monorepo root level (one `eslint.config.js` and one `.prettierrc` at `/`). Both apply to all packages via workspace inheritance. Set up in Phase 1 to enforce consistent style from the first commit.

### Backend Dev Reload
- **D-06:** `tsx --watch` for backend development. No `nodemon` + `ts-node` — tsx is the modern replacement with faster restarts and no Prisma client compatibility issues.

### Claude's Discretion
- Exact ESLint rule set (recommended defaults are fine)
- Prettier formatting options (defaults are fine)
- `.env.example` structure and which vars to include
- Express error handler response format (JSON `{ error, message }` shape)
- Monorepo root `package.json` scripts (dev, build, lint, format)
- Which Prisma composite indexes to create beyond what the schema naturally requires

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture and locked decisions
- `.planning/STATE.md` — Key Decisions Locked section: 10 locked architectural decisions that are non-negotiable (express-session over JWT, DECIMAL(10,2) for money, organization_id everywhere, soft-delete only, UTC everywhere, etc.)
- `.planning/ROADMAP.md` — Phase 1 section: exact success criteria that must be verifiable; the 5 criteria define what "done" means for this phase
- `CLAUDE.md` — Critical Architecture Rules section (rules 1–10): must be respected in every plan and implementation task

### Schema requirements (from CLAUDE.md rules + STATE.md + ROADMAP success criteria)
- `organization_id` (non-null FK) on every business table: users, sales, products, mops, audit_log, invite_tokens
- `DECIMAL(10,2)` for all monetary columns — never `Float` in Prisma schema
- Soft-delete fields: `status ENUM('active','void')` on sales; `is_active BOOLEAN` on users, products, mops
- `price_snapshot DECIMAL(10,2)` on sales table (denormalized at row creation)
- UTC everywhere: MySQL `time_zone=UTC`, Prisma connection `?timezone=UTC`, `TZ=UTC` Node env var — all three required
- Composite indexes required on audit_log: `(table_name, row_id)` and `(user_id, created_at)`

### Stack versions to verify before pinning
- Express 4 vs Express 5 stable — check expressjs.com (Express 5 was RC as of mid-2025)
- Tailwind CSS v3 vs v4 — check tailwindcss.com/blog (v4 had breaking config changes)
- Prisma v5 current patch — run `npm info prisma version` before pinning
- express-mysql-session active maintenance status — check npm publish date

No external ADR or spec files — all constraints captured in STATE.md, ROADMAP.md, and CLAUDE.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — Phase 1 builds from scratch. This is the first code in the repository.

### Established Patterns
- None yet — the patterns established in Phase 1 (Prisma middleware for soft-delete, router structure, middleware order) become the patterns all subsequent phases inherit.

### Integration Points
- Phase 1 creates the Express skeleton that Phase 2 will attach auth routes to
- Phase 1 creates the Prisma schema that Phase 2, 3, and 4 will write queries against
- Phase 1 creates `/packages/shared` with TypeScript types that all packages import from
- The `GET /health` endpoint is the only API endpoint delivered in Phase 1

</code_context>

<specifics>
## Specific Ideas

- The monorepo uses npm workspaces with three packages: `/packages/backend`, `/packages/frontend`, `/packages/shared`
- `packages/shared` holds TypeScript interfaces/types shared between backend and frontend (e.g., `SalesRow`, `Product`, `AuditEntry` — used in API responses and frontend data models)
- Backend entry point: `packages/backend/src/index.ts` — loads env, connects Prisma, mounts Express app, starts server
- Express app: `packages/backend/src/app.ts` — registers helmet, cors, morgan, JSON body parser, routes, global error handler (separate from index.ts for testability)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 infrastructure scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-06-17*
