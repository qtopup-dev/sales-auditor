---
phase: 03-sales-core
reviewed: 2026-06-25T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - packages/frontend/src/components/sales/SalesTable.tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 03 (Gap-Closure 03-08): Code Review Report

**Reviewed:** 2026-06-25
**Depth:** standard
**Files Reviewed:** 1 (`SalesTable.tsx` post-03-08 refactor)
**Status:** issues_found

## Summary

Reviewed `SalesTable.tsx` after the 03-08 gap-closure refactor that moves `AddRowForm` out of the virtualizer data array and into a static `<tr>` rendered unconditionally above the paddingTop spacer row. The structural goal is correct — the sentinel-row approach forced a full size-cache remap on every add-row open/close cycle; the static-row approach avoids that entirely.

Two warnings were found. The more impactful one is a layout accounting gap introduced by the refactor: the AddRowForm `<tr>` sits in the DOM above the virtualizer's coordinate space but its height is not communicated to the virtualizer, causing the scrollbar to be mis-sized and `scrollToIndex` to target incorrect scroll positions when the form is open. The second warning is a missing dependency in `useCallback`. Two info items cover a redundant `stopPropagation` and the consistency of the price cell color (a carry-over from before the refactor that was also flagged in the prior full review as WR-04).

No security issues found in this file.

---

## Warnings

### WR-01: Virtualizer coordinate space does not account for AddRowForm row height

**File:** `packages/frontend/src/components/sales/SalesTable.tsx:138-141, 159-165`

**Issue:** After the refactor, `AddRowForm` renders as a `<tr>` in the DOM above the virtualizer's paddingTop spacer. The virtualizer's `getTotalSize()` and all `virtualItem.start` offsets count only the virtualised sale rows — they have no knowledge of the AddRowForm row that sits above them in the scroll container.

When `isAddRowOpen` is `true` this creates two concrete bugs:

1. **`scrollToIndex(0)` overshoots.** `handleSaveSuccess` calls `virtualizer.scrollToIndex(0, { align: 'start' })` after a successful save. The virtualizer computes the target scroll position as `virtualItems[0].start` pixels from the top of the scroll container, but the container already has the AddRowForm row above that position. The browser therefore scrolls to a position that leaves row 0 partially hidden behind (or displaced by) the form.

2. **Scrollbar thumb is slightly oversized.** The scroll container's rendered height is `addRowFormHeight + virtualizer.getTotalSize()`, but the scrollbar is sized only against `virtualizer.getTotalSize()`. The user can scroll slightly further than the virtualizer expects, which can leave the last few rows inaccessible if the difference is large enough.

**Fix:** Use the `scrollPaddingStart` option introduced in `@tanstack/react-virtual` v3 to tell the virtualizer how much non-virtualised content sits above the virtual list. Add a `ref` to the AddRowForm `<tr>` and pass its height as `scrollPaddingStart`:

```tsx
const addRowRef = useRef<HTMLTableRowElement>(null);

const virtualizer = useVirtualizer({
  count: tableRows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 56,
  initialRect: { width: 0, height: 600 },
  measureElement:
    typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
      ? (el) => el?.getBoundingClientRect().height
      : undefined,
  overscan: 3,
  scrollPaddingStart: isAddRowOpen ? (addRowRef.current?.offsetHeight ?? 56) : 0,
});
```

And add the `ref` to the AddRowForm row:

```tsx
{isAddRowOpen && (
  <tr ref={addRowRef} className="bg-gray-100 border-b border-blue-200">
    <td colSpan={columns.length} className="p-0">
      <AddRowForm onSaveSuccess={handleSaveSuccess} />
    </td>
  </tr>
)}
```

This corrects both `scrollToIndex` targeting and scrollbar sizing without re-introducing the sentinel row.

---

### WR-02: `useCallback` missing `virtualizer` in dependency array

**File:** `packages/frontend/src/components/sales/SalesTable.tsx:132-135`

**Issue:** `handleSaveSuccess` closes over `virtualizer` but declares an empty dependency array, creating a stale closure.

```tsx
// Current — dependency array is empty, virtualizer is stale after remount
const handleSaveSuccess = useCallback(
  () => virtualizer.scrollToIndex(0, { align: 'start' }),
  []
);
```

`@tanstack/react-virtual` v3 returns a stable object reference from `useVirtualizer` across normal re-renders, so this is silent today. However if `count` changes in a way that causes the virtualizer instance to be replaced (e.g., when the sales list transitions from empty to non-empty), the callback would call `scrollToIndex` on the old instance. If WR-01 is addressed by adding `scrollPaddingStart` (which is a reactive value), the virtualizer object will update and the stale closure becomes observable.

**Fix:**

```tsx
const handleSaveSuccess = useCallback(
  () => virtualizer.scrollToIndex(0, { align: 'start' }),
  [virtualizer]
);
```

---

## Info

### IN-01: Redundant `stopPropagation` on actions `<td>`

**File:** `packages/frontend/src/components/sales/SalesTable.tsx:188-190`

**Issue:** The `<td>` for the `actions` column attaches `onClick={(e) => e.stopPropagation()}` conditionally on line 189. The `<div>` rendered inside (column definition line 87) already calls `e.stopPropagation()`. There is no click handler on `<tr>` or its ancestors that would need stopping at the `<td>` level. The extra handler is dead code.

**Fix:** Remove the conditional `onClick` from the `<td>`:

```tsx
// Before
<td key={cell.id} className="px-4 py-2 text-sm text-gray-900"
  style={{ width: cell.column.getSize() }}
  onClick={cell.column.id === 'actions' ? (e) => e.stopPropagation() : undefined}>

// After
<td key={cell.id} className="px-4 py-2 text-sm text-gray-900"
  style={{ width: cell.column.getSize() }}>
```

---

### IN-02: Price cell uses `text-gray-400` for both active and voided rows

**File:** `packages/frontend/src/components/sales/SalesTable.tsx:27-29`

**Issue:** The price cell class expression is:

```tsx
`block text-right text-sm font-normal ${sale.status === 'void' ? 'line-through text-gray-400' : 'text-gray-400'}`
```

Both branches resolve to `text-gray-400`, so active prices appear dimmed. This was also flagged in the prior full review (WR-04). Other text columns use `text-gray-900` for active rows.

**Fix:**

```tsx
`block text-right text-sm font-normal ${sale.status === 'void' ? 'line-through text-gray-400' : 'text-gray-900'}`
```

---

_Reviewed: 2026-06-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
