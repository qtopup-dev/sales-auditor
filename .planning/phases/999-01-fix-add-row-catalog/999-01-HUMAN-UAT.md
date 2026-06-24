---
status: partial
phase: 999-01-fix-add-row-catalog
source: [999-01-VERIFICATION.md]
started: 2026-06-24T00:00:00Z
updated: 2026-06-24T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Moderator product dropdown — Add Row form
expected: Dropdown opens immediately with active products. No 403. No blank dropdown.
result: [pending]

### 2. Moderator MOP dropdown — Add Row form
expected: MOP dropdown opens immediately with active MOPs. No 403. No blank.
result: [pending]

### 3. Moderator product dropdown — EditableCell inline edit
expected: AsyncSelect opens immediately with product options from cache. No network call on click.
result: [pending]

### 4. Moderator MOP dropdown — EditableCell inline edit
expected: AsyncSelect opens immediately with MOP options. No network call on click.
result: [pending]

### 5. Network tab — catalog called once on mount, not per dropdown
expected: One GET /catalog/products and one GET /catalog/mops on page load. Zero /api/products or /api/mops calls from frontend.
result: [pending]

### 6. Admin — no lag after void
expected: After voiding a row, Add Row product/MOP dropdowns load instantly (no refetch storm).
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
