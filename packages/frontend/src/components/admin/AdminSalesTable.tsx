// UI-SPEC.md §AdminSalesTable — read-only admin all-sales table
// ADMIN-01/02: all columns + Status column
// ADMIN-07/08/09: downloadCSV with injection sanitization and BOM
// ADMIN-12: Audit button opens AuditDrawer via useSalesEditStore().openAuditDrawer

import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { Parser } from '@json2csv/plainjs';
import type { Sale } from '@alejinput/shared';
import { useSalesEditStore } from '../../stores/salesEditStore';

// Format ISO-8601 string to "YYYY-MM-DD HH:mm" (UTC) for date columns
function formatDateTime(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16);
}

// CSV formula injection sanitizer (D-11, ADMIN-09)
// Prepend single quote to cells starting with dangerous characters
const INJECTION_PREFIXES = ['=', '-', '+', '@', '\t', '\r'];
function sanitizeCell(value: unknown): string {
  const str = String(value ?? '');
  if (INJECTION_PREFIXES.some((prefix) => str.startsWith(prefix))) {
    return `'${str}`;
  }
  return str;
}

// CSV export function (D-10, D-12, D-13)
// Exported so DashboardPage can call it from the "Export CSV" header button
export function downloadCSV(rows: Sale[]): void {
  try {
    // Pre-sanitize all text fields against CSV formula injection (D-11, ADMIN-09)
    // Pre-processing avoids @json2csv/plainjs transforms generic type complexity
    const sanitizedRows: Record<string, unknown>[] = rows.map((row) => ({
      productNameSnapshot: sanitizeCell(row.productNameSnapshot),
      priceSnapshot: sanitizeCell(row.priceSnapshot),
      mopNameSnapshot: sanitizeCell(row.mopNameSnapshot),
      receiver: sanitizeCell(row.receiver),
      notes: sanitizeCell(row.notes ?? ''),
      createdByUsername: sanitizeCell(row.createdByUsername),
      createdAt: row.createdAt,
      lastEditedByUsername: sanitizeCell(row.lastEditedByUsername ?? ''),
      updatedAt: row.updatedAt,
      status: row.status,
    }));

    const fields = [
      { label: 'Product',        value: 'productNameSnapshot' },
      { label: 'Price',          value: 'priceSnapshot' },
      { label: 'MOP',            value: 'mopNameSnapshot' },
      { label: 'Receiver',       value: 'receiver' },
      { label: 'Notes',          value: 'notes' },
      { label: 'Created By',     value: 'createdByUsername' },
      { label: 'Created At',     value: 'createdAt' },
      { label: 'Last Edited By', value: 'lastEditedByUsername' },
      { label: 'Date Edited',    value: 'updatedAt' },
      { label: 'Status',         value: 'status' },
    ];

    const parser = new Parser({ fields });
    const csvContent = parser.parse(sanitizedRows);
    const BOM = '﻿'; // UTF-8 BOM (U+FEFF) for correct Excel encoding (D-11)
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch {
    alert('CSV export failed. Please try again.');
  }
}

interface AdminSalesTableProps {
  rows: Sale[];
  loading: boolean;
  onVoid: (saleId: number) => void;
}

export function AdminSalesTable({ rows, loading, onVoid }: AdminSalesTableProps) {
  const { openAuditDrawer } = useSalesEditStore();

  const columns = useMemo<ColumnDef<Sale>[]>(
    () => [
      {
        accessorKey: 'productNameSnapshot',
        header: 'Product',
        size: 160,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-900">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'priceSnapshot',
        header: () => <span className="block text-right">Price</span>,
        size: 100,
        cell: ({ getValue }) => (
          // Display string as-is — NEVER parseFloat (CLAUDE.md Rule 6)
          <span className="block text-right text-sm text-gray-900">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'mopNameSnapshot',
        header: 'MOP',
        size: 140,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-900">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'receiver',
        header: 'Receiver',
        size: 140,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-900">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'notes',
        header: 'Notes',
        minSize: 120,
        cell: ({ getValue }) => {
          const notes = getValue<string | null>();
          return (
            <span
              className="text-sm text-gray-900 line-clamp-2"
              title={notes ?? undefined}
            >
              {notes ?? ''}
            </span>
          );
        },
      },
      {
        accessorKey: 'createdByUsername',
        header: 'Created By',
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-900">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created At',
        size: 140,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-500">{formatDateTime(getValue<string>())}</span>
        ),
      },
      {
        accessorKey: 'lastEditedByUsername',
        header: 'Last Edited By',
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-900">{getValue<string | null>() ?? '—'}</span>
        ),
      },
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
            <span className="text-sm text-gray-500">
              {hasEdits ? formatDateTime(updatedAt) : '—'}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 90,
        cell: ({ getValue }) => {
          const status = getValue<'active' | 'void'>();
          return status === 'active' ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-normal bg-green-100 text-green-800">
              Active
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-normal bg-red-100 text-red-700">
              Void
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 120,
        cell: ({ row }) => {
          const sale = row.original;
          return (
            <div className="flex items-center justify-center gap-1">
              {sale.status === 'active' && (
                <>
                  <button
                    type="button"
                    onClick={() => onVoid(sale.id)}
                    className="text-red-600 hover:text-red-800 text-sm min-h-[44px]"
                  >
                    Void
                  </button>
                  <span className="text-gray-300 mx-1">|</span>
                </>
              )}
              <button
                type="button"
                onClick={() => openAuditDrawer(sale.id)}
                className="text-blue-600 hover:text-blue-800 text-sm min-h-[44px]"
              >
                Audit
              </button>
            </div>
          );
        },
      },
    ],
    [onVoid, openAuditDrawer],
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  if (loading) {
    return <p className="text-sm text-gray-500">Loading sales...</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="border border-gray-200 rounded-md p-8 text-center">
        <p className="text-sm font-semibold text-gray-900 mb-1">No sales match the current filters</p>
        <p className="text-sm text-gray-500">Adjust or clear the filters to see results.</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <table className="w-full">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="bg-gray-100 border-b border-gray-200">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-sm font-normal text-gray-500 text-left"
                  style={{ width: header.column.getSize() !== 150 ? header.column.getSize() : undefined }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const isVoided = row.original.status === 'void';
            return (
              <tr
                key={row.id}
                className={
                  isVoided
                    ? 'bg-red-50 border-b border-gray-200 hover:bg-red-100'
                    : 'bg-white border-b border-gray-200 hover:bg-gray-50'
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm text-gray-900">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
