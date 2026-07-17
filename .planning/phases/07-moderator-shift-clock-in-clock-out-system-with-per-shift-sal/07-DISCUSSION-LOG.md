# Phase 7: Moderator Shift Clock In/Out - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal
**Areas discussed:** Shift ↔ Sales association, Clock in/out mechanics, Per-shift view & live totals, Shift history & admin visibility

---

## Shift ↔ Sales Association

| Option | Description | Selected |
|--------|-------------|----------|
| shiftId FK on Sale | Add a nullable shiftId column, set at creation from active shift | ✓ |
| Derive from time window | No schema change; match createdAt against clockInAt/clockOutAt range | |

**User's choice:** shiftId FK on Sale
**Notes:** Recommended option — matches existing snapshot/FK pattern (product/mop/receiver).

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, clocked-in required | Add Row disabled unless active shift exists | ✓ |
| No, sales work regardless | Clock state is a tracking overlay only | |

**User's choice:** Yes, clocked-in required

| Option | Description | Selected |
|--------|-------------|----------|
| Add Row only | Only creation gated; inline edits unrestricted | ✓ |
| Both add and edit | No sales interaction at all without active shift | |

**User's choice:** Add Row only

| Option | Description | Selected |
|--------|-------------|----------|
| Prominent clock-in prompt | Clear call-to-action replacing Add Row | |
| Add Row simply disabled/grayed | Button stays, disabled with tooltip | ✓ |

**User's choice:** Add Row simply disabled/grayed

| Option | Description | Selected |
|--------|-------------|----------|
| Nullable shiftId | Pre-Phase-7 rows get NULL; new rows always have one | ✓ |
| Backfill placeholder shift | Synthetic shift assigned to all historical rows | |

**User's choice:** Nullable shiftId

| Option | Description | Selected |
|--------|-------------|----------|
| Keep shiftId, exclude from totals | Voided rows stay tied to shift but don't count | ✓ |
| Keep shiftId, include in totals | Voided rows count toward gross totals | |

**User's choice:** Keep shiftId, exclude from totals
**Notes:** Consistent with Phase 6 KPI active-only semantics.

| Option | Description | Selected |
|--------|-------------|----------|
| Moderators only | Shifts are moderator-specific; admins don't clock in/out | ✓ |
| Both roles clock in/out | Admins also have shift tracking | |

**User's choice:** Moderators only

| Option | Description | Selected |
|--------|-------------|----------|
| Sale.shiftId is sufficient | No AuditLog schema change | ✓ |
| Add shift audit trail | Clock in/out becomes a fully audited action | |

**User's choice:** Sale.shiftId is sufficient

---

## Clock In/Out Mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| No — one active shift enforced | Backend rejects double clock-in | ✓ |
| Allow multiple opens | No backend enforcement | |

**User's choice:** No — one active shift enforced

| Option | Description | Selected |
|--------|-------------|----------|
| Sales Sheet page header | Button near existing Add Row area | |
| Persistent header bar across all pages | Shift status bar in AuthenticatedLayout | |
| *(free text)* | User specified custom placement | ✓ |

**User's choice:** "add the clock in/out control above the username and logout button on the nav bar for moderators"
**Notes:** Free-text answer, reflected back and confirmed — control placed in sidebar, above username/logout block, moderator-only.

| Option | Description | Selected |
|--------|-------------|----------|
| Stays open indefinitely | No auto-close on logout/session expiry | ✓ |
| Auto-close on logout | Logout automatically clocks out | |

**User's choice:** Stays open indefinitely

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, admin can force clock-out | Safety valve for stuck-open shifts | ✓ |
| No admin override in this phase | Deferred to later phase | |

**User's choice:** Yes, admin can force clock-out

| Option | Description | Selected |
|--------|-------------|----------|
| Static clock-in time | "Clocked in at 9:03 AM", no ticking timer | ✓ |
| Live elapsed timer | Ticking Xh Ym counter | |

**User's choice:** Static clock-in time

| Option | Description | Selected |
|--------|-------------|----------|
| Single click, no confirmation | Low-friction clock in/out | |
| Confirm dialog on clock-out | VoidConfirmDialog-style checkpoint | ✓ |

**User's choice:** Confirm dialog on clock-out

---

## Per-Shift View & Live Totals

| Option | Description | Selected |
|--------|-------------|----------|
| Current shift only | Sales Sheet resets to show only active-shift rows | ✓ |
| All rows, shift-filterable | Sheet keeps showing everything with a filter toggle | |

**User's choice:** Current shift only

| Option | Description | Selected |
|--------|-------------|----------|
| Count + revenue | Mirrors Transactions + Profit KPI semantics | ✓ |
| Count only | No revenue figure shown | |

**User's choice:** Count + revenue

