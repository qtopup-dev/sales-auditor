# Phase 12: Moderator Void Requests - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Moderators cannot void rows directly (only admins can, per Phase 3 ROLES-06). This phase adds a request-based workflow: a moderator can submit a "Void Request" with a plain-text reason on one of their own active sales rows, from a new button on the Sales sheet with a tooltip explaining its purpose. Admins review pending requests on a new "Void Requests" sidebar tab (admin-only), in a sales-like table with an added Reason column, and can Approve (voids the underlying sale row, same as the existing admin void action) or Reject (row stays active, no change). The admin sidebar shows a red-circle badge next to "Void Requests" with the count of still-pending (unreviewed) requests.

Delivers: a new `VoidRequest` model; a "Void Request" button + reason input + tooltip on the moderator Sales sheet (per-row, own active rows only); backend endpoints to create/list/approve/reject requests; a new admin-only `/void-requests` page + sidebar nav entry with a pending-count badge.

</domain>

<decisions>
## Implementation Decisions

### Request Scope & Eligibility
- **D-01:** A moderator can submit a Void Request only on an active (`status: 'active'`) sales row they themselves created (`createdById === session.userId`) — mirrors the existing edit-rights/ownership scoping already enforced on Sale mutations (ROLES-04/06 precedent in `sales.ts`).
- **D-02:** At most one **pending** Void Request may exist per sale row at a time. While a row has a pending request, its "Void Request" button is disabled (or hidden) on the moderator's Sales sheet. Backend must enforce this — not just the frontend (CLAUDE.md Rule 9).
- **D-03:** After a request is rejected, the row becomes eligible again — the moderator can submit a new Void Request on the same row. No permanent lockout.

