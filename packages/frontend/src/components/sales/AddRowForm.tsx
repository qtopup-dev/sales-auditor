import { useEffect, useState, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import AsyncSelect from 'react-select/async';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/axios';
import { makeSelectStyles } from '../../lib/selectStyles';
import { useSalesEditStore } from '../../stores/salesEditStore';

interface AddRowFormProps {
  onSaveSuccess: () => void;
  // Actual rendered <th> widths from SalesTable, in column order (Product, Price, MOP,
  // Receiver, Notes, Date Edited, Actions) — the table stretches to fill its container
  // (w-full), so these can differ from the columns' declared `size` values. Falls back to
  // the declared sizes until the first measurement lands (avoids a flash of 0-width fields).
  columnWidths: number[] | null;
}

const DEFAULT_COLUMN_WIDTHS = [200, 100, 180, 160, 160, 140, 120];

type AddRowFormData = {
  productId: number | null;
  mopId: number | null;
  receiverId: number | null;  // FK replacing free-text receiver (Phase 5)
  notes: string;
};

export function AddRowForm({ onSaveSuccess, columnWidths }: AddRowFormProps) {
  const [productW, priceW, mopW, receiverW, notesW, dateEditedW, actionsW] =
    columnWidths ?? DEFAULT_COLUMN_WIDTHS;
  const queryClient = useQueryClient();
  const closeAddRow = useSalesEditStore((s) => s.closeAddRow);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<AddRowFormData>({
    defaultValues: { productId: null, mopId: null, receiverId: null, notes: '' },
  });

  const [priceDisplay, setPriceDisplay] = useState<string>('—');

  type ProductOption = { value: number; label: string; price: string };
  type MopOption = { value: number; label: string };
  type ReceiverOption = { value: number; label: string };
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [selectedMop, setSelectedMop] = useState<MopOption | null>(null);
  const [selectedReceiver, setSelectedReceiver] = useState<ReceiverOption | null>(null);

  const watchedProductId = watch('productId');
  const watchedMopId = watch('mopId');
  const watchedReceiverId = watch('receiverId');
  const isFormValid =
    watchedProductId !== null && watchedMopId !== null && watchedReceiverId !== null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAddRow();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeAddRow]);

  const { data: cachedProducts = [], isLoading: productsLoading } =
    useQuery<Array<{ id: number; name: string; price: string }>>({
      queryKey: ['catalog-products'],
      queryFn: () => api.get('/catalog/products').then((r) => r.data),
      staleTime: 5 * 60 * 1000,
    });

  const { data: cachedMops = [], isLoading: mopsLoading } =
    useQuery<Array<{ id: number; name: string }>>({
      queryKey: ['catalog-mops'],
      queryFn: () => api.get('/catalog/mops').then((r) => r.data),
      staleTime: 5 * 60 * 1000,
    });

  const { data: cachedReceivers = [], isLoading: receiversLoading } =
    useQuery<Array<{ id: number; name: string; accountNumber: string | null }>>({
      queryKey: ['catalog-receivers'],
      queryFn: () => api.get('/catalog/receivers').then((r) => r.data),
      staleTime: 5 * 60 * 1000,
    });

  const isCatalogLoading = productsLoading || mopsLoading || receiversLoading;

  const productOptions = useMemo(
    () => cachedProducts.map((p) => ({ value: p.id, label: p.name, price: p.price })),
    [cachedProducts]
  );
  const mopOptions = useMemo(
    () => cachedMops.map((m) => ({ value: m.id, label: m.name })),
    [cachedMops]
  );
  const receiverOptions = useMemo(
    () => cachedReceivers.map((r) => ({ value: r.id, label: r.name })),
    [cachedReceivers],
  );

  const loadProducts = useCallback(
    (inputValue: string) =>
      Promise.resolve(
        productOptions.filter((p) => p.label.toLowerCase().includes(inputValue.toLowerCase()))
      ),
    [productOptions]
  );
  const loadMops = useCallback(
    (inputValue: string) =>
      Promise.resolve(
        mopOptions.filter((m) => m.label.toLowerCase().includes(inputValue.toLowerCase()))
      ),
    [mopOptions]
  );
  const loadReceivers = useCallback(
    (inputValue: string) =>
      Promise.resolve(
        receiverOptions.filter((r) => r.label.toLowerCase().includes(inputValue.toLowerCase())),
      ),
    [receiverOptions],
  );

  const createMutation = useMutation({
    mutationFn: (data: AddRowFormData) => api.post('/sales', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['current-shift'] });
      setSelectedProduct(null);
      setSelectedMop(null);
      setSelectedReceiver(null);
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
        {/* Product */}
        <div style={{ width: productW, padding: '0 16px', flexShrink: 0 }}>
          <Controller
            name="productId"
            control={control}
            rules={{ required: 'Product is required' }}
            render={({ field }) => (
              <AsyncSelect
                loadOptions={loadProducts}
                defaultOptions={productOptions}
                menuPortalTarget={document.body}
                menuPosition="fixed"
                isDisabled={isPending || isCatalogLoading}
                placeholder="Select product..."
                styles={makeSelectStyles({ nowrapValue: true, error: !!errors.productId })}
                onChange={(option) => {
                  const opt = option as ProductOption | null;
                  field.onChange(opt?.value ?? null);
                  setSelectedProduct(opt);
                  setPriceDisplay(opt ? opt.price : '—');
                }}
                value={selectedProduct}
              />
            )}
          />
        </div>

        {/* Price — read-only auto-populated */}
        <div
          style={{ width: priceW, padding: '0 16px', flexShrink: 0 }}
          className="flex items-center justify-end"
        >
          <span className="block text-right text-sm font-normal text-gray-400 pt-2">
            {priceDisplay}
          </span>
        </div>

        {/* MOP */}
        <div style={{ width: mopW, padding: '0 16px', flexShrink: 0 }}>
          <Controller
            name="mopId"
            control={control}
            rules={{ required: 'MOP is required' }}
            render={({ field }) => (
              <AsyncSelect
                loadOptions={loadMops}
                defaultOptions={mopOptions}
                menuPortalTarget={document.body}
                menuPosition="fixed"
                isDisabled={isPending || isCatalogLoading}
                placeholder="Select MOP..."
                styles={makeSelectStyles({ nowrapValue: true, error: !!errors.mopId })}
                onChange={(option) => {
                  const opt = option as MopOption | null;
                  field.onChange(opt?.value ?? null);
                  setSelectedMop(opt);
                }}
                value={selectedMop}
              />
            )}
          />
        </div>

        {/* Receiver */}
        <div style={{ width: receiverW, padding: '0 16px', flexShrink: 0 }}>
          <Controller
            name="receiverId"
            control={control}
            rules={{ required: 'Receiver is required' }}
            render={({ field }) => (
              <AsyncSelect
                loadOptions={loadReceivers}
                defaultOptions={receiverOptions}
                menuPortalTarget={document.body}
                menuPosition="fixed"
                isDisabled={isPending || isCatalogLoading}
                placeholder="Select receiver..."
                styles={makeSelectStyles({ nowrapValue: true, error: !!errors.receiverId })}
                onChange={(option) => {
                  const opt = option as ReceiverOption | null;
                  field.onChange(opt?.value ?? null);
                  setSelectedReceiver(opt);
                }}
                value={selectedReceiver}
              />
            )}
          />
        </div>

        {/* Notes */}
        <div style={{ width: notesW, padding: '0 16px', flexShrink: 0 }}>
          <textarea
            disabled={isPending}
            placeholder="Notes (optional)"
            rows={1}
            {...register('notes')}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-normal focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-100 resize-none"
          />
        </div>

        {/* Date Edited — empty on new row */}
        <div
          style={{ width: dateEditedW, padding: '0 16px', flexShrink: 0 }}
          className="flex items-center"
        >
          <span className="text-sm font-normal text-gray-400">—</span>
        </div>

        {/* Actions */}
        <div
          style={{ width: actionsW, padding: '0 16px', flexShrink: 0 }}
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