| Option | Description | Selected |
|--------|-------------|----------|
| Empty state prompting clock-in | No rows shown when not clocked in | ✓ |
| Shows their most recent completed shift | Read-only view of last shift persists | |

**User's choice:** Empty state prompting clock-in

| Option | Description | Selected |
|--------|-------------|----------|
| Banner above the table | Stats banner between header and table | ✓ |
| Inline in the page header row | Compact, next to page title | |

**User's choice:** Banner above the table

| Option | Description | Selected |
|--------|-------------|----------|
| Refetch on mutation only | Single-writer scenario, no polling needed | ✓ |
| Add interval polling too | Poll in case shift state changes elsewhere | |

**User's choice:** Refetch on mutation only

---

## Shift History & Admin Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| New nav item | "Shift History" added to MODERATOR_NAV | ✓ |
| Tab within Sales Sheet page | Internal tab switcher on SalesPage | |

**User's choice:** New nav item

| Option | Description | Selected |
|--------|-------------|----------|
| Date, duration, count, revenue | Full breakdown per historical shift | ✓ |
| Minimal: just date + duration | No sales breakdown in the list | |

**User's choice:** Date, duration, count, revenue

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — admin shift oversight view | Needed to support force-close | ✓ (initially) |
| Defer to a later phase | Only minimal/ad-hoc entry point for force-close | selected, then superseded |

**User's choice:** Initially "Defer to a later phase" for full oversight, then reconciled — see below.

**Reconciliation:** User flagged conflict between "admin force-close in scope" and "full oversight deferred." Options offered:

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal force-close entry point | Bare list, just enough for force-close | ✓ (initially) |
| Drop force-close from this phase too | Walk back admin override entirely | |

**User's choice:** Minimal force-close entry point (initially) — then substantially expanded via free-text redirection (see below).

**User's free-text redirection:**
> "let's talk about the admin visibility now. create a new nav item called 'shifts' and it should contain ALL active sheets from all active moderators. all moderator usernames will appear on sheet tabs at the top of the table (sheet if you will) this will act as an excel sheet tab. this page will only show all sheets within the same shift (for example, july 18 shift) regardless of the time because all moderators will be covering a whole day with their shifts"

This superseded the "minimal force-close list" plan with a full tabbed admin Shifts page (D-15 in CONTEXT.md). Follow-up questions clarified the shape:

| Option | Description | Selected |
|--------|-------------|----------|
| Date selector, defaults to today | Browse any past day | ✓ |
| Today only, no date browsing | No historical browsing | |

**User's choice:** Date selector, defaults to today

| Option | Description | Selected |
|--------|-------------|----------|
| One combined sheet per moderator per day | Multiple clock sessions same day merge into one tab | ✓ |
| Separate entry per clock session | Multiple tabs if clocked in/out more than once | |

**User's choice:** One combined sheet per moderator per day

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same count + revenue totals | Mirrors moderator's own banner | ✓ |
| Just the row list, no totals | No aggregate shown per tab | |

**User's choice:** Yes, same count + revenue totals

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — Clock Out button on the active tab | Force-close folded directly into this page | ✓ |
| Keep it separate | Independent minimal list | |

**User's choice:** Yes — Clock Out button on the active tab

| Option | Description | Selected |
|--------|-------------|----------|
| Interval polling while on this page | 30-60s refresh for other moderators' live activity | ✓ |
| Manual refresh only | No auto-polling | |

**User's choice:** Interval polling while on this page

| Option | Description | Selected |
|--------|-------------|----------|
| Only moderators who worked that day | Tabs generated from shift records | ✓ |
| All moderators always shown | Empty tabs for non-working moderators | |

**User's choice:** Only moderators who worked that day

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only view | No Void/Audit buttons on this page | ✓ |
| Same as DashboardPage admin table | Audit/Void buttons per row | |

**User's choice:** Read-only view

| Option | Description | Selected |
|--------|-------------|----------|
| Same as moderator's own sheet | Product, Price, MOP, Receiver, Notes, Date Edited, Status | ✓ |
| Full admin columns | Adds Created By, Created At, Last Edited By | |

**User's choice:** Same as moderator's own sheet

---

## Claude's Discretion

- Exact banner/tab visual styling details beyond matching StatCard/existing patterns
- Exact backend route shapes for shiftsRouter
- Date selector UI (native input, calendar picker, or prev/next arrows)
- Exact polling interval within 30-60s
- Whether ShiftHistoryPage uses @tanstack/react-table or a simpler list

## Deferred Ideas

- Admin editing/voiding rows directly from AdminShiftsPage — use existing DashboardPage/SalesPage instead
- Charts/analytics comparing moderators' shift performance
- Shift-based audit trail (clock in/out/force-close as audited events)
- Auto-closing shifts on logout/session expiry
