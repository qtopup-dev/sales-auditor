# Phase 12: Moderator Void Requests - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-09
**Phase:** 12-moderator-void-requests
**Areas discussed:** Request scope, Review outcome, Moderator feedback, Badge refresh

---

## Request Scope — which rows can a moderator submit a Void Request on, and what stops duplicates

| Option | Description | Selected |
|--------|-------------|----------|
| Own active rows only, one pending request per row | Mirrors existing edit-rights scoping; only active rows eligible; button disabled/hidden while a pending request exists on that row | ✓ |
| Any visible active row, no duplicate limit | No ownership restriction, no limit on concurrent pending requests per row | |
| You decide | Claude picks based on codebase conventions | |

**User's choice:** Own active rows only, one pending request per row (recommended).
**Notes:** Backend must enforce both the ownership check and the one-pending-per-row rule, not just the frontend.

---

## Review Outcome — what happens to a request after admin approves/rejects it

| Option | Description | Selected |
|--------|-------------|----------|
| Reviewed requests stay listed with a status badge | Table shows all requests newest-first with Pending/Approved/Rejected status; mirrors voided-rows-stay-visible pattern; red badge counts Pending only | ✓ |
| Reviewed requests disappear from the page | Only pending requests ever shown; approved/rejected vanish from the view | |
| You decide | Claude picks based on codebase conventions | |

**User's choice:** Reviewed requests stay listed with a status badge (recommended).

---

## Moderator Feedback — does the moderator see the outcome, and can they resubmit after rejection

| Option | Description | Selected |
|--------|-------------|----------|
| No visible outcome; resubmission allowed after rejection | No special indicator on the moderator's sheet either way; a rejected row becomes eligible for a new request | ✓ |
| No visible outcome; no resubmission allowed | Once rejected, that row is permanently locked out from further requests | |
| You decide | Claude picks based on codebase conventions | |

**User's choice:** No visible outcome; resubmission allowed after rejection (recommended).

---

## Badge Refresh — how the red pending-count badge stays current

| Option | Description | Selected |
|--------|-------------|----------|
| Refetch on navigation + React Query default staleness | Matches existing app conventions (no websockets/polling anywhere today) | ✓ |
| Short-interval polling (e.g. every 15-30s) | Adds a dedicated polling interval for the badge | |
| You decide | Claude picks based on codebase conventions | |

**User's choice:** Refetch on navigation + React Query default staleness (recommended).

---

## Claude's Discretion

- Exact `VoidRequest` schema shape (own table vs. reusing `AuditLog`) — dedicated model recommended.
- Exact tooltip/confirm-copy wording (button label itself is fixed: "Void Request").
- Reason entry as inline input vs. small modal — likely a new dialog modeled on `VoidConfirmDialog.tsx`.
- Whether Approve/Reject need their own confirm dialogs (Approve recommended to have one, given it's irreversible; Reject can be instant).
- Exact HTTP route/verb naming for the new endpoints.
- Whether the manual `db execute` + `migrate resolve` migration workaround (used in Phases 5/7) is still needed for the new table.

## Deferred Ideas

None — discussion stayed within phase scope.
