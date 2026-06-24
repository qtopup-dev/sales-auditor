import { useQuery } from '@tanstack/react-query';
import type { Sale } from '@alejinput/shared';
import { api } from '../lib/axios';
import { useSalesEditStore } from '../stores/salesEditStore';
import { useAuthStore } from '../stores/authStore';
import { SalesTable } from '../components/sales/SalesTable';
import { AuditDrawer } from '../components/sales/AuditDrawer';
import { VoidConfirmDialog } from '../components/sales/VoidConfirmDialog';

export function SalesPage() {
  const { user } = useAuthStore();
  const { isAddRowOpen, openAddRow } = useSalesEditStore();

  const { data: sales = [], isLoading, isError } = useQuery<Sale[]>({
    queryKey: ['sales'],
    queryFn: () => api.get<Sale[]>('/sales').then((r) => r.data),
  });

  // Pre-fetch catalog data to warm React Query cache before Add Row is opened (D-07)
  // Results are not used as props — cache warming only (D-08)
  useQuery<Array<{ id: number; name: string; price: string }>>({
    queryKey: ['catalog-products'],
    queryFn: () => api.get('/catalog/products').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['catalog-mops'],
    queryFn: () => api.get('/catalog/mops').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  return (
    // flex flex-col h-full fills the main content area height
    // AuthenticatedLayout main is `overflow-auto p-8` — this div is inside that
    <div className="flex flex-col h-full">
      {/* Page header row */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Sales Sheet</h1>
        <button
          type="button"
          disabled={isAddRowOpen}
          onClick={openAddRow}
          className="px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Row
        </button>
      </div>

      {/* Table container — flex-1 min-h-0 critical for Firefox; overflow-hidden for virtualizer */}
      <div className="flex-1 min-h-0 border border-gray-200 rounded-md overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm font-normal text-gray-500">Loading sales...</p>
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm font-normal text-gray-500">
              Failed to load sales. Please refresh the page.
            </p>
          </div>
        ) : sales.length === 0 && !isAddRowOpen ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-sm font-semibold text-gray-900">No sales yet</p>
            <p className="text-sm font-normal text-gray-500">
              Click &apos;Add Row&apos; to enter the first sale.
            </p>
          </div>
        ) : (
          <SalesTable sales={sales} />
        )}
      </div>

      {/* Overlays — rendered regardless of loading state; controlled by salesEditStore */}
      {user?.role === 'admin' && <AuditDrawer />}
      <VoidConfirmDialog />
    </div>
  );
}
