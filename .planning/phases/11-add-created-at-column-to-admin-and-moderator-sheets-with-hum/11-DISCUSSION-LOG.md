# Phase 11: Add "Created At" column to admin and moderator sheets with humanized date format - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-29
**Phase:** 11-add-created-at-column-to-admin-and-moderator-sheets-with-hum
**Areas discussed:** Time-of-day precision, Scope of consistency, Timezone display, Moderator column placement

---

## Time-of-day precision

| Option | Description | Selected |
|--------|-------------|----------|
| Date + time (Recommended) | e.g. "July 29, 2026, 2:32 PM" — preserves precision needed for audit trail / edit history, while still using the humanized month name. | ✓ |
| Date only | e.g. "July 29, 2026" everywhere, including audit log entries — simpler but loses time-of-day precision for audit/edit tracking. | |

**User's choice:** Date + time (Recommended)
**Notes:** Preserves audit/edit-history precision while adopting the humanized month name.

---

## Scope of consistency

| Option | Description | Selected |
|--------|-------------|----------|
| Sales scope only (Recommended) | Only touch: moderator + admin Sales sheets (Created At, Date Edited columns) and the Audit Drawer. Matches the phase description exactly — other pages stay as a separate future phase. | ✓ |
| App-wide | Also reformat Shift History table, Users page, and Admin Shifts page dates to the same humanized format — broader consistency now, larger phase scope. | |

**User's choice:** Sales scope only (Recommended)
**Notes:** Shift History, Users page, and Admin Shifts page are explicitly out of scope for this phase — recorded as a deferred idea.

---

## Timezone display

| Option | Description | Selected |
|--------|-------------|----------|
| Keep UTC, drop label (Recommended) | Show "July 29, 2026, 2:32 PM" without a "UTC" suffix — cleaner, matches how the rest of the sheet already displays timestamps without a timezone tag. Internally still UTC (CLAUDE.md Rule 7). | ✓ |
| Keep UTC, keep label | Show "July 29, 2026, 2:32 PM UTC" — preserves the current explicit UTC labeling in the audit drawer for clarity. | |
| Convert to local time | Display times converted to the viewer's browser timezone — more intuitive for users outside UTC, but diverges from stored UTC value and needs a per-viewer conversion layer. | |

**User's choice:** Keep UTC, drop label (Recommended)
**Notes:** Storage/connection timezone remains UTC (CLAUDE.md Rule 7 unaffected) — only the UI-facing "UTC" suffix is dropped.

---

## Moderator column placement

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror admin order (Recommended) | Insert Created At right before "Date Edited" (after Notes), matching the admin table's layout: ...Notes, Created At, Date Edited, Actions. Consistent muscle memory across both sheets. | ✓ |
| Different placement | Let me specify a different position for the moderator sheet. | |

**User's choice:** Mirror admin order (Recommended)
**Notes:** None.

---

## Claude's Discretion

- 12-hour vs 24-hour clock formatting
- Whether to introduce a single shared date-formatting utility vs. updating each file's local formatter in place
- Whether CSV export date columns get humanized too, or stay raw ISO

## Deferred Ideas

- App-wide date format consistency (Shift History, Users page, Admin Shifts page) — noted for a future phase
