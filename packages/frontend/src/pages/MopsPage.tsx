import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { api } from '../lib/axios';
import { StatusBadge } from '../components/StatusBadge';
import { MopModal } from '../components/catalog/MopModal';
import { MopDeleteConfirmDialog } from '../components/catalog/MopDeleteConfirmDialog';
import type { Mop } from '@alejinput/shared';

// PAY-04: admin views all MOPs (active + inactive)
// PAY-01/02: create/edit via MopModal
// PAY-03: toggle active/inactive via Deactivate/Activate button
// PAY-06: MOP entity with name and status columns (no price)
export function MopsPage() {
  const queryClient = useQueryClient();
  const [modalTarget, setModalTarget] = useState<Mop | 'create' | null>(null);
  // Track which MOP's toggle is in-flight (pessimistic per-row — CLAUDE.md Rule 10)
  const [pendingToggleId, setPendingToggleId] = useState<number | null>(null);
  // Delete confirm dialog target — separate from modalTarget so Edit and Delete never collide
  const [deleteTarget, setDeleteTarget] = useState<Mop | null>(null);

  const { data: mops = [], isLoading } = useQuery<Mop[]>({
    queryKey: ['mops'],
    queryFn: () => api.get<Mop[]>('/mops').then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (mopId: number) => {
      setPendingToggleId(mopId);
      // Empty body required: some proxy layers in the deploy chain mishandle bodyless PATCH requests
      return api.patch<Mop>(`/mops/${mopId}/toggle`, {}).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mops'] });
      setPendingToggleId(null);
    },
    onError: () => setPendingToggleId(null),
  });

  const columns: ColumnDef<Mop>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ getValue }) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">{getValue<string>()}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge active={row.original.isActive} />,
      size: 100,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const mop = row.original;
        const isThisTogglePending = pendingToggleId === mop.id;
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setModalTarget(mop)}
              disabled={isThisTogglePending}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Edit
            </button>
            <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
            <button
              type="button"
              disabled={isThisTogglePending}
              onClick={() => toggleMutation.mutate(mop.id)}
              className={`text-sm ${
                isThisTogglePending
                  ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {mop.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
            <button
              type="button"
              disabled={isThisTogglePending}
              onClick={() => setDeleteTarget(mop)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Delete
            </button>
          </div>
        );
      },
      size: 160,
    },
  ];

  const table = useReactTable({ data: mops, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Modes of Payment</h1>
        <button
          type="button"
          onClick={() => setModalTarget('create')}
          className="px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          Add MOP
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : mops.length === 0 ? (
        /* Empty state — UI-SPEC.md Copywriting Contract */
        <div className="border border-gray-200 dark:border-gray-700 rounded-md p-8 text-center">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">No modes of payment yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Add your first payment method to get started.</p>
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-normal text-left"
                      style={header.column.getSize() !== 150 ? { width: header.column.getSize() } : undefined}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => setModalTarget(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100"
                      onClick={
                        cell.column.id === 'actions' ? (e) => e.stopPropagation() : undefined
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalTarget !== null && (
        <MopModal
          mop={modalTarget === 'create' ? null : modalTarget}
          onClose={() => setModalTarget(null)}
        />
      )}

      {/* MOP delete confirm dialog */}
      <MopDeleteConfirmDialog mop={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
