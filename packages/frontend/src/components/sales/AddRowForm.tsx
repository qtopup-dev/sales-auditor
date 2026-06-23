import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import AsyncSelect from 'react-select/async';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/axios';
import { useSalesEditStore } from '../../stores/salesEditStore';

interface AddRowFormProps {
  onSaveSuccess: () => void;
}

type AddRowFormData = {
  productId: number | null;
  mopId: number | null;
  receiver: string;
  notes: string;
};

export function AddRowForm({ onSaveSuccess }: AddRowFormProps) {
  const queryClient = useQueryClient();
  const { closeAddRow } = useSalesEditStore();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<AddRowFormData>({
    defaultValues: { productId: null, mopId: null, receiver: '', notes: '' },
  });

  const [priceDisplay, setPriceDisplay] = useState<string>('—');

  const watchedProductId = watch('productId');
  const watchedMopId = watch('mopId');
  const watchedReceiver = watch('receiver');
  const isFormValid =
    watchedProductId !== null && watchedMopId !== null && watchedReceiver.trim() !== '';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAddRow();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeAddRow]);

  const loadProducts = async (inputValue: string) => {
    const res = await api.get<Array<{ id: number; name: string; price: string }>>('/products');
    return res.data
      .filter((p) => p.name.toLowerCase().includes(inputValue.toLowerCase()))
      .map((p) => ({ value: p.id, label: p.name, price: p.price }));
  };

  const loadMops = async (inputValue: string) => {
    const res = await api.get<Array<{ id: number; name: string }>>('/mops');
    return res.data
      .filter((m) => m.name.toLowerCase().includes(inputValue.toLowerCase()))
      .map((m) => ({ value: m.id, label: m.name }));
  };

  const createMutation = useMutation({
    mutationFn: (data: AddRowFormData) => api.post('/sales', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      closeAddRow();
      onSaveSuccess();
    },
  });

  const isPending = createMutation.isPending;

  return (
    <form
      onSubmit={handleSubmit((data) => createMutation.mutate(data))}
      className="w-full"
    >
      <div className="flex items-start px-0 py-2 gap-0 w-full">
        {/* Product (200px) */}
        <div style={{ width: '200px', padding: '0 16px', flexShrink: 0 }}>
          <Controller
            name="productId"
            control={control}
            rules={{ required: 'Product is required' }}
            render={({ field }) => (
              <AsyncSelect
                loadOptions={loadProducts}
                defaultOptions
                cacheOptions
                menuPortalTarget={document.body}
                menuPosition="fixed"
                isDisabled={isPending}
                placeholder="Select product..."
                styles={{
                  control: (base) => ({
                    ...base,
                    minHeight: '36px',
                    fontSize: '14px',
                    borderColor: errors.productId ? '#ef4444' : base.borderColor,
                  }),
                  menu: (base) => ({ ...base, zIndex: 9999 }),
                }}
                onChange={(option) => {
                  field.onChange(option?.value ?? null);
                  setPriceDisplay(option ? (option as { value: number; label: string; price: string }).price : '—');
                }}
                value={null}
              />
            )}
          />
        </div>

        {/* Price (100px) — read-only auto-populated */}
        <div
          style={{ width: '100px', padding: '0 16px', flexShrink: 0 }}
          className="flex items-center justify-end"
        >
          <span className="block text-right text-sm font-normal text-gray-400 pt-2">
            {priceDisplay}
          </span>
        </div>

        {/* MOP (180px) */}
        <div style={{ width: '180px', padding: '0 16px', flexShrink: 0 }}>
          <Controller
            name="mopId"
            control={control}
            rules={{ required: 'MOP is required' }}
            render={({ field }) => (
              <AsyncSelect
                loadOptions={loadMops}
                defaultOptions
                cacheOptions
                menuPortalTarget={document.body}
                menuPosition="fixed"
                isDisabled={isPending}
                placeholder="Select MOP..."
                styles={{
                  control: (base) => ({
                    ...base,
                    minHeight: '36px',
                    fontSize: '14px',
                    borderColor: errors.mopId ? '#ef4444' : base.borderColor,
                  }),
                  menu: (base) => ({ ...base, zIndex: 9999 }),
                }}
                onChange={(option) => field.onChange(option?.value ?? null)}
                value={null}
              />
            )}
          />
        </div>

        {/* Receiver (160px) */}
        <div style={{ width: '160px', padding: '0 16px', flexShrink: 0 }}>
          <input
            type="text"
            disabled={isPending}
            placeholder="Receiver name"
            {...register('receiver', { required: 'Receiver is required' })}
            className={`h-9 w-full border rounded-md px-3 text-sm font-normal focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100 ${
              errors.receiver
                ? 'border-red-500'
                : 'border-gray-300 focus:border-blue-500'
            }`}
          />
        </div>

        {/* Notes (flex-1) */}
        <div style={{ flex: 1, padding: '0 16px', minWidth: '160px' }}>
          <textarea
            disabled={isPending}
            placeholder="Notes (optional)"
            rows={2}
            {...register('notes')}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-normal focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-100 resize-none"
          />
        </div>

        {/* Date Edited (140px) — empty on new row */}
        <div
          style={{ width: '140px', padding: '0 16px', flexShrink: 0 }}
          className="flex items-center"
        >
          <span className="text-sm font-normal text-gray-400">—</span>
        </div>

        {/* Actions (120px) */}
        <div
          style={{ width: '120px', padding: '0 16px', flexShrink: 0 }}
          className="flex flex-col gap-1 items-start"
        >
          <button
            type="submit"
            disabled={isPending || !isFormValid}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Saving...' : 'Save Row'}
          </button>
          <button
            type="button"
            onClick={closeAddRow}
            disabled={isPending}
            className="px-3 py-1.5 text-gray-600 text-sm font-normal hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Discard
          </button>
        </div>
      </div>

      {createMutation.isError && (
        <p className="text-xs font-normal text-red-600 px-4 pb-1">
          Failed to save. Please try again.
        </p>
      )}
    </form>
  );
}
