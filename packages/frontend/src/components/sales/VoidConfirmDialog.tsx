import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';
import { useSalesEditStore } from '../../stores/salesEditStore';

export function VoidConfirmDialog() {
  const queryClient = useQueryClient();
  const { isVoidDialogOpen, voidTargetSaleId, closeVoidDialog } = useSalesEditStore();

  const voidMutation = useMutation({
    mutationFn: (saleId: number) =>
      api.post(`/sales/${saleId}/void`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      // Invalidate admin-summary so DashboardPage stats refresh after a void.
      // No-op on SalesPage where admin-summary has no active observer.
      queryClient.invalidateQueries({ queryKey: ['admin-summary'] });
      closeVoidDialog();
    },
  });

  const isPending = voidMutation.isPending;

  return (
    <Modal
      open={isVoidDialogOpen}
      onClose={isPending ? undefined : closeVoidDialog}
      title="Void Row"
      footer={
        <>
          <button
            type="button"
            onClick={closeVoidDialog}
            disabled={isPending}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm font-normal hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Keep Row
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => voidTargetSaleId !== null && voidMutation.mutate(voidTargetSaleId)}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-normal hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Voiding...' : 'Void Row'}
          </button>
        </>
      }
    >
      <p className="text-sm font-normal text-gray-900 dark:text-gray-100">
        Are you sure you want to void this row? This action cannot be undone.
      </p>
      {voidMutation.isError && (
        <p className="text-sm font-normal text-red-600 dark:text-red-400 mt-2">
          Failed to void row. Please try again.
        </p>
      )}
    </Modal>
  );
}
