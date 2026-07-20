# Phase 9: Add the option to delete MOPs, Products, and Users for the admin role - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 09-add-the-option-to-delete-mops-products-and-users-for-the-adm
**Areas discussed:** Delete meaning vs existing Deactivate, Delete mechanism (schema), Confirmation flow, User deletion safeguards, Restore & list visibility, UI placement & wording

---

## Delete meaning (vs existing Deactivate toggle)

| Option | Description | Selected |
|--------|-------------|----------|
| Same as existing toggle, unified language | Delete is a rename/reskin of the existing Deactivate action for Products/MOPs; build the same isActive=false capability from scratch for Users | |
| New, stricter action distinct from Deactivate | Keep existing Deactivate as-is; add a separate, more final Delete action on top | ✓ |

**User's choice:** New, stricter action distinct from Deactivate.
**Notes:** This surfaced a follow-up architectural question — since the codebase's only soft-delete signal for these entities is `isActive`, making Delete genuinely distinct required a mechanism decision (see next entry).

---

## Delete mechanism (schema)

| Option | Description | Selected |
|--------|-------------|----------|
| Same field, different default visibility | Delete and Deactivate both set isActive=false; difference is purely default table visibility + confirm dialog | |
| New dedicated field per entity | Add a separate `deletedAt` timestamp field alongside `isActive` on Product, Mop, User | ✓ |

**User's choice:** New dedicated field per entity.
**Notes:** Flagged to the user that CLAUDE.md Rule 3 literally specifies `is_active BOOLEAN` as the soft-delete mechanism for these entities, with no separate deleted state. User's choice extends Rule 3 with a second field; this is recorded as a deliberate, approved extension in CONTEXT.md (see D-01 note) so downstream agents don't flag it as a Rule 3 violation.

---

## Confirmation flow

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, for all three entities | Standard confirm dialog (VoidConfirmDialog pattern) on Product/MOP/User delete; Deactivate stays instant | ✓ |
| Yes, but User delete gets extra warning text | Same dialog, plus extra warning copy specific to deleting a user | |

**User's choice:** Yes, for all three entities (standard treatment, no extra User-specific copy).

---

## Deletion safeguards (User-specific)

| Option | Description | Selected |
|--------|-------------|----------|
| Block self-delete | Admin cannot delete their own account | ✓ |
| Block deleting the last admin | Cannot delete the only remaining admin | ✓ |
| Immediate session kill + login block | Deleting a user kills their sessions and blocks future login | ✓ |

**User's choice:** All three (multiSelect — all selected).

---

## Restore & list visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden by default, restorable via filter | "Show deleted" filter reveals deleted rows with a Restore action | |
| Hidden by default, no restore (permanent-feeling) | Deleted rows vanish from the UI entirely; no restore action; data preserved in DB only | ✓ |

**User's choice:** Hidden by default, no restore.

---

## UI placement & wording

| Option | Description | Selected |
|--------|-------------|----------|
| "Delete" button, red/danger styling, same row | Actions column: Edit \| Activate/Deactivate \| Delete, visually distinct styling | ✓ |
| Delete tucked into a row overflow menu | Delete moved into a "⋯" overflow menu to reduce visual weight | |

**User's choice:** Red/danger "Delete" button directly in the Actions row.

---

## Deleted UX detail (audit visibility)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — read-only "Show deleted" filter for all three | Deleted rows visible read-only for audit purposes, styled like voided sales rows | |
| No — deleted items are fully gone from the UI | No admin-facing view of deleted items at all; data preserved in DB only | ✓ |

**User's choice:** No — deleted items are fully gone from the UI (consistent with the earlier "no restore" decision).

---

## Claude's Discretion

- Exact confirm-dialog copy per entity
- Exact HTTP verb/route naming for the three delete endpoints
- Exact error codes/messages for self-delete and last-admin blocks
- Whether the three routes share a soft-delete helper or implement independently
- Whether the manual migration workaround (db execute + migrate resolve) is still needed

## Deferred Ideas

None — discussion stayed within phase scope.
