import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';

interface UserDeleteConfirmDialogProps {
  user: { id: number; username: string } | null; // null = dialog closed
  onClose: () => void;
}

// D-08/D-09: map the two User-specific safeguard error codes to their exact UI-SPEC copy;
// any other/unknown error falls back to the generic message.
function getErrorMessage(err: unknown): string {
  const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  if (code === 'CANNOT_DELETE_SELF') return 'You cannot delete your own account.';
  if (code === 'LAST_ADMIN') return 'Cannot delete the last remaining admin.';
  return 'Failed to delete user. Please try again.';
}

// Delete confirm dialog per 09-UI-SPEC.md — modeled on VoidConfirmDialog.tsx's structure
// (Modal + useMutation + pessimistic pending state), props-based target like
// ProductDeleteConfirmDialog/MopDeleteConfirmDialog. Uses the minimal { id, username } shape,
// matching the existing UserModal.tsx convention rather than importing a full User type.
export function UserDeleteConfirmDialog({ user, onClose }: UserDeleteConfirmDialogProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => api.delete(`/users/${userId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  const isPending = deleteMutation.isPending;

  return (
    <Modal
      open={user !== null}
      onClose={isPending ? undefined : onClose}
      title="Delete User"
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
            onClick={() => user && deleteMutation.mutate(user.id)}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-normal hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Deleting...' : 'Delete User'}
          </button>
        </>
      }
    >
      <p className="text-sm font-normal text-gray-900 dark:text-gray-100">
        Are you sure you want to delete this user? This cannot be undone.
      </p>
      {deleteMutation.isError && (
        <p className="text-sm font-normal text-red-600 dark:text-red-400 mt-2">
          {getErrorMessage(deleteMutation.error)}
        </p>
      )}
    </Modal>
  );
}
