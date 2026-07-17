---
status: partial
phase: 07-moderator-shift-clock-in-clock-out-system-with-per-shift-sal
source: [07-VERIFICATION.md]
started: 2026-07-18T00:00:00Z
updated: 2026-07-18T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Excel-style tab bar visual/interaction feel
expected: Tabs visually resemble Excel sheet tabs (per D-15/UI-SPEC intent) and switching tabs swaps the visible sheet below without a full page reload or flash.
result: [pending]

### 2. End-to-end clock-in -> sales entry -> clock-out flow
expected: Banner updates immediately after Add Row; sheet resets to "Clock in to start a shift" after clock-out with no stale rows visible.
result: [pending]

### 3. Force Clock Out on a real open shift, confirm both sides update
expected: Moderator's ClockControl (on their own session) reflects clocked-out state; admin's tab loses the Force Clock Out button; no sales rows are altered.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
