import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';
import type { Mop } from '@alejinput/shared';

interface MopDeleteConfirmDialogProps {
  mop: Mop | null; // null = dialog closed
  onClose: () => void;
}

// Delete confirm dialog per 09-UI-SPEC.md — see ProductDeleteConfirmDialog.tsx for the identical
// structural rationale (props-based target, modeled on VoidConfirmDialog.tsx).
export function MopDeleteConfirmDialog({ mop, onClose }: MopDeleteConfirmDialogProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (mopId: number) => api.delete(`/mops/${mopId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mops'] });
      onClose();
    },
  });

  const isPending = deleteMutation.isPending;

  return (
    <Modal
      open={mop !== null}
      onClose={isPending ? undefined : onClose}
      title="Delete MOP"
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
            onClick={() => mop && deleteMutation.mutate(mop.id)}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-normal hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Deleting...' : 'Delete MOP'}
          </button>
        </>
      }
    >
      <p className="text-sm font-normal text-gray-900 dark:text-gray-100">
        Are you sure you want to delete this mode of payment? This cannot be undone.
      </p>
      {deleteMutation.isError && (
        <p className="text-sm font-normal text-red-600 dark:text-red-400 mt-2">
          Failed to delete this mode of payment. Please try again.
        </p>
      )}
    </Modal>
  );
}
