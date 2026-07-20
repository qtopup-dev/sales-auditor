# Phase 9: Add the option to delete MOPs, Products, and Users for the admin role - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can permanently soft-delete a Product, MOP, or User — a new, stricter action distinct from the existing Activate/Deactivate toggle (which already exists for Products and MOPs, but not Users). Delete requires confirmation and removes the item from the UI entirely, with no restore path exposed to the admin.

Delivers: a new `deletedAt` field on Product, Mop, and User; a Delete button + confirm dialog on the Products, MOPs, and Users management tables; backend delete endpoints with safeguards (self-delete block, last-admin block, immediate session kill + login block for Users); soft-delete filter enforcement so deleted rows never appear in any admin-facing list. Existing Activate/Deactivate behavior for Products and MOPs is unchanged.

</domain>

<decisions>
## Implementation Decisions

### Delete Mechanism (schema)
- **D-01:** New nullable `deletedAt DateTime?` field added to the `Product`, `Mop`, and `User` Prisma models — a second soft-delete signal, distinct from the existing `isActive` boolean. `isActive`/Deactivate keeps its current meaning unchanged (hidden from new-entry combo boxes, still visible in admin tables, freely reversible via Activate). `Delete` sets `deletedAt = now()`; a deleted row is never physically removed from the database.
  - **Note:** This extends CLAUDE.md Rule 3 beyond its literal wording ("Users/products/MOPs use `is_active BOOLEAN`") — Rule 3's no-hard-delete principle is fully honored (deletedAt is still soft-delete), but a second field is introduced specifically so Delete can be a stricter, distinct action from Deactivate. Downstream agents should treat this as an approved, deliberate extension of Rule 3, not a violation.
- **D-02:** Deleted rows (`deletedAt IS NOT NULL`) are excluded from ALL admin-facing list queries unconditionally — `GET /api/products`, `GET /api/mops`, `GET /api/users`, and any catalog endpoints used by combo boxes. Extend the existing Prisma soft-delete filter enforcement (CLAUDE.md Rule 8) to also filter `deletedAt: null`. There is no "show deleted" query param, filter, or admin toggle anywhere — deleted rows are gone from every read path.
- **D-03:** Deleting a Product, MOP, or User must NOT touch any `Sale`, `AuditLog`, or `Shift` rows. Historical Sales rows keep their `productNameSnapshot`, `mopNameSnapshot`, `createdByUsername`, etc. regardless of whether the referenced entity is later deleted — consistent with the existing price/name snapshot principle (CLAUDE.md Rule 4).

### Confirmation Flow
- **D-04:** Delete requires a confirmation dialog for all three entities (Product, MOP, User) — modeled on `VoidConfirmDialog.tsx`: modal + explanatory text + Cancel/Confirm buttons + pessimistic pending state (buttons disabled during the round-trip). The existing Activate/Deactivate toggle remains instant/unconfirmed, unchanged from today.
- **D-05:** Same confirm-dialog treatment for all three entities — no extra User-specific warning copy beyond standard confirmation text (the "extra warning text for User delete" variant was considered and rejected).

### UI Placement & Wording
- **D-06:** Delete is a new button added to each entity's existing Actions column: Products/MOPs become Edit | Activate/Deactivate | **Delete**; Users become Edit | Enable/Disable Editing | Reset Password | **Delete**. Delete uses red/danger styling to visually distinguish it from the neutral Edit/Deactivate/Reset actions.
- **D-07:** No "Show deleted" filter, toggle, or read-only audit view anywhere in the UI. Once deleted, a Product/MOP/User is completely gone from every admin-facing table — there is no way to view or browse it again in the UI, and no Restore action. The underlying row is preserved in the DB (soft-delete via `deletedAt`) but is not admin-accessible through any UI surface in this phase.

### User Deletion Safeguards
- **D-08:** Backend blocks self-delete — the delete endpoint rejects with a 4xx error if the target user ID equals `req.session.userId`.
- **D-09:** Backend blocks deleting the last remaining admin — before deleting a User with `role: 'admin'`, count other admins with `deletedAt: null`; if the count would drop to 0, reject with a 4xx error.
- **D-10:** Deleting a User immediately destroys all of their active sessions (reuse the direct-SQL `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?` pattern established in Phase 2 D-03 / Phase 8 D-06) and the login route must reject credentials for any user with `deletedAt` set, in addition to existing checks.

