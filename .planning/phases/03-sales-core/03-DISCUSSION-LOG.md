# Phase 3: Sales Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 03-sales-core
**Mode:** --auto (all decisions auto-selected at recommended defaults)
**Areas discussed:** SALES-03 Dynamic Heights, Add Row UX, Inline Edit Model, PATCH Granularity, Void Flow, Audit Drawer Scope

---

## SALES-03: Notes Field / Dynamic Row Heights

| Option | Description | Selected |
|--------|-------------|----------|
| True dynamic heights | `@tanstack/react-virtual` v3 `measureElement` — each row's DOM node measured at render; heights update after edits | ✓ |
| CSS truncation + tooltip | Notes capped at N lines; full text shown on hover; simpler implementation | |

**Auto-selected:** True dynamic heights via `measureElement`
**Notes:** SALES-03 and SALES-12 explicitly require dynamic row heights. Phase 3 success criterion notes that CSS truncation "must be confirmed acceptable before phase closes" — dynamic heights is the pre-confirmed compliant choice. This was a "Confirm with user" TODO in STATE.md; auto-resolved by selecting the requirements-compliant option.

---

## Add Row UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline row at top of virtual list | New row appears as first item in virtual list; has input fields; Save/Cancel buttons | ✓ |
| Modal form | Separate modal overlay for entering new sale; consistent with Phase 2 catalog pattern | |
| Fixed sticky form above table | Non-scrolling header area above the virtual scroll container | |

**Auto-selected:** Inline row at top of virtual list
**Notes:** SALES-04 specifies "append a blank input row at the TOP of the sheet" — modal is incompatible with this. Inline row at top matches the spreadsheet metaphor. Explicit Save/Cancel buttons used (not blur-auto-save) because the row is empty and has unmet required fields on first render. SALES-06 blur-save applies only to edits on existing rows.

---

## Inline Edit Model (Existing Rows)

| Option | Description | Selected |
|--------|-------------|----------|
| Single-cell focus (one cell across whole table) | One cell in edit mode at a time; blur triggers immediate save; Zustand tracks `{ saleId, field, draftValue }` | ✓ |
| Row-level edit mode | Clicking any cell puts entire row into edit mode; explicit Save per row | |
| Multi-cell concurrent | Multiple cells can be edited simultaneously with deferred save | |

**Auto-selected:** Single-cell focus model
**Notes:** SALES-05 says "click any editable cell to edit it inline" and SALES-06 says "cell saves on blur" — these requirements point to single-cell. Row-level would work but adds complexity. Multi-cell concurrent risks race conditions on rapid consecutive saves. Single-cell is simplest and safest.

---

## PATCH Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Field-level PATCH | `PATCH /api/sales/:id { field, value }` — one call per cell blur; one audit record per field change | ✓ |
| Full-row PATCH | Send entire row on save; backend diffs to find changed fields | |

**Auto-selected:** Field-level PATCH
**Notes:** Matches AuditLog schema perfectly (fieldName, oldValue, newValue per entry). One Prisma transaction per PATCH: read old value → write new + audit record. Simple to implement and reason about.

---

## Void Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Actions column button + confirmation dialog | "Void" button in rightmost column (admin only); confirmation dialog before executing | ✓ |
| Right-click context menu | Right-click row shows "Void" option | |

**Auto-selected:** Actions column + confirmation dialog
**Notes:** Consistent with Phase 2 pattern (ProductsPage has actions column with Deactivate button). Confirmation dialog prevents accidental void. Admin-only per ROLES-06.

---

## Audit Log Drawer Scope (AUDIT-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Implement in Phase 3 | Audit drawer in actions column (admin only); GET /api/sales/:id/audit; read-only entries list | ✓ |
| Defer to Phase 4 | Phase 4 already has ADMIN-12 (audit drawer); avoid overlap | |

**Auto-selected:** Implement in Phase 3
**Notes:** AUDIT-03 is explicitly in Phase 3 requirements list. Deferring would leave a requirement unmet at phase close. ADMIN-12 in Phase 4 may extend or reuse the same component.

---

## Claude's Discretion

- Zustand edit-mode store file name and exact structure
- Save indicator visual (spinner, border color change, dimmed cell)
- Column widths for sales table
- Audit drawer animation (slide vs instant)
- Whether void confirmation is `window.confirm()` or a custom UI
- Skeleton vs text loading state for sales list

## Deferred Ideas

- Keyboard tab-navigation (v2 requirement)
- Global audit log (v2)
- Filter/search in moderator sales sheet (Phase 4 only)
- Server-sent events for live row updates (v2)
