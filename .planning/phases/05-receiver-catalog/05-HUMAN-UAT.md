---
status: partial
phase: 05-receiver-catalog
source: [05-VERIFICATION.md]
started: 2026-06-26T00:00:00.000Z
updated: 2026-06-26T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Receiver AsyncSelect renders dropdown
expected: Open Add Row form, click Receiver field — searchable dropdown loads receiver names from /api/catalog/receivers
result: [pending]

### 2. Inline edit receiver cell
expected: Click a receiver cell in SalesTable — AsyncSelect combobox opens, selecting fires PATCH with field='receiverId'
result: [pending]

### 3. ReceiverModal create flow
expected: Submit empty name → validation error shown. Submit with name → receiver appears in list immediately
result: [pending]

### 4. ReceiverModal edit flow
expected: Click Edit on a receiver row → modal opens pre-filled with current name and accountNumber values
result: [pending]

### 5. Toggle active/inactive + combobox filtering
expected: Deactivate a receiver via toggle → receiver no longer appears in Add Row combobox options (backend isActive filter exercised)
result: [pending]

### 6. CSV export Receiver column
expected: Export CSV from Admin Dashboard — "Receiver" column populated with receiver name snapshots (not empty/undefined)
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
