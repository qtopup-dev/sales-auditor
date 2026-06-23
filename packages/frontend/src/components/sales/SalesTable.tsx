import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import type { Sale } from '@alejinput/shared';
import { useAuthStore } from '../../stores/authStore';
import { useSalesEditStore } from '../../stores/salesEditStore';
import { AddRowForm } from './AddRowForm';

// Stub replaced by Plan 06 — EditableCell is not yet built
function EditableCell({
  sale,
  field,
  displayValue,
}: {
  sale: Sale;
  field: string;
  displayValue: string;
}) {
  const isVoided = sale.status === 'void';
  return (
    <span
      className={`text-sm font-normal ${isVoided ? 'line-through text-gray-400' : 'text-gray-900'}`}
    >
      {displayValue}
    </span>
  );
}

type TableRow = Sale | { isNewRow: true };

function isNewRowGuard(row: TableRow): row is { isNewRow: true } {
  return 'isNewRow' in row && (row as { isNewRow: true }).isNewRow === true;
}

const columns: ColumnDef<TableRow>[] = [
  {
    accessorKey: 'productNameSnapshot',
    header: 'Product',
    size: 200,
    cell: ({ row }) => {
      if (isNewRowGuard(row.original)) return null;
      const sale = row.original as Sale;
      return <EditableCell sale={sale} field="productId" displayValue={sale.productNameSnapshot} />;
    },
  },
  {
    accessorKey: 'priceSnapshot',
    header: () => <span className="block text-right">Price</span>,
    size: 100,
    cell: ({ row }) => {
      if (isNewRowGuard(row.original)) return null;
      const sale = row.original as Sale;
      return (
        <span
          className={`block text-right text-sm font-normal ${sale.status === 'void' ? 'line-through text-gray-400' : 'text-gray-400'}`}
        >
          {sale.priceSnapshot}
        </span>
      );
    },
  },
  {
    accessorKey: 'mopNameSnapshot',
    header: 'Mode of Payment',
    size: 180,
    cell: ({ row }) => {
      if (isNewRowGuard(row.original)) return null;
      const sale = row.original as Sale;
      return <EditableCell sale={sale} field="mopId" displayValue={sale.mopNameSnapshot} />;
    },
  },
  {
    accessorKey: 'receiver',
    header: 'Receiver',
    size: 160,
    cell: ({ row }) => {
      if (isNewRowGuard(row.original)) return null;
      const sale = row.original as Sale;
      return <EditableCell sale={sale} field="receiver" displayValue={sale.receiver} />;
    },
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
    size: 160,
    cell: ({ row }) => {
      if (isNewRowGuard(row.original)) return null;
      const sale = row.original as Sale;
      return <EditableCell sale={sale} field="notes" displayValue={sale.notes ?? ''} />;
    },
  },
  {
    accessorKey: 'updatedAt',
    header: 'Date Edited',
    size: 140,
    cell: ({ row }) => {
      if (isNewRowGuard(row.original)) return null;
      const sale = row.original as Sale;
      const label = sale.lastEditedById
        ? sale.updatedAt.replace('T', ' ').slice(0, 16)
        : '—';
      return (
        <span
          className={`text-sm font-normal ${sale.status === 'void' ? 'line-through text-gray-400' : 'text-gray-400'}`}
        >
          {label}
        </span>
      );
    },
  },
  {
    id: 'actions',
    header: () => <span className="block text-center">Actions</span>,
    size: 120,
    cell: ({ row }) => {
      if (isNewRowGuard(row.original)) return null;
      const sale = row.original as Sale;
      const { openVoidDialog, openAuditDrawer } = useSalesEditStore.getState();
      const { user } = useAuthStore.getState();
      const isAdmin = user?.role === 'admin';
      const isVoided = sale.status === 'void';

      return (
        <div
          className="flex items-center justify-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {isAdmin && !isVoided && (
            <button
              type="button"
              onClick={() => openVoidDialog(sale.id)}
              className="text-red-600 hover:text-red-800 text-sm font-normal min-h-[44px] px-1"
            >
              Void
            </button>
          )}
          {isAdmin && !isVoided && <span className="text-gray-300">|</span>}
          {isVoided && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-normal bg-red-100 text-red-700">
              Void
            </span>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => openAuditDrawer(sale.id)}
              className="text-blue-600 hover:text-blue-800 text-sm font-normal min-h-[44px] px-1"
            >
              Audit
            </button>
          )}
        </div>
      );
    },
  },
];

export function SalesTable({ sales }: { sales: Sale[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { isAddRowOpen } = useSalesEditStore();

  const rows: TableRow[] = isAddRowOpen
    ? [{ isNewRow: true as const }, ...sales]
    : sales;

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows: tableRows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    measureElement:
      typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
        ? (el) => el?.getBoundingClientRect().height
        : undefined,
    overscan: 3,
  });

  return (
    <div ref={parentRef} className="overflow-auto h-full">
      <table className="w-full border-collapse" style={{ minWidth: '1160px' }}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10"
            >
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-sm font-normal text-gray-500 text-left"
                  style={{ width: header.column.getSize() }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          <tr style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const row = tableRows[virtualItem.index];
              const originalRow = row.original;
              const isVoidedRow =
                !isNewRowGuard(originalRow) && (originalRow as Sale).status === 'void';
              const isAddRow = isNewRowGuard(originalRow);

              return (
                <tr
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className={
                    isAddRow
                      ? 'bg-gray-100 border-b border-blue-200'
                      : isVoidedRow
                      ? 'bg-red-50 border-b border-gray-200 hover:bg-red-100'
                      : 'bg-white border-b border-gray-200 hover:bg-gray-50'
                  }
                >
                  {isAddRow ? (
                    <td colSpan={columns.length} className="p-0">
                      <AddRowForm
                        onSaveSuccess={() => virtualizer.scrollToIndex(0, { align: 'start' })}
                      />
                    </td>
                  ) : (
                    row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-2 text-sm text-gray-900"
                        style={{ width: cell.column.getSize() }}
                        onClick={
                          cell.column.id === 'actions' ? (e) => e.stopPropagation() : undefined
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))
                  )}
                </tr>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
