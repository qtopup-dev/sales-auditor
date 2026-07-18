import { useEffect, useRef, useState } from 'react';
import { useReactTable, getCoreRowModel, getPaginationRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import type { Sale } from '@alejinput/shared';
import { useAuthStore } from '../../stores/authStore';
import { useSalesEditStore } from '../../stores/salesEditStore';
import { AddRowForm } from './AddRowForm';
import { EditableCell } from './EditableCell';
import { PaginationFooter, type PageSizeOption } from '../PaginationFooter';

const columns: ColumnDef<Sale>[] = [
  {
    accessorKey: 'productNameSnapshot',
    header: 'Product',
    size: 200,
    cell: ({ row }) => {
      const sale = row.original;
      return <EditableCell sale={sale} field="productId" displayValue={sale.productNameSnapshot} />;
    },
  },
  {
    accessorKey: 'priceSnapshot',
    header: () => <span className="block text-right">Price</span>,
    size: 100,
    cell: ({ row }) => {
      const sale = row.original;
      return (
        <span className={`block text-right text-sm font-normal ${sale.status === 'void' ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
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
      const sale = row.original;
      return <EditableCell sale={sale} field="mopId" displayValue={sale.mopNameSnapshot} />;
    },
  },
  {
    accessorKey: 'receiverNameSnapshot',
    header: 'Receiver',
    size: 160,
    cell: ({ row }) => {
      const sale = row.original;
      return <EditableCell sale={sale} field="receiverId" displayValue={sale.receiverNameSnapshot} />;
    },
  },
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
  {
    id: 'actions',
    header: () => <span className="block text-center">Actions</span>,
    size: 120,
    cell: ({ row }) => {
      const sale = row.original;
      const { openVoidDialog, openAuditDrawer } = useSalesEditStore.getState();
      const { user } = useAuthStore.getState();
      const isAdmin = user?.role === 'admin';
      const isVoided = sale.status === 'void';
      return (
        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          {isAdmin && !isVoided && (
            <button type="button" onClick={() => openVoidDialog(sale.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-normal min-h-[44px] px-1">
              Void
            </button>
          )}
          {isAdmin && !isVoided && <span className="text-gray-300 dark:text-gray-600">|</span>}
          {isVoided && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-normal bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">Void</span>
          )}
          {isAdmin && (
            <button type="button" onClick={() => openAuditDrawer(sale.id)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-normal min-h-[44px] px-1">
              Audit
            </button>
          )}
        </div>
      );
    },
  },
];

export function SalesTable({ sales }: { sales: Sale[] }) {
  const isAddRowOpen = useSalesEditStore((s) => s.isAddRowOpen);

  // Table stretches to fill its container (w-full), so declared column `size` values
  // (used for the initial layout ratio) don't match the actual rendered pixel widths.
  // Measure the real <th> widths so AddRowForm's fields can match them exactly,
  // re-measuring on resize since table-layout: fixed redistributes width proportionally.
  const headerRowRef = useRef<HTMLTableRowElement>(null);
  const [columnWidths, setColumnWidths] = useState<number[] | null>(null);

  useEffect(() => {
    const headerRow = headerRowRef.current;
    if (!headerRow) return;

    const measure = () => {
      const widths = Array.from(headerRow.children).map((th) => th.getBoundingClientRect().width);
      setColumnWidths(widths);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(headerRow);
    return () => observer.disconnect();
  }, []);

  const [pageSizeOption, setPageSizeOption] = useState<PageSizeOption>(25);
  const [pageIndex, setPageIndex] = useState(0);
  const effectivePageSize = pageSizeOption === 'all' ? Math.max(sales.length, 1) : pageSizeOption;
  const effectivePageIndex = pageSizeOption === 'all' ? 0 : pageIndex;

  const handlePageSizeChange = (size: PageSizeOption) => {
    setPageSizeOption(size);
    setPageIndex(0);
  };

  const table = useReactTable({
    data: sales,
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

  const handleSaveSuccess = () => setPageIndex(0);

  return (
    <div className="flex flex-col h-full">
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full border-collapse" style={{ minWidth: '1060px', tableLayout: 'fixed' }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} ref={headerRowRef} className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-sm font-normal text-gray-500 dark:text-gray-400 text-left" style={{ width: header.column.getSize() }}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isAddRowOpen && (
              <tr className="bg-gray-100 dark:bg-gray-800 border-b border-blue-200 dark:border-blue-900">
                <td colSpan={columns.length} className="p-0">
                  <AddRowForm onSaveSuccess={handleSaveSuccess} columnWidths={columnWidths} />
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => {
              const sale = row.original;
              const isVoidedRow = sale.status === 'void';
              return (
                <tr
                  key={row.id}
                  className={
                    isVoidedRow
                      ? 'bg-red-50 dark:bg-red-950 border-b border-gray-200 dark:border-gray-700 hover:bg-red-100 dark:hover:bg-red-900'
                      : 'bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100"
                      style={{ width: cell.column.getSize() }}
                      onClick={cell.column.id === 'actions' ? (e) => e.stopPropagation() : undefined}
                    >
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
        totalRows={sales.length}
        onPageSizeChange={handlePageSizeChange}
        canPrev={table.getCanPreviousPage()}
        canNext={table.getCanNextPage()}
        onPrev={() => table.previousPage()}
        onNext={() => table.nextPage()}
      />
    </div>
  );
}
