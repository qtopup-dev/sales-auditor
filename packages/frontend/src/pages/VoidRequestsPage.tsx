// UI-SPEC.md §Void Requests admin page — page shell mirroring ProductsPage's header/query
// pattern; the table owns its own loading/empty branches, this page only owns the list
// query, the isError fallback (SalesPage.tsx's exact existing pattern) and the approve dialog.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { VoidRequestsTable } from '../components/admin/VoidRequestsTable';
import { ApproveVoidRequestDialog } from '../components/admin/ApproveVoidRequestDialog';
import type { VoidRequestWithSale } from '@alejinput/shared';

export function VoidRequestsPage() {
  const [approveTarget, setApproveTarget] = useState<VoidRequestWithSale | null>(null);

  // No `enabled` gate is needed because the route itself is admin-only.
  const { data: requests = [], isLoading, isError } = useQuery<VoidRequestWithSale[]>({
    queryKey: ['void-requests'],
    queryFn: () => api.get<VoidRequestWithSale[]>('/void-requests').then((r) => r.data),
  });

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Void Requests</h1>
      </div>

      {isError ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm font-normal text-gray-500 dark:text-gray-400">Failed to load void requests. Please refresh the page.</p>
        </div>
      ) : (
        <VoidRequestsTable rows={requests} loading={isLoading} onApprove={setApproveTarget} />
      )}

      {/* Approve confirm dialog — reads approveTarget from local state */}
      <ApproveVoidRequestDialog request={approveTarget} onClose={() => setApproveTarget(null)} />
    </div>
  );
}
