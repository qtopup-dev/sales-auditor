import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';
import { useShiftStore } from '../../stores/shiftStore';

export function ForceClockOutConfirmDialog() {
  const queryClient = useQueryClient();
  const { isForceClockOutDialogOpen, forceClockOutTarget, closeForceClockOutDialog } = useShiftStore();

  const forceClockOutMutation = useMutation({
    mutationFn: (shiftId: number) =>
      api.post(`/admin/shifts/${shiftId}/force-clock-out`, {}).then((r) => r.data),
    onSuccess: () => {
      // Broad invalidate covers every selectedDate key the AdminShiftsPage query uses.
      queryClient.invalidateQueries({ queryKey: ['admin-shifts'] });
      closeForceClockOutDialog();
    },
  });

  const isPending = forceClockOutMutation.isPending;

  return (
    <Modal
      open={isForceClockOutDialogOpen}
      onClose={isPending ? undefined : closeForceClockOutDialog}
      title="Force Clock Out"
      footer={
        <>
          <button
            type="button"
            onClick={closeForceClockOutDialog}
            disabled={isPending}
            className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-md text-sm font-normal hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Keep Shift Open
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => forceClockOutTarget && forceClockOutMutation.mutate(forceClockOutTarget.shiftId)}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-normal hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Forcing Clock Out...' : 'Force Clock Out'}
          </button>
        </>
      }
    >
      <p className="text-sm font-normal text-gray-900">
        Force clock out {forceClockOutTarget?.username}? Their shift will end immediately and their Sales Sheet will
        reset. This does not affect their sales data — all rows remain intact.
      </p>
      {forceClockOutMutation.isError && (
        <p className="text-sm font-normal text-red-600 mt-2">Failed to force clock out. Please try again.</p>
      )}
    </Modal>
  );
}
