import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';

// UI-SPEC.md §UserModal — username edit modal
// USERS-03: admin edits any user's username
// D-20/D-21: validates 2–100 chars; inline 409 USERNAME_TAKEN error
// Pattern: ProductModal.tsx — react-hook-form v7, Modal wrapper, isPending blocks close

interface UserModalProps {
  user: { id: number; username: string } | null; // null = modal closed
  onClose: () => void;
}

type UsernameFormData = { username: string };

export function UserModal({ user, onClose }: UserModalProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<UsernameFormData>({
    defaultValues: { username: user?.username ?? '' },
  });

  // Reset form when target user changes (switching between edit targets)
  useEffect(() => {
    reset({ username: user?.username ?? '' });
  }, [user, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: UsernameFormData) =>
      api.patch(`/users/${user!.id}/username`, { username: data.username }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err: unknown) => {
      // D-21: inline error in modal form — not a page-level alert
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError('username', { message: 'Username already taken.' });
      }
    },
  });

  const isPending = updateMutation.isPending;

  const onSubmit = (data: UsernameFormData) => {
    updateMutation.mutate(data);
  };

  if (!user) return null;

  return (
    <Modal
      open
      onClose={isPending ? undefined : onClose}
      title="Edit User"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Discard Changes
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={isPending}
            className="px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Saving Username...' : 'Save Username'}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label htmlFor="username" className="text-sm font-normal text-gray-500 dark:text-gray-400 block mb-1">
            Username
          </label>
          <input
            id="username"
            type="text"
            disabled={isPending}
            {...register('username', {
              required: 'Username is required.',
              minLength: { value: 2, message: 'Username must be at least 2 characters.' },
              maxLength: { value: 100, message: 'Username must be 100 characters or fewer.' },
            })}
            className={`w-full border rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              errors.username
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            }`}
          />
          {errors.username && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.username.message}</p>
          )}
        </div>
      </form>
    </Modal>
  );
}