### Claude's Discretion
- Exact confirm-dialog copy per entity (e.g. "Delete this product? This cannot be undone.")
- Exact HTTP verb/route naming for the three delete endpoints (`DELETE /api/products/:id` vs `POST /api/products/:id/delete`, etc.) — follow existing REST conventions in the codebase; note the existing toggle routes use `PATCH .../toggle`, so pick whatever reads most consistently
- Exact error codes/messages for the self-delete and last-admin blocks (e.g. `400 { error: 'CANNOT_DELETE_SELF' }`, `400 { error: 'LAST_ADMIN' }`)
- Whether Product/Mop/User backend routes share a single soft-delete helper or implement delete independently per route file
- Migration mechanics — check whether the manual `db execute` + `migrate resolve` workaround (used in Phases 5 and 7 due to sessions-table drift) is still required for this migration

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture — non-negotiable locked decisions
- `CLAUDE.md` §Critical Architecture Rules — Rule 3 (soft-delete only; this phase's D-01 is a deliberate, approved extension adding a second field — see note under D-01), Rule 8 (soft-delete filter enforcement — must be extended to cover `deletedAt`), Rule 9 (backend enforces RBAC — delete endpoints are admin-only, same as existing product/mop/user routes).

### Phase 9 requirements
- `.planning/ROADMAP.md` §Phase 9 — currently title-only; this CONTEXT.md is the source of scope until ROADMAP.md is updated during planning.

### Existing infrastructure (Phase 9 builds on top of these — do not modify their current behavior)
- `packages/backend/prisma/schema.prisma` — `Product` model (isActive, no deletedAt today), `Mop` model (isActive, no deletedAt today), `User` model (isActive present at line ~59 but never written to by any route). Phase 9 adds `deletedAt DateTime?` to all three.
- `packages/backend/src/routes/products.ts` — `PATCH /api/products/:id/toggle` (isActive flip, ~lines 125-154), `PATCH /api/products/:id` (edit), `POST /api/products` (create). Phase 9 adds a delete route; toggle route stays unchanged.
- `packages/backend/src/routes/mops.ts` — `PATCH /api/mops/:id/toggle` (~lines 91-120), same pattern as products.ts. Phase 9 adds a delete route; toggle route stays unchanged.
- `packages/backend/src/routes/users.ts` — `PATCH /api/users/:id/username`, `PATCH /api/users/:id` (canEdit toggle), `POST /api/users/:id/reset-password`. `isActive` field is read but never written anywhere in this file today. Phase 9 adds a delete route with the D-08/D-09/D-10 safeguards.
- `packages/frontend/src/pages/ProductsPage.tsx` (~lines 84-95) and the MOPs equivalent — existing Actions column pattern (Edit + Activate/Deactivate button, pessimistic `pendingToggleId` state, no confirm dialog). Phase 9 adds Delete to this column.
- `packages/frontend/src/pages/UsersPage.tsx` (~lines 158-213) — existing Actions (Edit, Enable/Disable Editing, Reset Password). Phase 9 adds Delete to this column.
- `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` — confirm-dialog pattern to model the new Delete confirmation on (modal + Cancel/Confirm + pessimistic pending state, built on the shared `Modal.tsx` wrapper). There is no generic reusable `ConfirmDialog.tsx` today — each confirmation is hand-built per feature.

### Prior art for session invalidation (reuse for User delete, D-10)
- `.planning/phases/02-auth-catalogs/02-CONTEXT.md` §D-03 — admin password-reset session-kill pattern: direct SQL `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?`.
- `.planning/phases/08-self-service-password-change-for-moderators-via-username-dro/08-CONTEXT.md` §D-06 — same query pattern, with the "exclude current session" variant (not needed here — User delete should kill ALL of the deleted user's sessions, no exclusion).

### Migration workflow precedent
- `.planning/STATE.md` §Key Decisions Locked — "Manual migration workflow (db execute + migrate resolve)" was required for Phase 5 and Phase 7 migrations due to sessions-table drift blocking `prisma migrate dev`. Check during planning whether this workaround is still needed for the Phase 9 `deletedAt` migration.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VoidConfirmDialog.tsx` — direct template for the new Delete confirm dialogs (three instances: Product, MOP, User), built on shared `Modal.tsx`.
- `pendingToggleId` pessimistic-UI pattern (ProductsPage.tsx) — reuse for the Delete button's pending/disabled state during the round-trip.
- Direct-SQL session-kill query (users.ts reset-password route) — reuse verbatim (no exclusion clause needed) for User delete.
- Existing Prisma soft-delete filter/middleware (CLAUDE.md Rule 8 enforcement) — extend to also check `deletedAt: null`, not just `isActive`.

### Established Patterns
- Admin-only routes: `requireRole('admin')` mounted at router level (productsRouter, mopsRouter, usersRouter precedent) — new delete routes need no additional per-route guard.
- Error handler reads `err.statusCode` + `err.code` — throw `{ statusCode: 400, code: 'CANNOT_DELETE_SELF' }` / `{ statusCode: 400, code: 'LAST_ADMIN' }` for the two User-delete safeguards.
- Modal-based confirm flows with inline error states — consistent with Phase 2/3/8 precedent.

### Integration Points
- `packages/backend/src/app.ts` — no new router mounts needed; delete endpoints hang off the existing productsRouter/mopsRouter/usersRouter.
- Frontend: ProductsPage.tsx, MopsPage.tsx (mirror of ProductsPage), UsersPage.tsx — each gets a new Delete button + a new confirm-dialog component in their Actions column.

</code_context>

<specifics>
## Specific Ideas

- The core architectural nuance: this phase deliberately introduces a SECOND soft-delete signal (`deletedAt`) alongside the existing `isActive` boolean for Product/Mop/User, so that "Delete" reads as more final than "Deactivate" even though both remain non-destructive under the hood. Planner and researcher should not collapse these into a single field — they are separate concepts by explicit user decision.
- User delete is the most safeguard-heavy of the three: self-delete block, last-admin block, and immediate session kill + login rejection all apply only to User delete, not to Product/MOP delete.
- Since deleted items are fully hidden from the UI with no restore path, the ONLY way to "undo" a delete in v1 is direct database access (`deletedAt = NULL`) — this is intentional per the user's choice, not an oversight to flag.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-add-the-option-to-delete-mops-products-and-users-for-the-adm*
*Context gathered: 2026-07-21*
