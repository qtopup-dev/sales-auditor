---
status: complete
phase: 13-moderator-sales-sheet-tip-column
source: [13-VERIFICATION.md]
started: 2026-09-23T04:35:00Z
updated: 2026-09-23T05:00:00Z
---

## Current Test

number: 1
name: Moderator sheet tip entry, validation, and empty-cell rendering
expected: |
  Only digits and '.' can be typed (a typed '-' or letter never appears). Save stays disabled while the Add Row tip is invalid, with red inline error text under the input. On the inline cell, blurring with an invalid value discards it; blurring with '0'/'0.00' saves an empty cell. Rows with no tip show a fully empty cell (no em dash), unlike Notes.
awaiting: none — all tests passed

## Tests

### 1. Moderator sheet tip entry, validation, and empty-cell rendering
expected: Only digits and '.' can be typed (a typed '-' or letter never appears). Save stays disabled while the Add Row tip is invalid, with red inline error text under the input. On the inline cell, blurring with an invalid value discards it; blurring with '0'/'0.00' saves an empty cell. Rows with no tip show a fully empty cell (no em dash), unlike Notes.
result: pass

### 2. Moderator sheet column order and alignment
expected: Columns read Product | Price | Tip | Mode of Payment | ... The Tip header, cells, and Add Row input are right-aligned exactly like Price.
result: pass

### 3. "incl. ₱X tips" captions (shift banner, admin Shifts tab, dashboard)
expected: The Revenue This Shift banner shows the combined price+tip total with a smaller "incl. ₱X tips" line under it, hidden when the shift's tips are 0.00. The admin Shifts tab behaves the same. The Dashboard Total Revenue card shows the same caption. The Profit/Turnover cards and the Shift History Revenue column show the combined number only, with no caption.
result: pass

### 4. Admin Dashboard sales table Tip column + CSV
expected: The Tip column is right after Price, right-aligned, editable with the same click-to-edit flow as the other editable cells, and empty (no dash) when there is no tip. The CSV has a Tip column right after Price, blank when there is no tip.
result: pass

### 5. Admin Void Requests table Tip column
expected: A right-aligned, display-only (not clickable) Tip column right after Price, empty when the sale had no tip.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
