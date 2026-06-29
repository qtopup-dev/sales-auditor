# Sales Auditing Web App — Project Guide

## Project

Sales Auditing Web App — an internal web-based tool where moderators enter sales rows in a spreadsheet-like interface and admins oversee all data, manage catalogs, and control user access.

**Stack:** React 18 + Vite + TypeScript (frontend) / Node.js + Express + Prisma v5 (backend) / MySQL (database)
**Deployment:** Cloud VPS / Monorepo with npm workspaces

## Planning Artifacts

- `.planning/PROJECT.md` — project context, requirements, key decisions
- `.planning/REQUIREMENTS.md` — 57 v1 requirements with REQ-IDs
- `.planning/ROADMAP.md` — 4-phase roadmap with success criteria
- `.planning/STATE.md` — current phase state
- `.planning/research/` — stack, features, architecture, pitfalls, summary

## GSD Workflow

This project uses the GSD (Get Shit Done) workflow system.

**Before planning a phase:**
```
/gsd-discuss-phase <N>   # gather context and clarify approach
/gsd-plan-phase <N>      # create detailed PLAN.md
```

**Executing a phase:**
```
/gsd-execute-phase <N>   # run the plan
```

**After a phase:**
```
/gsd-verify-work         # verify phase goal was achieved
```

**Current status:** Roadmap created — ready to start Phase 1.

Next step: `/clear` then `/gsd-discuss-phase 1`

## Critical Architecture Rules

These must be respected in every phase:

1. **express-session over JWT** — Admin session revocation (password reset, edit-rights toggle) requires immediate invalidation. JWT is explicitly excluded.
2. **Audit log in same transaction** — Every sales row mutation must write audit records inside the same Prisma transaction. No exceptions.
3. **Soft-delete only** — No hard deletes anywhere. Sales rows use `status ENUM(active, void)`. Users/products/MOPs use `is_active BOOLEAN`.
4. **Price snapshot** — Copy `product.price` into `sale.price_snapshot` at creation. Never join to products for display price on historical rows.
5. **organization_id on every business table** — Users, sales, products, MOPs, audit_log, invite_tokens all get `organization_id` from day one (multi-tenant v2 prep).
6. **DECIMAL(10,2) for money** — Never `Float` in Prisma schema for monetary values. Return prices as strings from API.
7. **UTC everywhere** — MySQL `time_zone=UTC`, Prisma connection `?timezone=UTC`, `TZ=UTC` in Node process. All three.
8. **Soft-delete filter enforcement** — Every list query on soft-deletable tables must filter by status. Use Prisma middleware for automatic enforcement.
9. **Backend enforces RBAC** — Row ownership and role checks on every mutation endpoint. Frontend checks are UI only.
10. **Pessimistic UI updates** — Disable cell during save round-trip. No optimistic updates in v1.

## Tech Choices

| Concern | Choice | Notes |
|---------|--------|-------|
| Table + virtual scroll | `@tanstack/react-table` v8 + `@tanstack/react-virtual` v3 | Headless; same ecosystem; dynamic row heights |
| Combo boxes | `react-select` v5 | Async loading, react-hook-form Controller compatible |
| Charts | `Recharts` v2 | Declarative React API |
| Forms | `react-hook-form` v7 | Minimal re-renders |
| HTTP client | `axios` v1 | 401 interceptor for session expiry |
| Routing | `react-router-dom` v6 | Data router for route guards |
| Styling | `Tailwind CSS` v3 | [VERIFY v4 stable before starting] |
| Server state | `@tanstack/react-query` v5 | Query + mutation management |
| UI state | `Zustand` | Edit-mode state isolated from server data |
| CSV export | `@json2csv/plainjs` | Formula injection sanitization required |
| Security | `helmet`, `cors`, `morgan` | Install from day one |
| Session store | `express-session` + MySQL-backed store | Never use MemoryStore in production |
| Password hashing | `bcrypt` (cost factor 12) | |
| Input validation | `express-validator` v7 | Validate all API payloads |

**Verify before pinning:** Express 4 vs 5 stable, Tailwind v3 vs v4, react-select version, MySQL session store package maintenance status.
