import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';
import type { Product } from '@alejinput/shared';

interface ProductDeleteConfirmDialogProps {
  product: Product | null; // null = dialog closed
  onClose: () => void;
}

// Delete confirm dialog per 09-UI-SPEC.md — modeled on VoidConfirmDialog.tsx's structure
// (Modal + useMutation + pessimistic pending state), but takes the target as a prop instead of
// reading a Zustand store (this dialog is triggered from a plain page, not a virtualized table row).
// CONTEXT.md D-01: calling DELETE sets deletedAt server-side (a stricter action than Deactivate).
export function ProductDeleteConfirmDialog({ product, onClose }: ProductDeleteConfirmDialogProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (productId: number) => api.delete(`/products/${productId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
  });

  const isPending = deleteMutation.isPending;

  return (
    <Modal
      open={product !== null}
      onClose={isPending ? undefined : onClose}
      title="Delete Product"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm font-normal hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => product && deleteMutation.mutate(product.id)}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-normal hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Deleting...' : 'Delete Product'}
          </button>
        </>
      }
    >
      <p className="text-sm font-normal text-gray-900 dark:text-gray-100">
        Are you sure you want to delete this product? This cannot be undone.
      </p>
      {deleteMutation.isError && (
        <p className="text-sm font-normal text-red-600 dark:text-red-400 mt-2">
          Failed to delete product. Please try again.
        </p>
      )}
    </Modal>
  );
}
