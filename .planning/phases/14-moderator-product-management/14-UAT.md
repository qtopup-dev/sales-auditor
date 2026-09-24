---
status: testing
phase: 14-moderator-product-management
source: [14-VERIFICATION.md]
started: 2026-09-24T05:40:00Z
updated: 2026-09-24T05:40:00Z
---

## Current Test

number: 1
name: Moderator sidebar and /products page parity
expected: |
  Logged in as a moderator, the sidebar shows Sales Sheet, Shift History, Products. /products renders the same page, buttons and actions an admin sees.
awaiting: user response

## Tests

### 1. Moderator sidebar and /products page parity
expected: Moderator sidebar shows Products third; /products looks and behaves identically to the admin view (create, edit, deactivate/activate, delete).
result: [pending]

### 2. Inline duplicate-name error in the product form
expected: Creating or renaming a product to an existing name (any case, surrounding spaces) shows an inline error under Product Name, and the modal stays open.
result: [pending]

### 3. CR-01 decision — server accepts negative/malformed prices
expected: Decide fix or accept. The API currently accepts "-5", "-0.01", "." and over-range prices (confirmed); negative prices would flow into sales price_snapshot. Moderators can now reach this endpoint.
result: [pending]

### 4. CR-02 / WR-01 decision — toggle flips server state; PATCH lacks race guard
expected: Decide fix or accept. A stale "Deactivate" click can re-activate a product another user just deactivated; PATCH /:id can edit a product deleted in between.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
