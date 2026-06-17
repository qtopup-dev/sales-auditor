import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';
import type { Mop } from '@alejinput/shared';

interface MopModalProps {
  mop: Mop | null; // null = create mode, non-null = edit mode
  onClose: () => void;
}

type MopFormData = { name: string };

// MOP create/edit modal per UI-SPEC.md §MOP Modal
// PAY-01: create; PAY-02: edit
// Pessimistic UI: all inputs + both buttons disabled during isPending (CLAUDE.md Rule 10)
export function MopModal({ mop, onClose }: MopModalProps) {
  const queryClient = useQueryClient();
  const isEdit = mop !== null;

  const { register, handleSubmit, formState: { errors }, reset } = useForm<MopFormData>({
    defaultValues: isEdit ? { name: mop.name } : { name: '' },
  });

  useEffect(() => {
    reset(isEdit ? { name: mop.name } : { name: '' });
  }, [mop, isEdit, reset]);

  const createMutation = useMutation({
    mutationFn: (data: MopFormData) => api.post<Mop>('/mops', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mops'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: MopFormData) =>
      api.patch<Mop>(`/mops/${mop!.id}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mops'] });
      onClose();
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  const onSubmit = (data: MopFormData) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const title = isEdit ? 'Edit MOP' : 'Add MOP';
  const ctaLabel = isEdit ? 'Save Changes' : 'Add MOP';

  return (
    <Modal
      open
      onClose={isPending ? undefined : onClose} // blocked during save (CLAUDE.md Rule 10)
      title={title}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-md text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Discard
          </button>
          <button
            type="submit"
            form="mop-form"
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Saving...' : ctaLabel}
          </button>
        </>
      }
    >
      <form id="mop-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label htmlFor="mop-name" className="text-sm text-gray-500 block mb-1">
            Payment Method Name
          </label>
          <input
            id="mop-name"
            type="text"
            disabled={isPending}
            {...register('name', { required: 'Payment Method Name is required' })}
            className={`h-10 w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              errors.name
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }`}
          />
          {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
        </div>
        {error && (
          <p className="text-sm text-red-600 mt-1">Something went wrong. Please try again.</p>
        )}
      </form>
    </Modal>
  );
}
