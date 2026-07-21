import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';
import type { Receiver } from '@alejinput/shared';

interface ReceiverDeleteConfirmDialogProps {
  receiver: Receiver | null; // null = dialog closed
  onClose: () => void;
}

// Delete confirm dialog — Phase 10 (mirrors Phase 9's ProductDeleteConfirmDialog.tsx structure:
// Modal + useMutation + pessimistic pending state), takes the target as a prop instead of reading a
// Zustand store. Calling DELETE sets deletedAt server-side (a stricter action than Deactivate).
export function ReceiverDeleteConfirmDialog({ receiver, onClose }: ReceiverDeleteConfirmDialogProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (receiverId: number) => api.delete(`/receivers/${receiverId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivers'] });
      onClose();
    },
  });

  const isPending = deleteMutation.isPending;

  return (
    <Modal
      open={receiver !== null}
      onClose={isPending ? undefined : onClose}
      title="Delete Receiver"
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
            onClick={() => receiver && deleteMutation.mutate(receiver.id)}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-normal hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Deleting...' : 'Delete Receiver'}
          </button>
        </>
      }
    >
      <p className="text-sm font-normal text-gray-900 dark:text-gray-100">
        Are you sure you want to delete this receiver? This cannot be undone.
      </p>
      {deleteMutation.isError && (
        <p className="text-sm font-normal text-red-600 dark:text-red-400 mt-2">
          Failed to delete receiver. Please try again.
        </p>
      )}
    </Modal>
  );
}
