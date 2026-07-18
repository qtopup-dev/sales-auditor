// UI-SPEC.md §Component Contract: ShiftHistoryTable — react-table v8, read-only, no
// Actions/CSV column (precedent: every other tabular view in the app uses react-table v8).

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { PaginationFooter, type PageSizeOption } from '../PaginationFooter';
import { formatClockTime, formatShiftDate } from '../../lib/shiftTime';

interface ShiftHistoryEntry {
  id: number;
  clockInAt: string;
  clockOutAt: string | null;
  activeSalesCount: number;
  activeSalesRevenue: string;
}

// New utility — no existing precedent in the codebase (only formatDateTime for absolute
// timestamps exists). Guards the still-open case with "In progress" (Claude's discretion).
function formatDuration(clockInAt: string, clockOutAt: string | null): string {
  if (!clockOutAt) return 'In progress';
  const ms = new Date(clockOutAt).getTime() - new Date(clockInAt).getTime();
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

interface ShiftHistoryTableProps {
  shifts: ShiftHistoryEntry[];
  loading: boolean;
  isError: boolean;
}

export function ShiftHistoryTable({ shifts, loading, isError }: ShiftHistoryTableProps) {
  const [pageSizeOption, setPageSizeOption] = useState<PageSizeOption>(25);
  const [pageIndex, setPageIndex] = useState(0);
  const effectivePageSize = pageSizeOption === 'all' ? Math.max(shifts.length, 1) : pageSizeOption;
  const effectivePageIndex = pageSizeOption === 'all' ? 0 : pageIndex;

  const handlePageSizeChange = (size: PageSizeOption) => {
    setPageSizeOption(size);
    setPageIndex(0);
  };

  const columns = useMemo<ColumnDef<ShiftHistoryEntry>[]>(
    () => [
      {
        accessorKey: 'clockInAt',
        header: 'Date',
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-900 dark:text-gray-100">{formatShiftDate(getValue<string>())}</span>
        ),
      },
      {
        id: 'clockIn',
        header: 'Clock In',
        size: 110,
        cell: ({ row }) => (
          <span className="text-sm text-gray-900 dark:text-gray-100">{formatClockTime(row.original.clockInAt)}</span>
        ),
      },
      {
        accessorKey: 'clockOutAt',
        header: 'Clock Out',
        size: 110,
        cell: ({ getValue }) => {
          const clockOutAt = getValue<string | null>();
          return (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {clockOutAt ? formatClockTime(clockOutAt) : 'Still open'}
            </span>
          );
        },
      },
      {
        id: 'duration',
        header: 'Duration',
        size: 100,
        cell: ({ row }) => (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {formatDuration(row.original.clockInAt, row.original.clockOutAt)}
          </span>
        ),
      },
      {
        accessorKey: 'activeSalesCount',
        header: () => <span className="block text-right">Sales</span>,
        size: 80,
        cell: ({ getValue }) => (
          <span className="block text-right text-sm text-gray-900 dark:text-gray-100">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: 'activeSalesRevenue',
        header: () => <span className="block text-right">Revenue</span>,
        size: 120,
        cell: ({ getValue }) => (
          // Display string as-is — NEVER parseFloat (CLAUDE.md Rule 6)
          <span className="block text-right text-sm text-gray-900 dark:text-gray-100">{'₱' + getValue<string>()}</span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: shifts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { pagination: { pageIndex: effectivePageIndex, pageSize: effectivePageSize } },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function'
        ? updater({ pageIndex: effectivePageIndex, pageSize: effectivePageSize })
        : updater;
      setPageIndex(next.pageIndex);
    },
  });

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading shift history...</p>;
  }

  if (isError) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Failed to load shift history. Please refresh the page.</p>;
  }

  if (shifts.length === 0) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-md p-8 text-center">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">No shifts yet</p>
        <p className="text-sm font-normal text-gray-500 dark:text-gray-400">Clock in from the sidebar to start your first shift.</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-sm font-normal text-gray-500 dark:text-gray-400 text-left"
                    style={{ width: header.column.getSize() !== 150 ? header.column.getSize() : undefined }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              // No strikethrough/tint — an open shift is a normal active state, not voided (UI-SPEC.md)
              <tr key={row.id} className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationFooter
        pageSize={pageSizeOption}
        pageIndex={effectivePageIndex}
        totalRows={shifts.length}
        onPageSizeChange={handlePageSizeChange}
        canPrev={table.getCanPreviousPage()}
        canNext={table.getCanNextPage()}
        onPrev={() => table.previousPage()}
        onNext={() => table.nextPage()}
      />
    </div>
  );
}
