---
status: partial
phase: 03-sales-core
source: [03-VERIFICATION.md]
started: 2026-06-23T00:00:00Z
updated: 2026-06-23T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Add Row end-to-end
expected: Click "Add Row" → product AsyncSelect searchable, selecting product auto-populates and locks price, MOP selectable, receiver text input, Save Row saves row → row appears at top of table without page reload; React Query cache invalidation handles refresh automatically
result: [pending]

### 2. Inline cell edit on blur
expected: Click any editable cell on own row (when edit rights on) → cell switches to input in-place; blur fires PATCH; cell shows spinner/disabled state during round-trip; "Date Edited" column updates to current timestamp after successful save; Escape discards draft
result: [pending]

### 3. Void confirmation flow
expected: Admin sees "Void" button per row; clicks it → modal with "Void Row" + "Cancel"; both buttons disabled during in-flight; after void row shows strikethrough style and bg-red-50; moderator attempting void gets 403 error
result: [pending]

### 4. Audit drawer
expected: Admin sees "Audit" button per row; clicks it → 400px right slide-in shows audit entries newest-first with timestamp + username + action + field changes; Escape key / overlay click / X button all close it; moderator does not see Audit button
result: [pending]

### 5. Virtual scroll performance
expected: Load 200+ rows in browser; scrolling is smooth without jank; clicking a Notes cell and typing multi-line text causes that row's height to expand (measureElement via ResizeObserver) without overlapping adjacent rows
result: [pending]

### 6. Inactive catalog filtering
expected: Deactivate a product or MOP via DB/admin; open Add Row combo — deactivated item absent from list; existing sale rows that used the deactivated item still show their snapshotted name (productNameSnapshot / mopNameSnapshot)
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
