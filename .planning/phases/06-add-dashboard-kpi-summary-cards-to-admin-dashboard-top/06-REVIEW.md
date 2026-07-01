---
phase: 06-add-dashboard-kpi-summary-cards-to-admin-dashboard-top
reviewed: 2026-07-01T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - packages/backend/src/routes/admin.ts
  - packages/frontend/src/components/admin/KpiCard.tsx
  - packages/frontend/src/pages/DashboardPage.tsx
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-07-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files were reviewed: the backend `/api/admin/summary` route, the new `KpiCard` presentational component, and the `DashboardPage` that wires them together.

`KpiCard.tsx` is clean — the component contract, skeleton states, and CLAUDE.md Rule 6 currency handling are all correct.

Two warnings were found: a semantic data inconsistency in the backend summary query (product breakdown revenue includes voided sales while `totalRevenue` does not), and a missing `catch` block in the frontend CSV export handler that silently discards errors. Three lower-severity info items are also noted.

Express 5.2.1 is confirmed in `packages/backend/package.json`, so the async route handler without a top-level `try/catch` is acceptable — Express 5 auto-forwards unhandled rejections to error middleware.

## Warnings

### WR-01: `productBreakdown.revenue` includes voided-sale amounts — inconsistent with `totalRevenue`

**File:** `packages/backend/src/routes/admin.ts:43-49`

**Issue:** The `prisma.sale.groupBy` query for `productBreakdown` filters on `status: { in: ['active', 'void'] }`, which causes `_sum.priceSnapshot` to include the price of voided transactions in each product's `revenue` field. Meanwhile `totalRevenue` (lines 38-41) filters on `status: 'active'` only. As a result, if voided sales exist, the sum of all `productBreakdown[i].revenue` values will exceed `totalRevenue`, and the per-product figures will be inflated. Admins using the charts to understand per-product contribution will see numbers that don't reconcile with the headline revenue figure.

**Fix:** Use a conditional sum via `$queryRaw` to separate the active-only revenue from the total count (which legitimately spans active+void). Alternatively, if the charts only need counts (not per-product revenue), drop the `_sum` from the groupBy and remove the `revenue` field from the response:

```typescript
// Option A — remove revenue from productBreakdown (simplest if charts don't display per-product revenue)
productBreakdown: productBreakdown.map((r) => ({
  name: r.productNameSnapshot,
  count: r._count._all,
  // revenue field removed
})),

// Option B — keep counts over all statuses but compute revenue separately with $queryRaw
// using SUM(CASE WHEN status = 'active' THEN priceSnapshot ELSE 0 END) per productNameSnapshot
```

---

### WR-02: `handleExportCSV` silently discards download errors

**File:** `packages/frontend/src/pages/DashboardPage.tsx:92-99`

**Issue:** The handler uses `try { downloadCSV(filteredRows) } finally { setCsvExporting(false) }` with no `catch` block. If `downloadCSV` throws (e.g., CSV serialization failure, formula injection sanitization error), the exception propagates as an unhandled error in the React synthetic event handler. React error boundaries do not cover event handler exceptions, so the user sees no feedback — the Export button silently re-enables and no error is shown.

**Fix:**
```typescript
const handleExportCSV = () => {
  setCsvExporting(true);
  try {
    downloadCSV(filteredRows);
  } catch (err) {
    console.error('CSV export failed:', err);
    // Replace with your project's toast/alert pattern
    alert('Export failed. Please try again.');
  } finally {
    setCsvExporting(false);
  }
};
```

---

## Info

### IN-01: Non-null assertion on `req.session.organizationId` without a defensive guard

**File:** `packages/backend/src/routes/admin.ts:26`

**Issue:** `const organizationId = req.session.organizationId!;` suppresses TypeScript's undefined check. If `requireRole` only validates the session role and not the presence of `organizationId` (a plausible split of responsibilities), a malformed or migrated session without this field would cause Prisma to throw in the `Promise.all`. Express 5 will catch and forward that to error middleware, resulting in a generic 500. A defensive guard would emit a cleaner, faster failure with a meaningful status code.

**Fix:**
```typescript
const organizationId = req.session.organizationId;
if (!organizationId) {
  res.status(401).json({ error: 'Session missing organization context' });
  return;
}
```

---

### IN-02: Magic number for `staleTime`

**File:** `packages/frontend/src/pages/DashboardPage.tsx:64`

**Issue:** `staleTime: 5 * 60 * 1000` is an inline magic number. If this value needs to change (or be referenced elsewhere, e.g., for a refresh button), there is no single source of truth.

**Fix:**
```typescript
const SUMMARY_STALE_MS = 5 * 60 * 1000; // 5 minutes

// ...inside useQuery:
staleTime: SUMMARY_STALE_MS,
```

---

### IN-03: Unnecessary arrow wrapper on `onVoid` prop

**File:** `packages/frontend/src/pages/DashboardPage.tsx:178`

**Issue:** `onVoid={(saleId) => openVoidDialog(saleId)}` creates a new function reference on every render. `openVoidDialog` already has the same signature.

**Fix:**
```tsx
<AdminSalesTable
  rows={filteredRows}
  loading={salesLoading}
  onVoid={openVoidDialog}
/>
```

---

_Reviewed: 2026-07-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
