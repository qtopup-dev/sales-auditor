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
result: issue
reported: "the whole website hangs when clicking add row"
severity: blocker

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
passed: 4
issues: 1
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "Click Add Row → form renders, product AsyncSelect searchable, save creates row at top of table"
  status: failed
  reason: "User reported: the whole website hangs when clicking add row"
  severity: blocker
  test: 1
  root_cause: "AddRowForm is prepended at index 0 inside the virtualizer, shifting all 200+ existing row indices by 1. This forces @tanstack/react-virtual to remap its entire size cache and re-measure visible rows synchronously via getBoundingClientRect(), while React Table simultaneously regenerates the full row model for 201 items — blocking the main thread long enough to freeze the browser."
  artifacts:
    - path: packages/frontend/src/components/sales/SalesTable.tsx
      issue: "rows = [{ isNewRow: true }, ...sales] prepends inside the virtualizer; all indices shift causing full size-cache remap + measurement cascade"
    - path: packages/frontend/src/components/sales/AddRowForm.tsx
      issue: "AddRowForm is rendered as a virtualized row; its taller height (textarea rows=2) triggers ResizeObserver cascade on mount"
  missing:
    - "Render AddRowForm outside the virtualizer (as a non-virtualized sticky row between <thead> and the virtual scroll area) so virtualizer index count and size cache are unaffected when Add Row opens"
  debug_session: ""
