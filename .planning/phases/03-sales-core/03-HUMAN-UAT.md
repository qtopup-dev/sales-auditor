---
status: partial
phase: 03-sales-core
source: [03-VERIFICATION.md]
started: 2026-06-23T00:00:00Z
updated: 2026-06-25T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Add Row end-to-end (architectural fix applied — pending re-test)
expected: Click "Add Row" with 200+ rows → form renders immediately without freeze; product AsyncSelect searchable, selecting product auto-populates and locks price, MOP selectable, receiver text input, Save Row saves row → row appears at top of table without page reload
result: pending
note: Plan 03-08 applied architectural fix (AddRowForm moved outside virtualizer; virtualizer count now stable at sales.length). Requires live browser re-test to confirm zero-hang.

### 2. Inline cell edit on blur
expected: Click any editable cell on own row (when edit rights on) → cell switches to input in-place; blur fires PATCH; cell shows spinner/disabled state during round-trip; "Date Edited" column updates to current timestamp after successful save; Escape discards draft
result: skipped
reason: cannot test at this time

### 3. Void confirmation flow
expected: Admin sees "Void" button per row; clicks it → modal with "Void Row" + "Cancel"; both buttons disabled during in-flight; after void row shows strikethrough style and bg-red-50; moderator attempting void gets 403 error
result: pass

### 4. Audit drawer
expected: Admin sees "Audit" button per row; clicks it → 400px right slide-in shows audit entries newest-first with timestamp + username + action + field changes; Escape key / overlay click / X button all close it; moderator does not see Audit button
result: [pending]

### 5. Virtual scroll performance
expected: Load 200+ rows in browser; scrolling is smooth without jank; clicking a Notes cell and typing multi-line text causes that row's height to expand (measureElement via ResizeObserver) without overlapping adjacent rows
result: pass

### 6. Inactive catalog filtering
expected: Deactivate a product or MOP via DB/admin; open Add Row combo — deactivated item absent from list; existing sale rows that used the deactivated item still show their snapshotted name (productNameSnapshot / mopNameSnapshot)
result: pass

## Summary

total: 6
passed: 3
issues: 0
pending: 2
skipped: 1
blocked: 0

## Gaps

- truth: "Click Add Row → form renders, product AsyncSelect searchable, save creates row at top of table"
  status: resolved
  fix: "Plan 03-08 (commit c142324): AddRowForm moved outside virtualizer as static <tr> in <tbody> before paddingTop spacer. Virtualizer count is now permanently tableRows.length (sales.length) — stable regardless of isAddRowOpen state. TableRow union type, isNewRowGuard, and isNewRow:true sentinel removed."
  pending_human_retest: true
  test: 1
