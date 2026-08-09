import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';
import { useSalesEditStore } from '../../stores/salesEditStore';

type VoidRequestFormData = { reason: string };

// Moderator-facing "Void Request" reason-entry dialog — models VoidConfirmDialog.tsx's
// Modal + useMutation + pessimistic-disable structure, with a react-hook-form textarea
// swapped in (ProductModal.tsx's register + inline errors.<field>.message idiom).
// Per CONTEXT.md D-01/D-02 and CLAUDE.md Rule 9: all gating here is UI convenience only —
// the backend re-derives ownership, active status and one-pending-per-row server-side.
export function VoidRequestDialog() {
  const queryClient = useQueryClient();
  const { isVoidRequestDialogOpen, voidRequestTargetSaleId, closeVoidRequestDialog } =
    useSalesEditStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<VoidRequestFormData>({ defaultValues: { reason: '' } });

  const mutation = useMutation({
    mutationFn: ({ saleId, reason }: { saleId: number; reason: string }) =>
      api.post('/void-requests', { saleId, reason }).then((r) => r.data),
    onSuccess: () => {
      // Creating a request changes nothing about the sale row itself — only the
      // pending-sale-ids gate needs to refresh, so ['sales'] is deliberately not invalidated.
      queryClient.invalidateQueries({ queryKey: ['void-request-pending-sale-ids'] });
      reset();
      closeVoidRequestDialog();
    },
  });

  const isPending = mutation.isPending;

  const handleClose = () => {
    reset();
    closeVoidRequestDialog();
  };

  const onSubmit = (data: VoidRequestFormData) => {
    if (voidRequestTargetSaleId !== null) {
      mutation.mutate({ saleId: voidRequestTargetSaleId, reason: data.reason });
    }
  };

  // Narrow the unknown mutation error to an object exposing an axios-shaped response.status
  const axiosError = mutation.error as { response?: { status?: number } } | null;
  const isDuplicatePending = axiosError?.response?.status === 409;

  return (
    <Modal
      open={isVoidRequestDialogOpen}
      onClose={isPending ? undefined : handleClose}
      title="Void Request"
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm font-normal hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSubmit(onSubmit)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Submitting...' : 'Submit Request'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <label htmlFor="void-request-reason" className="text-sm text-gray-500 block mb-1">
          Reason for Void Request
        </label>
        <textarea
          id="void-request-reason"
          rows={3}
          disabled={isPending}
          placeholder="Explain why this row should be voided..."
          {...register('reason', { required: 'Reason is required' })}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {errors.reason && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.reason.message}</p>
        )}
        {mutation.isError && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            {isDuplicatePending
              ? 'A void request for this row is already pending.'
              : 'Failed to submit void request. Please try again.'}
          </p>
        )}
      </form>
    </Modal>
  );
}
