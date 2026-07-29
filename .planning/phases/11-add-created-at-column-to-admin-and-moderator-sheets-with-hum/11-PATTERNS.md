# Phase 11: Add "Created At" column + humanized dates - Pattern Map

**Mapped:** 2026-07-29
**Files analyzed:** 3 (modify) + 1 (new, discretionary — date-formatting utility)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/frontend/src/components/sales/SalesTable.tsx` | component (table) | CRUD (client-side rendering of fetched rows) | `packages/frontend/src/components/admin/AdminSalesTable.tsx` | exact (same table, same `Sale` type, sibling column set) |
| `packages/frontend/src/components/admin/AdminSalesTable.tsx` | component (table) | CRUD | itself (in-place edit) — secondary analog `packages/frontend/src/pages/AdminShiftsPage.tsx` for the duplicated `formatDateTime` pattern | exact |
| `packages/frontend/src/components/sales/AuditDrawer.tsx` | component (drawer/list) | request-response (react-query fetch + render) | `packages/frontend/src/components/admin/AdminSalesTable.tsx` (date cell rendering) | role-match |
| `packages/frontend/src/lib/dateTime.ts` *(new, optional per CONTEXT.md discretion)* | utility | transform | `packages/frontend/src/lib/shiftTime.ts` | exact (same directory, same purpose: `Intl.DateTimeFormat` wrapper functions for ISO-string display formatting) |

## Pattern Assignments

### `packages/frontend/src/components/sales/SalesTable.tsx` (component, CRUD)

**Analog:** `packages/frontend/src/components/admin/AdminSalesTable.tsx` (for column shape/order) and its own existing `updatedAt` column (for the "never edited → em dash" pattern already present in this file)

**Imports pattern** (lines 1-8, current file):
```tsx
import { useEffect, useRef, useState } from 'react';
import { useReactTable, getCoreRowModel, getPaginationRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import type { Sale } from '@alejinput/shared';
import { useAuthStore } from '../../stores/authStore';
import { useSalesEditStore } from '../../stores/salesEditStore';
import { AddRowForm } from './AddRowForm';
import { EditableCell } from './EditableCell';
import { PaginationFooter, type PageSizeOption } from '../PaginationFooter';
```
If a shared date util is introduced, add: `import { formatDateTime } from '../../lib/dateTime';` (relative path from `components/sales/` → `lib/` is `../../lib/...`, confirmed by `AddRowForm`/`EditableCell` sibling imports using `./`).

**Core pattern — column insertion point** (lines 51-75, current file — this is the exact `notes` → `updatedAt` boundary the new column must be inserted into):
```tsx
  {
    accessorKey: 'notes',
    header: 'Notes',
    size: 160,
    cell: ({ row }) => {
      const sale = row.original;
      return <EditableCell sale={sale} field="notes" displayValue={sale.notes ?? ''} />;
    },
  },
  {
    accessorKey: 'updatedAt',
    header: 'Date Edited',
    size: 140,
    cell: ({ row }) => {
      const sale = row.original;
      const label = sale.lastEditedById
        ? sale.updatedAt.replace('T', ' ').slice(0, 16)
        : '—';
      return (
        <span className={`text-sm font-normal ${sale.status === 'void' ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-400 dark:text-gray-500'}`}>
          {label}
        </span>
      );
    },
  },
```
D-04 requires a new `createdAt` column inserted between these two (before `updatedAt`/"Date Edited"). D-05 confirms `Sale.createdAt` is already present on the type (`packages/shared/src/types/sale.ts` line 27, `createdAt: string // ISO 8601 UTC string`) and already returned by `GET /api/sales` — no new data fetch required, only a new `ColumnDef` entry modeled on the admin table's `createdAt` column (see AdminSalesTable excerpt below) crossed with this file's cell styling conventions (`text-sm font-normal`, no `line-through`/void styling needed since Created At never changes).

**Replace this line** (line 67) as part of D-01 reformat: `sale.updatedAt.replace('T', ' ').slice(0, 16)` → call to the new humanized formatter.

**Note:** `columns` here is a module-level `const` (not `useMemo` inside the component, unlike `AdminSalesTable.tsx`) — keep that convention; do not wrap in `useMemo` when adding the new column.

---

### `packages/frontend/src/components/admin/AdminSalesTable.tsx` (component, CRUD)

**Analog:** itself — `formatDateTime` is the exact function to replace; secondary analog for style is `packages/frontend/src/lib/shiftTime.ts`.

**Imports pattern** (lines 1-17):
```tsx
import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { PaginationFooter, type PageSizeOption } from '../PaginationFooter';
import { Parser } from '@json2csv/plainjs';
import type { Sale } from '@alejinput/shared';
import { useSalesEditStore } from '../../stores/salesEditStore';
```

**Function to replace** (lines 19-22):
```tsx
// Format ISO-8601 string to "YYYY-MM-DD HH:mm" (UTC) for date columns
function formatDateTime(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16);
}
```
Either reimplement this function in place with an `Intl.DateTimeFormat` call producing `"July 29, 2026, 2:32 PM"` (UTC, no timezone conversion per D-02), or delete it and import the equivalent from a new shared util (see `lib/dateTime.ts` analog below) — planner's discretion per CONTEXT.md.

**Usage site 1 — `createdAt` column cell** (lines 162-169):
```tsx
      {
        accessorKey: 'createdAt',
        header: 'Created At',
        size: 140,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-500 dark:text-gray-400">{formatDateTime(getValue<string>())}</span>
        ),
      },
```
This is the column the moderator table's new column should mirror (header text `'Created At'`, `size: 140`, `text-sm text-gray-500 dark:text-gray-400` styling — note it does NOT use `font-normal` explicitly, unlike `SalesTable.tsx`'s cells, since Tailwind's base text style already applies).

**Usage site 2 — `updatedAt` column with "never edited" branch** (lines 178-193):
```tsx
      {
        accessorKey: 'updatedAt',
        header: 'Date Edited',
        size: 140,
        cell: ({ row }) => {
          const updatedAt = row.original.updatedAt;
          const createdAt = row.original.createdAt;
          // Show "—" if row has never been edited (updatedAt same as createdAt)
          const hasEdits = updatedAt !== createdAt;
          return (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {hasEdits ? formatDateTime(updatedAt) : '—'}
            </span>
          );
        },
      },
```
Only the `formatDateTime(updatedAt)` call site changes; the `hasEdits` comparison logic (raw ISO string equality) is unaffected by the format change and must be preserved as-is (comparing raw ISO strings, not formatted output).

**CSV export — discretionary reformat point** (lines 41-52, `downloadCSV`):
```tsx
    const sanitizedRows: Record<string, unknown>[] = rows.map((row) => ({
      productNameSnapshot: sanitizeCell(row.productNameSnapshot),
      priceSnapshot: sanitizeCell(row.priceSnapshot),
      mopNameSnapshot: sanitizeCell(row.mopNameSnapshot),
      receiverNameSnapshot: sanitizeCell(row.receiverNameSnapshot),
      notes: sanitizeCell(row.notes ?? ''),
      createdByUsername: sanitizeCell(row.createdByUsername),
      createdAt: row.createdAt,
      lastEditedByUsername: sanitizeCell(row.lastEditedByUsername ?? ''),
      updatedAt: row.updatedAt,
      status: row.status,
    }));
```
`createdAt`/`updatedAt` (lines 48, 50) are written raw (unsanitized — dates cannot start with CSV-injection-prefix characters, so `sanitizeCell` is correctly skipped for these two fields already). CONTEXT.md leaves it open whether to humanize these for the export; if humanized, still skip `sanitizeCell` (humanized month names like "July" never start with `= - + @ \t \r`) — do not introduce sanitization here, keep consistent with existing skip.

---

### `packages/frontend/src/components/sales/AuditDrawer.tsx` (component, request-response)

**Analog:** `AdminSalesTable.tsx` date-cell pattern (styling), react-query fetch pattern is this file's own.

**Imports pattern** (lines 1-5):
```tsx
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AuditEntry } from '@alejinput/shared';
import { api } from '../../lib/axios';
import { useSalesEditStore } from '../../stores/salesEditStore';
```
Path convention confirms `../../lib/axios` is how `components/sales/*.tsx` reaches `src/lib/` — same relative path a new `../../lib/dateTime` import would use.

**Exact line to replace** (line 76, per CONTEXT.md D-02):
```tsx
                  <p className="text-xs font-normal text-gray-400 dark:text-gray-500">
                    {entry.createdAt.replace('T', ' ').slice(0, 16)} UTC
                  </p>
```
D-02 requires dropping the trailing `{' '}UTC` label entirely and replacing the raw slice with the humanized format. Only this one call site in the file touches date formatting — `entry.createdAt` is the only date field rendered in `AuditDrawer.tsx`.

---

### `packages/frontend/src/lib/dateTime.ts` (new, optional utility — planner's discretion)

**Analog:** `packages/frontend/src/lib/shiftTime.ts` (full file, 46 lines — read in full above)

This is the established project convention for a small, single-purpose date/time formatting module in `src/lib/`: plain exported functions (no class, no default export), each wrapping `Intl.DateTimeFormat`, with a one-line comment above any function whose output isn't self-evident from the name:

```ts
// e.g. "Saturday July 18, 2026"
export function formatLongDatePH(date: Date = new Date()): string {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: PH_TIME_ZONE, weekday: 'long' }).format(date);
  const monthDayYear = new Intl.DateTimeFormat('en-US', {
    timeZone: PH_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  return `${weekday} ${monthDayYear}`;
}
```

**Critical divergence from this analog:** `shiftTime.ts` deliberately converts to `Asia/Manila` wall-clock time (see its file-header comment, lines 1-5) because shift clock-in/out times are meant to be viewed in PH local time. Phase 11's D-02 explicitly does the opposite — displays stay in UTC, no timezone conversion, only the "UTC" text label is dropped. Any new formatter here must pass `timeZone: 'UTC'` explicitly to `Intl.DateTimeFormat` (do NOT omit the `timeZone` option, since omitting it defaults to the browser's local timezone, which would silently violate D-02).

