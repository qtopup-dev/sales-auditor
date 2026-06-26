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
import { ReceiverModal } from '../components/catalog/ReceiverModal';
import type { Receiver } from '@alejinput/shared';

// UI-SPEC.md §1 Receiver Catalog Page
// Admin views all receivers (active + inactive), creates via modal, edits via modal, toggles status
export function ReceiversPage() {
  const queryClient = useQueryClient();
  const [modalTarget, setModalTarget] = useState<Receiver | 'create' | null>(null);
  // Track which receiver's toggle is in-flight (pessimistic per-row — CLAUDE.md Rule 10)
  const [pendingToggleId, setPendingToggleId] = useState<number | null>(null);

  const { data: receivers = [], isLoading } = useQuery<Receiver[]>({
    queryKey: ['receivers'],
    queryFn: () => api.get<Receiver[]>('/receivers').then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (receiverId: number) => {
      setPendingToggleId(receiverId);
      return api.patch<Receiver>(`/receivers/${receiverId}/toggle`).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivers'] });
      setPendingToggleId(null);
    },
    onError: () => setPendingToggleId(null),
  });

  const columns: ColumnDef<Receiver>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ getValue }) => (
        <span className="text-sm text-gray-900">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: 'accountNumber',
      header: 'Account #',
      size: 160,
      cell: ({ row }) => (
        <span className="text-sm text-gray-500">
          {row.original.accountNumber ?? '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      size: 100,
      cell: ({ row }) => <StatusBadge active={row.original.isActive} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 160,
      cell: ({ row }) => {
        const receiver = row.original;
        const isThisTogglePending = pendingToggleId === receiver.id;
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setModalTarget(receiver)}
              disabled={isThisTogglePending}
              className="text-blue-600 hover:text-blue-800 text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Edit
            </button>
            <span className="text-gray-300 mx-1">|</span>
            <button
              type="button"
              disabled={isThisTogglePending}
              onClick={() => toggleMutation.mutate(receiver.id)}
              className={`text-sm ${
                isThisTogglePending
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {receiver.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: receivers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Receivers</h1>
        <button
          type="button"
          onClick={() => setModalTarget('create')}
          className="px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Add Receiver
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : receivers.length === 0 ? (
        <div className="border border-gray-200 rounded-md p-8 text-center">
          <p className="text-sm font-semibold text-gray-900 mb-1">No receivers yet</p>
          <p className="text-sm text-gray-500">Add your first receiver to get started.</p>
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
                      style={
                        header.column.getSize() !== 150
                          ? { width: header.column.getSize() }
                          : undefined
                      }
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
        <ReceiverModal
          receiver={modalTarget === 'create' ? null : modalTarget}
          onClose={() => setModalTarget(null)}
        />
      )}
    </div>
  );
}
