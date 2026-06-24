# Phase 999.1: fix: Add Row Catalog Lag — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 999.1 — fix: Add Row Catalog Lag
**Areas discussed:** Scope, Backend fix, Frontend caching, AddRowForm, EditableCell

---

## Scope — Which users are affected?

| Option | Description | Selected |
|--------|-------------|----------|
| Both admin and moderators | Moderators get 403 from /api/products and /api/mops (admin-only). Admins see lag after void. Both need a fix. | ✓ |
| Admin only (post-void lag) | Fix only the timing/caching problem for admins. | |

**User's choice:** Both — user noted they haven't tested the moderator scenario, so fix it properly.

---

## Backend fix — Catalog endpoint strategy

| Option | Description | Selected |
|--------|-------------|----------|
| New /api/catalog/* endpoints | Add GET /api/catalog/products and /api/catalog/mops — active-only, accessible to all authenticated users. Zero impact on admin routes. | ✓ |
| Expand existing endpoints | Make GET /api/products and /api/mops return active-only for non-admins. Mixes admin and non-admin concerns. | |
| Frontend-only: use existing admin routes | Don't touch backend. Moderators can't add rows. | |

**User's choice:** New /api/catalog/* endpoints.

---

## Frontend fix — Catalog caching strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Eager pre-fetch in SalesPage | SalesPage always runs useQuery for catalog data. Warm before Add Row is clicked. | ✓ |
| Lazy fetch with cache reuse | AddRowForm uses queryClient.fetchQuery — fetch on first open, reuse cache after. First open still loads. | |
| You decide | Claude picks. | |

**User's choice:** Eager pre-fetch in SalesPage.

---

## Stale time

| Option | Description | Selected |
|--------|-------------|----------|
| 5 minutes | Products/MOPs rarely change mid-session. Prevents redundant refetches. | ✓ |
| Infinity (session-wide) | Never refetches. Won't reflect mid-session catalog changes. | |
| You decide | Claude picks. | |

**User's choice:** 5 minutes.

---

## AddRowForm data flow

| Option | Description | Selected |
|--------|-------------|----------|
| useQuery inside AddRowForm | AddRowForm calls useQuery(['catalog-products']) and useQuery(['catalog-mops']) directly. No prop drilling. | ✓ |
| Props from SalesPage via SalesTable | Explicit data flow but threads props through SalesTable. | |

**User's choice:** useQuery inside AddRowForm.

---

## EditableCell — include in scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, fix both | AddRowForm + EditableCell both updated. Single atomic fix. | ✓ |
| AddRowForm only | Tighter scope. Moderator inline-edits still broken. | |

**User's choice:** Yes, fix both.

---

## Claude's Discretion

- Exact file name for new catalog router
- Whether catalog response includes createdAt/updatedAt or minimal shape only
- TypeScript types for catalog shapes (inline or shared)
- Import style in EditableCell for useQuery

## Deferred Ideas

None — discussion stayed within phase scope.
