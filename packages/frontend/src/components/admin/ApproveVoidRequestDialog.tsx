// UI-SPEC.md §Approve confirm dialog — direct clone of VoidConfirmDialog.tsx's
// pessimistic-UI pattern (Modal + useMutation + disabled Cancel/primary during round-trip),
// but prop-driven (request/onClose) rather than store-driven since there is no Zustand slot
// for it and the admin page owns the approve target.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';
import type { VoidRequestWithSale } from '@alejinput/shared';

interface ApproveVoidRequestDialogProps {
  request: VoidRequestWithSale | null;
  onClose: () => void;
}

export function ApproveVoidRequestDialog({ request, onClose }: ApproveVoidRequestDialogProps) {
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: (id: number) =>
      // Empty body required: some proxy layers in the deploy chain mishandle bodyless PATCH requests
      api.patch(`/void-requests/${id}/approve`, {}).then((r) => r.data),
    onSuccess: () => {
      // Approve voids a real sale row, so the moderator's sheet, the badge and the
      // dashboard totals are all stale, in addition to the void-requests list itself.
      queryClient.invalidateQueries({ queryKey: ['void-requests'] });
      queryClient.invalidateQueries({ queryKey: ['void-requests-pending-count'] });
      queryClient.invalidateQueries({ queryKey: ['void-request-pending-sale-ids'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['admin-summary'] });
      onClose();
    },
  });

  const isPending = approveMutation.isPending;

  return (
    <Modal
      open={request !== null}
      onClose={isPending ? undefined : onClose}
      title="Approve Void Request"
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
            onClick={() => request !== null && approveMutation.mutate(request.id)}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-normal hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Approving...' : 'Approve & Void Row'}
          </button>
        </>
      }
    >
      <p className="text-sm font-normal text-gray-900 dark:text-gray-100">
        Approving will void this sale row immediately. This cannot be undone.
      </p>
      {approveMutation.isError && (
        <p className="text-sm font-normal text-red-600 dark:text-red-400 mt-2">
          Failed to approve request. Please try again.
        </p>
      )}
    </Modal>
  );
}
