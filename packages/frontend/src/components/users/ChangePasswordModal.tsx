import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';

// Phase 8 — self-service Change Password modal (D-03/D-04/D-05/D-07/D-08).
// Two fields only: New Password + Confirm New Password. No current-password field (D-03).
// Confirm-match is a CLIENT-ONLY check — only newPassword is sent to the server (D-05).
// On success: swap body to a success message and footer to a single "Done" button (D-07, no auto-close).

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

type ChangePasswordFormData = {
  newPassword: string;
  confirmNewPassword: string;
};

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>();
  const newPassword = watch('newPassword');

  const mutation = useMutation({
    // Only newPassword crosses the wire — confirmNewPassword never leaves the client (D-05).
    mutationFn: (data: ChangePasswordFormData) =>
      api.post('/auth/change-password', { newPassword: data.newPassword }).then((r) => r.data),
    onSuccess: () => setSuccess(true),
  });

  const isPending = mutation.isPending;
  const showServerError = mutation.isError; // 400/500 — surfaced as generic copy (D-08)

  const onSubmit = (data: ChangePasswordFormData) => mutation.mutate(data);

  // Component stays mounted between opens (parent always renders it) — reset on close
  // so a stale success/error screen and old field values don't reappear on reopen.
  useEffect(() => {
    if (!open) {
      setSuccess(false);
      reset();
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <Modal
      open
      // Blocked only during the in-flight save. Freely closeable once success is shown (D-07/Rule 10).
      onClose={isPending ? undefined : onClose}
      title="Change Password"
      footer={
        success ? (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Done
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="change-password-form"
              disabled={isPending}
              className="px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Saving Password...' : 'Save Password'}
            </button>
          </>
        )
      }
    >
      {success ? (
        <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
          Your password has been changed. You&apos;ve been signed out of all other active sessions.
        </p>
      ) : (
        <form id="change-password-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="mb-4">
            <label htmlFor="new-password" className="text-sm font-normal text-gray-500 dark:text-gray-400 block mb-1">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              disabled={isPending}
              {...register('newPassword', {
                required: 'New password is required.',
                minLength: { value: 8, message: 'Password must be at least 8 characters.' },
              })}
              className={`w-full border rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.newPassword
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
              }`}
            />
            {errors.newPassword && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirm-new-password" className="text-sm font-normal text-gray-500 dark:text-gray-400 block mb-1">
              Confirm New Password
            </label>
            <input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              disabled={isPending}
              {...register('confirmNewPassword', {
                required: 'Please confirm your new password.',
                validate: (value) => value === newPassword || 'Passwords do not match.',
              })}
              className={`w-full border rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.confirmNewPassword
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
              }`}
            />
            {errors.confirmNewPassword && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.confirmNewPassword.message}</p>
            )}
          </div>

          {showServerError && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">Something went wrong. Please try again.</p>
          )}
        </form>
      )}
    </Modal>
  );
}