### Admin Review & Table Behavior
- **D-04:** The `/void-requests` admin page shows ALL requests (pending, approved, rejected) newest-first in one table, with a Status column — mirrors the existing pattern of voided sales rows staying visible with strikethrough rather than disappearing. No "pending only" filter is required for v1 (Claude's discretion whether to add a convenience filter).
- **D-05:** The table has the same columns as the sales table (Product, Price, MOP, Receiver, Notes, Created By, Created At) **plus** a plain-text "Reason" column (same treatment as the existing Notes column — no truncation logic beyond what Notes already does) and a Status column (Pending / Approved / Rejected). Approve/Reject action buttons appear only on Pending rows.
- **D-06:** Approving a request performs the same void operation as the existing `POST /:id/void` admin endpoint (sets `status: 'void'`, writes an AuditLog `void` entry in the same transaction, updates `lastEditedById`/`lastEditedByUsername`) AND marks the VoidRequest as approved (reviewedBy, reviewedAt). Rejecting only updates the VoidRequest record (status, reviewedBy, reviewedAt) — the sale row is untouched.

### Moderator-Side Feedback
- **D-07:** The moderator's Sales sheet shows no special visual indicator for pending/rejected requests beyond the button being disabled while a request is pending (D-02). No "request rejected" notification or badge for moderators in this phase.

### Badge & Data Freshness
- **D-08:** The red pending-count badge next to "Void Requests" in the admin sidebar follows existing app conventions: React Query fetch + its default staleness/refetch-on-navigation behavior. No websockets, no dedicated polling interval — this codebase has neither today, and Phase 6/7/etc. never introduced one for other counts.
- **D-09:** Badge only counts requests with `status: 'pending'`. Badge is hidden/omitted entirely when the count is 0 (not shown as a "0").

### Claude's Discretion
- Exact `VoidRequest` schema shape (own table vs. reusing `AuditLog`) — planner's call; a dedicated `VoidRequest` model is the strong default given the distinct pending/approved/rejected lifecycle and the Reason field, which doesn't fit `AuditLog`'s existing shape.
- Exact wording of the tooltip and confirm-copy for "Void Request" (button label is fixed by the user as "Void Request").
- Whether reason entry happens inline (small text input in a row action) or in a small modal/dialog — follow the closest existing pattern (`VoidConfirmDialog.tsx` for admin void, but this needs a text field, so likely a new small dialog modeled on it).
- Whether Approve/Reject need their own confirm dialogs, or execute directly like a toggle — no strong precedent either way (admin void already has a confirm dialog; toggle actions don't). Recommend: Approve gets a confirm (it's irreversible, same weight as void), Reject can be instant (reversible in the sense that the moderator can just resubmit).
- Exact HTTP routes/verb naming (e.g. `POST /api/void-requests`, `PATCH /api/void-requests/:id/approve`, `PATCH /api/void-requests/:id/reject`) — follow existing REST conventions in the codebase (see `sales.ts` `/void` pattern).
- Migration mechanics — check whether the manual `db execute` + `migrate resolve` workaround (required in Phases 5/7 due to sessions-table drift) is still needed for this new-table migration.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture — non-negotiable locked decisions
- `CLAUDE.md` §Critical Architecture Rules — Rule 2 (audit log in same transaction — Approve must write the AuditLog `void` entry in the same transaction as the sale status update and the VoidRequest status update), Rule 3 (soft-delete only — no relevance to hard-deleting VoidRequest rows; they are never deleted), Rule 5 (organization_id on every business table — VoidRequest needs it), Rule 9 (backend enforces RBAC — request creation is moderator-only on own rows, approve/reject is admin-only, enforced server-side).

### Existing infrastructure (Phase 12 builds on top of these — do not modify their current behavior)
- `packages/backend/src/routes/sales.ts` lines 562-624 — the existing `POST /:id/void` admin-only endpoint (`requireRole('admin')`, transactional status update + AuditLog `void` entry). Phase 12's Approve action performs the equivalent operation from a different route, or Claude may choose to internally reuse this logic — planner's call.
- `packages/backend/prisma/schema.prisma` — `Sale` model (lines 152-190, `status: SaleStatus` enum `active`/`void`), `AuditLog` model (lines 192-214, `action: AuditAction` enum `create`/`update`/`void`). Phase 12 adds a new `VoidRequest` model; does not modify these enums (no new AuditAction value needed — Approve still writes the existing `void` action).
- `packages/frontend/src/layouts/AuthenticatedLayout.tsx` lines 11-19 — `ADMIN_NAV` array, the exact place to add a `{ to: '/void-requests', label: 'Void Requests' }` entry with the new red-badge count.
- `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` — confirm-dialog pattern to model the Approve confirmation (and optionally the moderator's reason-entry dialog) on, built on shared `Modal.tsx`.
- `packages/frontend/src/components/admin/AdminSalesTable.tsx` — closest existing pattern for the new Void Requests admin table (react-table v8, same sale-row columns, `formatDateTime` shared util from Phase 11).
- `packages/frontend/src/pages/SalesPage.tsx` / `packages/frontend/src/components/sales/SalesTable.tsx` — where the new "Void Request" button + tooltip is added to the moderator's per-row Actions, alongside existing inline-edit affordances.

### Prior art for transactional audit + RBAC patterns
- `.planning/phases/09-add-the-option-to-delete-mops-products-and-users-for-the-adm/09-CONTEXT.md` — precedent for introducing a new lifecycle status field distinct from existing ones, and for admin-only confirm-dialog + pessimistic-UI patterns.
- `.planning/phases/11-add-created-at-column-to-admin-and-moderator-sheets-with-hum/11-CONTEXT.md` — the shared `formatDateTime` util (`packages/frontend/src/lib/dateTime.ts`) now exists and should be reused for all new date columns in the Void Requests table, not reimplemented.

### Migration workflow precedent
- `.planning/STATE.md` §Key Decisions Locked — "Manual migration workflow (db execute + migrate resolve)" was required for Phase 5 and Phase 7 migrations due to sessions-table drift blocking `prisma migrate dev`. Check during planning whether this workaround is still needed for the new `VoidRequest` table migration.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VoidConfirmDialog.tsx` — direct template for the Approve confirm dialog (and possibly the moderator's reason-entry dialog), built on shared `Modal.tsx`.
- `formatDateTime` shared util (`packages/frontend/src/lib/dateTime.ts`, added Phase 11) — reuse for every date/time cell in the new Void Requests table.
- `AdminSalesTable.tsx` — direct structural template (react-table v8 columns, read-only rendering) for the new admin Void Requests table, extended with Reason + Status columns and row-level Approve/Reject actions.
- Direct-transaction pattern in `sales.ts` `/:id/void` — reuse for the Approve endpoint's transactional sale-status-update + AuditLog-write + VoidRequest-status-update.

### Established Patterns
- Admin-only routes: `requireRole('admin')` — either mounted at router level (like `receiversRouter`, `usersRouter`) or per-route (like the existing `/:id/void` and `/:id/audit` on `salesRouter`, since `salesRouter` is intentionally NOT admin-only at the router level). A new `voidRequestsRouter` likely needs mixed access (moderators can POST their own requests; only admins can GET-all/approve/reject) — closest precedent is `salesRouter`'s per-route `requireRole('admin')` pattern, not the fully-gated routers.
- Error handler reads `err.statusCode` + `err.code` for extensibility — follow for new error cases (e.g. `409 { code: 'DUPLICATE_PENDING_REQUEST' }` for D-02's enforcement).
- Sidebar nav badge: no existing precedent for a count badge in `AuthenticatedLayout.tsx` today — this will be new UI, likely a small `useQuery` for the pending count rendered next to the nav label.

### Integration Points
- `packages/backend/src/app.ts` — needs a new `voidRequestsRouter` mount (pattern: look at how `shiftsRouter`/`receiversRouter` are mounted).
- `packages/frontend/src/router/index.tsx` — needs a new admin-only `/void-requests` route (pattern: look at how `/receivers` or `/shifts` are guarded).
- `packages/frontend/src/layouts/AuthenticatedLayout.tsx` — `ADMIN_NAV` array (lines 11-19) gets the new nav entry + badge.
- `packages/shared` — needs a new `VoidRequest` TypeScript interface (pattern: look at how `Shift`/`Receiver` were added to shared types in Phases 5/7).

</code_context>

<specifics>
## Specific Ideas

- Button/action label is fixed by the user: **"Void Request"** — a button with a void-style action and a tooltip/hover description explaining what it does.
- Admin sidebar tab is fixed by the user: **"Void Requests"**.
- The pending-count badge must be a **red circle** next to the tab title, showing the count of unreviewed (pending) requests — user was explicit this should be easy for the admin to notice.
- Table on the Void Requests page should look "similar to sales" — i.e. reuse the existing sales-row column set — with one added column, "Reason", in plain text like the existing Notes column.
- On approval, the row is voided and reflects as voided on the moderator's own Sales sheet (existing strikethrough-voided-row treatment applies unchanged — no new moderator-side UI needed here beyond what already renders voided rows today).
- On rejection, "it should stay there as is" — i.e. the sale row and the moderator's view are completely unaffected; only the VoidRequest's own status changes (per D-06).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-moderator-void-requests*
*Context gathered: 2026-08-09*
