---
status: partial
phase: 04-admin-dashboard
source: [04-VERIFICATION.md]
started: 2026-06-26T00:00:00.000Z
updated: 2026-06-26T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Session invalidation after password reset
expected: Log in as a test user, copy the session cookie, then (as admin) reset that user's password via the Reset Password button in UsersPage, then replay the old session cookie to confirm the API returns 401. This validates DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ? executes correctly at runtime.
result: [pending]

### 2. Dashboard charts render in browser
expected: Navigate to /dashboard as admin and confirm the three Recharts panels (Sales Over Time, Sales by Product, Sales by Payment Method) display rendered chart content — not blank white panels. The h-64 parent div ensures ResponsiveContainer has a non-zero height, but DOM measurement only works in a live browser.
result: [pending]

### 3. CSV export download and encoding
expected: On the Dashboard page, click "Export CSV" with some sales rows present. Open the downloaded file (named sales-export-YYYY-MM-DD.csv) in Excel. Confirm: UTF-8 characters display correctly, column headers are present (Product, Price, MOP, Receiver, Notes, Created By, Created At, Last Edited By, Date Edited, Status), and any cell starting with =, -, +, @ has a leading single quote.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
