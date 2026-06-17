import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';
import type { Product } from '@alejinput/shared';

interface ProductModalProps {
  product: Product | null; // null = create mode, non-null = edit mode
  onClose: () => void;
}

type ProductFormData = { name: string; price: string };

// Product create/edit modal per UI-SPEC.md §Product Modal
// PROD-01: create; PROD-02: edit
// Price field: type="text" (NOT number — avoids float issues per CLAUDE.md Rule 6)
// Pessimistic UI: all inputs + both buttons disabled during isPending (CLAUDE.md Rule 10)
export function ProductModal({ product, onClose }: ProductModalProps) {
  const queryClient = useQueryClient();
  const isEdit = product !== null;

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ProductFormData>({
    defaultValues: isEdit ? { name: product.name, price: product.price } : { name: '', price: '' },
  });

  // Reset form when product prop changes (switching between edit targets)
  useEffect(() => {
    reset(isEdit ? { name: product.name, price: product.price } : { name: '', price: '' });
  }, [product, isEdit, reset]);

  const createMutation = useMutation({
    mutationFn: (data: ProductFormData) =>
      api.post<Product>('/products', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProductFormData) =>
      api.patch<Product>(`/products/${product!.id}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  const onSubmit = (data: ProductFormData) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  // UI-SPEC.md modal titles
  const title = isEdit ? 'Edit Product' : 'Add Product';
  // UI-SPEC.md CTA copy
  const ctaLabel = isEdit ? 'Save Changes' : 'Add Product';

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
            form="product-form"
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Saving...' : ctaLabel}
          </button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Product Name field */}
        <div>
          <label htmlFor="product-name" className="text-sm text-gray-500 block mb-1">
            Product Name
          </label>
          <input
            id="product-name"
            type="text"
            disabled={isPending}
            {...register('name', { required: 'Product Name is required' })}
            className={`h-10 w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              errors.name
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }`}
          />
          {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
        </div>

        {/* Price field — type="text" NOT number (CLAUDE.md Rule 6 — prevents float issues) */}
        <div className="mt-4">
          <label htmlFor="product-price" className="text-sm text-gray-500 block mb-1">
            Price
          </label>
          <input
            id="product-price"
            type="text"
            placeholder="0.00"
            disabled={isPending}
            {...register('price', {
              required: 'Price is required',
              pattern: {
                value: /^\d+(\.\d{0,2})?$/,
                message: 'Enter a valid price (e.g., 10.00).',
              },
            })}
            className={`h-10 w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              errors.price
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }`}
          />
          {errors.price && <p className="text-sm text-red-600 mt-1">{errors.price.message}</p>}
        </div>

        {/* API error */}
        {error && (
          <p className="text-sm text-red-600 mt-1">Something went wrong. Please try again.</p>
        )}
      </form>
    </Modal>
  );
}
