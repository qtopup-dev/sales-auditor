---
status: complete
phase: 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal
source: [07-VERIFICATION.md]
started: 2026-07-18T00:00:00Z
updated: 2026-07-18T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Excel-style tab bar visual/interaction feel
expected: Tabs visually resemble Excel sheet tabs (per D-15/UI-SPEC intent) and switching tabs swaps the visible sheet below without a full page reload or flash.
result: pass

### 2. End-to-end clock-in -> sales entry -> clock-out flow
expected: Banner updates immediately after Add Row; sheet resets to "Clock in to start a shift" after clock-out with no stale rows visible.
result: pass
note: Surfaced a real bug during testing — clock-in time displayed in raw UTC instead of PH local time (8-hour offset). Fixed in commit 00330ef (lib/shiftTime.ts + ClockControl/ShiftHistoryTable/AdminShiftsPage). Re-tested and confirmed correct after fix.

### 3. Force Clock Out on a real open shift, confirm both sides update
expected: Moderator's ClockControl (on their own session) reflects clocked-out state; admin's tab loses the Force Clock Out button; no sales rows are altered.
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
