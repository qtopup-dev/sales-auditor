// UI-SPEC.md §Void Requests admin table — direct structural clone of AdminSalesTable.tsx's
// seven sale columns (Product/Price/MOP/Receiver/Notes/Created By/Created At), plus a Reason
// column (identical truncation + title treatment as Notes) and a Status column (D-05).
// No CSV export, no client-side sorting, no status filter — none of these are in scope for v1 (D-04).

import { useState, useMemo, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PaginationFooter, type PageSizeOption } from '../PaginationFooter';
import { api } from '../../lib/axios';
import { formatDateTime } from '../../lib/dateTime';
import type { VoidRequestWithSale } from '@alejinput/shared';

interface VoidRequestsTableProps {
  rows: VoidRequestWithSale[];
  loading: boolean;
  onApprove: (request: VoidRequestWithSale) => void;
}

export function VoidRequestsTable({ rows, loading, onApprove }: VoidRequestsTableProps) {
  const queryClient = useQueryClient();

  const [pageSizeOption, setPageSizeOption] = useState<PageSizeOption>(25);
  const [pageIndex, setPageIndex] = useState(0);
  const effectivePageSize = pageSizeOption === 'all' ? Math.max(rows.length, 1) : pageSizeOption;
  const effectivePageIndex = pageSizeOption === 'all' ? 0 : pageIndex;

  const handlePageSizeChange = (size: PageSizeOption) => {
    setPageSizeOption(size);
    setPageIndex(0);
  };

  // Approve/Reject invalidate ['void-requests'], which can shrink `rows` out from under
  // the current page (e.g. approving the last pending row on the last page). Clamp back
  // to the new last valid page instead of silently rendering zero rows.
  useEffect(() => {
    if (pageSizeOption === 'all') return;
    const maxPageIndex = Math.max(0, Math.ceil(rows.length / pageSizeOption) - 1);
    if (pageIndex > maxPageIndex) setPageIndex(maxPageIndex);
  }, [rows.length, pageSizeOption, pageIndex]);

  // Reject is instant (no confirm dialog) — track per-row pending/error state so only the
  // row being rejected grays out, and a failed Reject never reads as a silent no-op (D-03).
  const [pendingRejectId, setPendingRejectId] = useState<number | null>(null);
  const [rejectErrorId, setRejectErrorId] = useState<number | null>(null);

  const rejectMutation = useMutation({
    mutationFn: (id: number) => {
      setPendingRejectId(id);
      // Empty body required: some proxy layers in the deploy chain mishandle bodyless PATCH requests
      return api.patch(`/void-requests/${id}/reject`, {}).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['void-requests'] });
      queryClient.invalidateQueries({ queryKey: ['void-requests-pending-count'] });
      queryClient.invalidateQueries({ queryKey: ['void-request-pending-sale-ids'] });
      setPendingRejectId(null);
      setRejectErrorId(null);
    },
    onError: (_err, id) => {
      setPendingRejectId(null);
      setRejectErrorId(id);
    },
  });

  const columns = useMemo<ColumnDef<VoidRequestWithSale>[]>(
    () => [
      {
        id: 'product',
        header: 'Product',
        size: 160,
        cell: ({ row }) => (
          <span className="text-sm text-gray-900 dark:text-gray-100">{row.original.sale.productNameSnapshot}</span>
        ),
      },
      {
        id: 'price',
        header: () => <span className="block text-right">Price</span>,
        size: 100,
        cell: ({ row }) => (
          // Display string as-is — NEVER parseFloat (CLAUDE.md Rule 6)
          <span className="block text-right text-sm text-gray-900 dark:text-gray-100">{row.original.sale.priceSnapshot}</span>
        ),
      },
      {
        id: 'mop',
        header: 'MOP',
        size: 140,
        cell: ({ row }) => (
          <span className="text-sm text-gray-900 dark:text-gray-100">{row.original.sale.mopNameSnapshot}</span>
        ),
      },
      {
        id: 'receiver',
        header: 'Receiver',
        size: 140,
        cell: ({ row }) => (
          <span className="text-sm text-gray-900 dark:text-gray-100">{row.original.sale.receiverNameSnapshot}</span>
        ),
      },
      {
        id: 'notes',
        header: 'Notes',
        minSize: 120,
        cell: ({ row }) => {
          const notes = row.original.sale.notes;
          return (
            <span
              className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2"
              title={notes ?? undefined}
            >
              {notes ?? ''}
            </span>
          );
        },
      },
      {
        id: 'reason',
        header: 'Reason',
        minSize: 120,
        cell: ({ row }) => {
          const reason = row.original.reason;
          return (
            <span
              className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2"
              title={reason}
            >
              {reason}
            </span>
          );
        },
      },
      {
        id: 'createdBy',
        header: 'Created By',
        size: 120,
        cell: ({ row }) => (
          <span className="text-sm text-gray-900 dark:text-gray-100">{row.original.sale.createdByUsername}</span>
        ),
      },
      {
        id: 'createdAt',
        header: 'Created At',
        size: 140,
        cell: ({ row }) => (
          <span className="text-sm text-gray-500 dark:text-gray-400">{formatDateTime(row.original.sale.createdAt)}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        size: 100,
        cell: ({ row }) => {
          const status = row.original.status;
          if (status === 'pending') {
            return (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-normal bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                Pending
              </span>
            );
          }
          if (status === 'approved') {
            return (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-normal bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Approved
              </span>
            );
          }
          return (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-normal bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              Rejected
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 140,
        cell: ({ row }) => {
          const request = row.original;
          if (request.status !== 'pending') {
            return <span className="text-sm text-gray-400 dark:text-gray-600">—</span>;
          }
          return (
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={pendingRejectId === request.id}
                  onClick={() => onApprove(request)}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm min-h-[44px] disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  Approve
                </button>
                <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
                <button
                  type="button"
                  disabled={pendingRejectId === request.id}
                  onClick={() => rejectMutation.mutate(request.id)}
                  title={rejectErrorId === request.id ? 'Reject failed — click to retry.' : undefined}
                  className={`text-sm min-h-[44px] ${
                    pendingRejectId === request.id
                      ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  Reject
                </button>
              </div>
              {rejectErrorId === request.id && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Failed to reject request. Please try again.
                </p>
              )}
            </div>
          );
        },
      },
    ],
    [onApprove, rejectMutation, pendingRejectId, rejectErrorId],
  );

  const table = useReactTable({
    data: rows,
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
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading void requests...</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-md p-8 text-center">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">No void requests yet</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Void requests submitted by moderators will appear here.</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
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
          {table.getRowModel().rows.map((row) => {
            // Reviewed rows (approved/rejected) visually recede but stay fully visible (D-04) —
            // red is reserved for the destructive Approve action and the sidebar badge, so the
            // existing voided-row red background is deliberately not reused here.
            const isReviewed = row.original.status !== 'pending';
            return (
              <tr
                key={row.id}
                className={
                  isReviewed
                    ? 'bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900'
                    : 'bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
      <PaginationFooter
        pageSize={pageSizeOption}
        pageIndex={effectivePageIndex}
        totalRows={rows.length}
        onPageSizeChange={handlePageSizeChange}
        canPrev={table.getCanPreviousPage()}
        canNext={table.getCanNextPage()}
        onPrev={() => table.previousPage()}
        onNext={() => table.nextPage()}
      />
    </div>
  );
}
