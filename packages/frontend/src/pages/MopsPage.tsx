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
        <span className="text-sm text-gray-900">{getValue<string>()}</span>
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
              className="text-blue-600 hover:text-blue-800 text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Edit
            </button>
            <span className="text-gray-300 mx-1">|</span>
            <button
              type="button"
              disabled={isThisTogglePending}
              onClick={() => toggleMutation.mutate(mop.id)}
              className={`text-sm ${
                isThisTogglePending
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {mop.isActive ? 'Deactivate' : 'Activate'}
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Modes of Payment</h1>
        <button
          type="button"
          onClick={() => setModalTarget('create')}
          className="px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Add MOP
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : mops.length === 0 ? (
        /* Empty state — UI-SPEC.md Copywriting Contract */
        <div className="border border-gray-200 rounded-md p-8 text-center">
          <p className="text-sm font-semibold text-gray-900 mb-1">No modes of payment yet</p>
          <p className="text-sm text-gray-500">Add your first payment method to get started.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="bg-gray-100 border-b border-gray-200">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-sm text-gray-500 font-normal text-left"
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
                  className="bg-white border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setModalTarget(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 text-sm text-gray-900"
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
    </div>
  );
}