A function matching D-01's target (`"July 29, 2026, 2:32 PM"`) would combine `month: 'long', day: 'numeric', year: 'numeric'` with `hour: 'numeric', minute: '2-digit', hour12: true`, all pinned to `timeZone: 'UTC'`, joined with `, ` — following the same two-`Intl.DateTimeFormat`-calls-joined-by-a-literal-string structure `formatLongDatePH` already demonstrates.

If the planner chooses NOT to create this shared file (updating the three call sites in place instead, per CONTEXT.md's stated discretion), skip this section — `shiftTime.ts` is offered here only as the precedent pattern to follow if a shared util is chosen, since it is the only existing `src/lib/*.ts` file with this exact purpose.

**Note on `packages/shared`:** `packages/shared/src/types/index.ts` (read in full — 16 lines) exports ONLY TypeScript `type` re-exports (`export type { ... }`), no runtime values or functions. `packages/shared/package.json` builds via plain `tsc` with `"exports": { ".": "./src/types/index.ts" }`. There is no existing precedent in `packages/shared` for exporting a runtime utility function; introducing one there would be a new pattern for that package, not a continuation of an existing one. `packages/frontend/src/lib/` is the established location for frontend-only display-formatting utilities (`shiftTime.ts`, `selectStyles.ts`, `queryClient.ts`, `axios.ts`) and is the recommended location if a shared util is created, consistent with `shiftTime.ts`.

---

## Shared Patterns

### Duplicated raw-ISO-slice formatting (the pattern being eliminated)
**Sources:** `AdminSalesTable.tsx:20-22`, `SalesTable.tsx:67`, `AuditDrawer.tsx:76`, and out-of-scope `AdminShiftsPage.tsx:36-38`
```tsx
iso.replace('T', ' ').slice(0, 16)   // → "YYYY-MM-DD HH:mm"
```
All three in-scope call sites currently use a variant of this. `AdminShiftsPage.tsx` (out of scope per D-03) has an identical private copy — leave it untouched, but if a shared `lib/dateTime.ts` is created, CONTEXT.md notes the planner "could still point [`AdminShiftsPage.tsx`'s `formatDateTime`] at a new shared util" (optional, not required).

### `Intl.DateTimeFormat`-based formatting (the pattern to adopt)
**Source:** `packages/frontend/src/lib/shiftTime.ts` (full file)
**Apply to:** the new/updated formatter used by all three in-scope files
Key structural precedent: explicit `timeZone` option always passed (never relies on default/local), `Intl.DateTimeFormat('en-US', {...}).format(new Date(iso))`, small composable functions rather than one monolithic formatter.

### "Never edited" / null-date fallback (`'—'`)
**Sources:** `AdminSalesTable.tsx:186-190` (`hasEdits = updatedAt !== createdAt`), `SalesTable.tsx:66-68` (`sale.lastEditedById` truthiness check)
**Apply to:** both `updatedAt`/"Date Edited" cells — preserve existing branching logic (CONTEXT.md's "Established Patterns" section flags this explicitly); only the formatted-string branch changes, not the condition.

### Table column shape convention (`ColumnDef<Sale>`)
**Source:** `AdminSalesTable.tsx:162-169` (`createdAt` column) as the shape to mirror in `SalesTable.tsx`'s new column
**Apply to:** `SalesTable.tsx` new "Created At" `ColumnDef` entry — match `header: 'Created At'`, `size: 140`, and adapt cell styling to this file's existing `text-sm font-normal ... text-gray-400 dark:text-gray-500` convention (used by its sibling `updatedAt` cell) rather than `AdminSalesTable.tsx`'s slightly different `text-sm text-gray-500 dark:text-gray-400` (no `font-normal`) — each file should stay internally consistent with its own existing cell class conventions.

### Relative import path to `src/lib/`
**Source:** `AuditDrawer.tsx:4` (`from '../../lib/axios'`), confirmed by `SalesTable.tsx` importing from `../../stores/`
**Apply to:** any new `import { ... } from '../../lib/dateTime'` in `components/sales/*.tsx` or `components/admin/*.tsx` (both are two levels below `src/`).

## No Analog Found

None — all four files (three modify targets + one optional new utility) have a strong existing analog in the codebase.

## Metadata

**Analog search scope:** `packages/frontend/src/components/sales/`, `packages/frontend/src/components/admin/`, `packages/frontend/src/pages/`, `packages/frontend/src/lib/`, `packages/shared/src/types/`
**Files scanned:** `SalesTable.tsx`, `AdminSalesTable.tsx`, `AuditDrawer.tsx`, `AdminShiftsPage.tsx` (formatDateTime usage only), `shiftTime.ts`, `packages/shared/src/types/index.ts`, `packages/shared/src/types/sale.ts`, `packages/shared/package.json`
**Pattern extraction date:** 2026-07-29
