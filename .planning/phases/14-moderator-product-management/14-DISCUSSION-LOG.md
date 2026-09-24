# Phase 14: Moderator Product Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-09-24
**Phase:** 14-moderator-product-management
**Areas discussed:** Scope of moderator access, Edit-rights & shift gating, Who-changed-what trail, Sidebar placement, Catalog freshness, Duplicate names

---

## Scope of moderator access

| Option | Description | Selected |
|--------|-------------|----------|
| Full parity | Create, edit, toggle, delete (soft) | ✓ |
| All except delete | Delete stays admin-only | |

| Option | Description | Selected |
|--------|-------------|----------|
| Identical page | Reuse ProductsPage/ProductModal unchanged | ✓ |
| Hide inactive products | Role branch in query and UI | |

| Option | Description | Selected |
|--------|-------------|----------|
| Products only | MOPs/receivers stay admin-only | ✓ |
| Open MOPs/receivers too | Deferred to its own phase | |

## Edit-rights & shift gating

| Option | Description | Selected |
|--------|-------------|----------|
| No, any moderator | canEdit stays sales-only | ✓ |
| Yes, canEdit required | DB check on every product mutation | |

| Option | Description | Selected |
|--------|-------------|----------|
| No shift required | Same as admins | ✓ |
| Must be clocked in | NO_ACTIVE_SHIFT on mutations | |

## Who-changed-what trail

| Option | Description | Selected |
|--------|-------------|----------|
| Record, no viewer yet | audit_log rows in same tx, no UI | ✓ |
| Record + show on /products | Adds a history UI | |
| No trail | Today's behavior | |

| Option | Description | Selected |
|--------|-------------|----------|
| Everyone | Log admin + moderator changes | ✓ |
| Moderators only | Role branch | |

## Sidebar placement

| Option | Description | Selected |
|--------|-------------|----------|
| After Shift History | Sales Sheet → Shift History → Products | ✓ |
| After Sales Sheet | Sales Sheet → Products → Shift History | |

| Option | Description | Selected |
|--------|-------------|----------|
| 'Products' | Same as admin | ✓ |
| 'Manage Products' | Moderator-only label | |

## Catalog freshness

| Option | Description | Selected |
|--------|-------------|----------|
| Same tab: instant | Also invalidate catalog-products | ✓ |
| Leave as-is | Up to 5-minute stale dropdown | |

## Duplicate names

| Option | Description | Selected |
|--------|-------------|----------|
| Allow, as today | No change | |
| Block among non-deleted | 409 + inline error, case-insensitive | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Active + inactive count | Only deleted frees a name | ✓ |
| Active only | Reactivation needs its own check | |

## Claude's Discretion

- How RBAC is widened (requireRole multi-role vs. a separate guard), the frontend guard shape, the AuditAction mapping for toggle/delete, the audit helper vs. inline writes, the error copy, and cleanup of stale comments.

## Deferred Ideas

- Product change-history viewer UI
- MOP/receiver management for moderators
