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
import { ProductModal } from '../components/catalog/ProductModal';
import { ProductDeleteConfirmDialog } from '../components/catalog/ProductDeleteConfirmDialog';
import type { Product } from '@alejinput/shared';

// PROD-04: admin views all products (active + inactive)
// PROD-01/02: create/edit via ProductModal
// PROD-03: toggle active/inactive via Deactivate/Activate button
// PROD-06/07: product entity with name, price, status columns
export function ProductsPage() {
  const queryClient = useQueryClient();

  // Modal state — null = closed, 'create' = create mode, Product = edit mode
  const [modalTarget, setModalTarget] = useState<Product | 'create' | null>(null);
  // Track which product's toggle is in-flight (pessimistic per-row — CLAUDE.md Rule 10)
  const [pendingToggleId, setPendingToggleId] = useState<number | null>(null);
  // Delete confirm dialog target — separate from modalTarget so Edit and Delete never collide
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products').then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (productId: number) => {
      setPendingToggleId(productId);
      // Empty body required: some proxy layers in the deploy chain mishandle bodyless PATCH requests
      return api.patch<Product>(`/products/${productId}/toggle`, {}).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setPendingToggleId(null);
    },
    onError: () => setPendingToggleId(null),
  });

  // @tanstack/react-table v8 column definitions per UI-SPEC.md §Products Catalog Page
  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ getValue }) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: 'price',
      header: () => <span className="block text-right">Price</span>,
      cell: ({ getValue }) => (
        <span className="block text-right text-sm text-gray-900 dark:text-gray-100">{getValue<string>()}</span>
      ),
      size: 120,
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
        const product = row.original;
        const isThisTogglePending = pendingToggleId === product.id;
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setModalTarget(product)}
              disabled={isThisTogglePending}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Edit
            </button>
            <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
            <button
              type="button"
              disabled={isThisTogglePending}
              onClick={() => toggleMutation.mutate(product.id)}
              className={`text-sm ${
                isThisTogglePending
                  ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {product.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
            <button
              type="button"
              disabled={isThisTogglePending}
              onClick={() => setDeleteTarget(product)}
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

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Products</h1>
        <button
          type="button"
          onClick={() => setModalTarget('create')}
          className="px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          Add Product
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : products.length === 0 ? (
        /* Empty state — UI-SPEC.md Copywriting Contract */
        <div className="border border-gray-200 dark:border-gray-700 rounded-md p-8 text-center">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">No products yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Add your first product to get started.</p>
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[560px]">
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
                        // Prevent row click from opening modal when clicking action buttons
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

      {/* Product create/edit modal */}
      {modalTarget !== null && (
        <ProductModal
          product={modalTarget === 'create' ? null : modalTarget}
          onClose={() => setModalTarget(null)}
        />
      )}

      {/* Product delete confirm dialog */}
      <ProductDeleteConfirmDialog product={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
