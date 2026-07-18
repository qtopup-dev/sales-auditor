import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';
import type { Receiver } from '@alejinput/shared';

interface ReceiverModalProps {
  receiver: Receiver | null; // null = create mode, non-null = edit mode
  onClose: () => void;
}

type ReceiverFormData = {
  name: string;
  accountNumber: string; // empty string maps to null on submit
};

// Receiver create/edit modal per UI-SPEC.md §2 Receiver Modal
// Pessimistic UI: all inputs + both buttons disabled during isPending (CLAUDE.md Rule 10)
export function ReceiverModal({ receiver, onClose }: ReceiverModalProps) {
  const queryClient = useQueryClient();
  const isEdit = receiver !== null;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ReceiverFormData>({
    defaultValues: isEdit
      ? { name: receiver.name, accountNumber: receiver.accountNumber ?? '' }
      : { name: '', accountNumber: '' },
  });

  useEffect(() => {
    reset(
      isEdit
        ? { name: receiver.name, accountNumber: receiver.accountNumber ?? '' }
        : { name: '', accountNumber: '' },
    );
  }, [receiver, isEdit, reset]);

  const createMutation = useMutation({
    mutationFn: (data: ReceiverFormData) =>
      api
        .post<Receiver>('/receivers', {
          name: data.name,
          accountNumber: data.accountNumber.trim() || null,
        })
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivers'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ReceiverFormData) =>
      api
        .patch<Receiver>(`/receivers/${receiver!.id}`, {
          name: data.name,
          accountNumber: data.accountNumber.trim() || null,
        })
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivers'] });
      onClose();
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;
  const title = isEdit ? 'Edit Receiver' : 'Add Receiver';
  const ctaLabel = isEdit ? 'Save Changes' : 'Add Receiver';

  const onSubmit = (data: ReceiverFormData) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Modal
      open
      onClose={isPending ? undefined : onClose}
      title={title}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Discard
          </button>
          <button
            type="submit"
            form="receiver-form"
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Saving...' : ctaLabel}
          </button>
        </>
      }
    >
      <form id="receiver-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Receiver Name field — required */}
        <div className="mb-4">
          <label htmlFor="receiver-name" className="text-sm text-gray-500 dark:text-gray-400 block mb-1">
            Receiver Name
          </label>
          <input
            id="receiver-name"
            type="text"
            disabled={isPending}
            {...register('name', { required: 'Receiver Name is required' })}
            className={`h-10 w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              errors.name
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            }`}
          />
          {errors.name && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.name.message}</p>
          )}
        </div>

        {/* Account Number field — optional */}
        <div>
          <label htmlFor="receiver-account" className="text-sm text-gray-500 dark:text-gray-400 block mb-1">
            Account Number (optional)
          </label>
          <input
            id="receiver-account"
            type="text"
            disabled={isPending}
            placeholder="e.g. ACC-001"
            {...register('accountNumber', {
              maxLength: { value: 100, message: 'Account Number must be 100 characters or less' },
            })}
            className={`h-10 w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              errors.accountNumber
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            }`}
          />
          {errors.accountNumber && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.accountNumber.message}</p>
          )}
        </div>

        {/* API error */}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">Something went wrong. Please try again.</p>
        )}
      </form>
    </Modal>
  );
}
