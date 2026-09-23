# Phase 13: Moderator Sales Sheet Tip Column - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 13-moderator-sales-sheet-tip-column
**Areas discussed:** Where tips count, Entry & editing, Value rules, Admin visibility

---

## Where Tips Count

| Option | Description | Selected |
|--------|-------------|----------|
| Every revenue figure | Banner, shift history, dashboard Total Revenue, Profit/Turnover KPIs = price + tip | ✓ |
| Moderator's own totals only | Admin dashboard stays price-only | |
| Separate 'Tips' figure | Revenue stays price-only; tips shown separately | |

**Product breakdown chart:** Keep it price-only ✓ (vs. include row's tip / you decide)

**Banner tips display:** Total plus a tips line ✓ (vs. combined total only / separate tips card)

**Dashboard Total Revenue caption:** Yes, show the tips share ✓ (vs. combined number only)

**Captions on KPIs / Shift History column:** No, only banner + Total Revenue ✓ (vs. everywhere)

**Notes:** The user paused once to clarify, then went ahead with the same questions.

---

## Entry & Editing

| Option | Description | Selected |
|--------|-------------|----------|
| Add Row field + inline edit | Optional Add Row input, editable later like Notes, audit-logged | ✓ |
| Inline edit only | No Add Row field | |
| Add Row only | Not editable after creation | |

**Clearing:** Yes, blank clears it ✓ (vs. only change it)
**Who edits:** Same rules as other cells ✓ (vs. admin only after creation)
**Position:** Right after Price ✓ (vs. after Receiver, before Notes)

---

## Value Rules

| Question | Selected | Alternatives |
|----------|----------|--------------|
| Zero | Treat 0 as blank | Reject 0; Allow 0.00 |
| Precision | Up to 2 decimals (reject more) | Whole pesos only |
| Max | Only the DECIMAL(10,2) ceiling | Business cap |
| Errors | Block input + inline error (backend 400 regardless) | Inline error only |

---

## Admin Visibility

**Where Tip appears (multi-select):** Admin sales table ✓, CSV export ✓, Admin Shifts page sale list ✓, Void Requests table ✓
**Blank display:** Empty cell ✓ (vs. dash / 0.00)

---

## Claude's Discretion

- Field/prop names for the tips sub-total and how the banner renders it
- Decimal-safe summing approach (aggregate vs raw SQL)
- Location of the tip validation helper
- Migration mechanics and inline error copy

## Deferred Ideas

None.
