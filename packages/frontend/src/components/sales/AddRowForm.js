import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import AsyncSelect from 'react-select/async';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/axios';
import { makeSelectStyles } from '../../lib/selectStyles';
import { useSalesEditStore } from '../../stores/salesEditStore';
const DEFAULT_COLUMN_WIDTHS = [200, 100, 180, 160, 160, 140, 120];
export function AddRowForm({ onSaveSuccess, columnWidths }) {
    const [productW, priceW, mopW, receiverW, notesW, dateEditedW, actionsW] = columnWidths ?? DEFAULT_COLUMN_WIDTHS;
    const queryClient = useQueryClient();
    const closeAddRow = useSalesEditStore((s) => s.closeAddRow);
    const { register, handleSubmit, control, watch, formState: { errors }, } = useForm({
        defaultValues: { productId: null, mopId: null, receiverId: null, notes: '' },
    });
    const [priceDisplay, setPriceDisplay] = useState('—');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedMop, setSelectedMop] = useState(null);
    const [selectedReceiver, setSelectedReceiver] = useState(null);
    const watchedProductId = watch('productId');
    const watchedMopId = watch('mopId');
    const watchedReceiverId = watch('receiverId');
    const isFormValid = watchedProductId !== null && watchedMopId !== null && watchedReceiverId !== null;
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape')
                closeAddRow();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [closeAddRow]);
    const { data: cachedProducts = [], isLoading: productsLoading } = useQuery({
        queryKey: ['catalog-products'],
        queryFn: () => api.get('/catalog/products').then((r) => r.data),
        staleTime: 5 * 60 * 1000,
    });
    const { data: cachedMops = [], isLoading: mopsLoading } = useQuery({
        queryKey: ['catalog-mops'],
        queryFn: () => api.get('/catalog/mops').then((r) => r.data),
        staleTime: 5 * 60 * 1000,
    });
    const { data: cachedReceivers = [], isLoading: receiversLoading } = useQuery({
        queryKey: ['catalog-receivers'],
        queryFn: () => api.get('/catalog/receivers').then((r) => r.data),
        staleTime: 5 * 60 * 1000,
    });
    const isCatalogLoading = productsLoading || mopsLoading || receiversLoading;
    const productOptions = useMemo(() => cachedProducts.map((p) => ({ value: p.id, label: p.name, price: p.price })), [cachedProducts]);
    const mopOptions = useMemo(() => cachedMops.map((m) => ({ value: m.id, label: m.name })), [cachedMops]);
    const receiverOptions = useMemo(() => cachedReceivers.map((r) => ({ value: r.id, label: r.name })), [cachedReceivers]);
    const loadProducts = useCallback((inputValue) => Promise.resolve(productOptions.filter((p) => p.label.toLowerCase().includes(inputValue.toLowerCase()))), [productOptions]);
    const loadMops = useCallback((inputValue) => Promise.resolve(mopOptions.filter((m) => m.label.toLowerCase().includes(inputValue.toLowerCase()))), [mopOptions]);
    const loadReceivers = useCallback((inputValue) => Promise.resolve(receiverOptions.filter((r) => r.label.toLowerCase().includes(inputValue.toLowerCase()))), [receiverOptions]);
    const createMutation = useMutation({
        mutationFn: (data) => api.post('/sales', data).then((r) => r.data),
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
    return (_jsxs("form", { onSubmit: handleSubmit((data) => createMutation.mutate(data)), className: "w-full", children: [_jsxs("div", { className: "flex items-start px-0 py-2 gap-0 w-full", children: [_jsx("div", { style: { width: productW, padding: '0 16px', flexShrink: 0 }, children: _jsx(Controller, { name: "productId", control: control, rules: { required: 'Product is required' }, render: ({ field }) => (_jsx(AsyncSelect, { loadOptions: loadProducts, defaultOptions: productOptions, menuPortalTarget: document.body, menuPosition: "fixed", isDisabled: isPending || isCatalogLoading, placeholder: "Select product...", styles: makeSelectStyles({ nowrapValue: true, error: !!errors.productId }), onChange: (option) => {
                                    const opt = option;
                                    field.onChange(opt?.value ?? null);
                                    setSelectedProduct(opt);
                                    setPriceDisplay(opt ? opt.price : '—');
                                }, value: selectedProduct })) }) }), _jsx("div", { style: { width: priceW, padding: '0 16px', flexShrink: 0 }, className: "flex items-center justify-end", children: _jsx("span", { className: "block text-right text-sm font-normal text-gray-400 dark:text-gray-500 pt-2", children: priceDisplay }) }), _jsx("div", { style: { width: mopW, padding: '0 16px', flexShrink: 0 }, children: _jsx(Controller, { name: "mopId", control: control, rules: { required: 'MOP is required' }, render: ({ field }) => (_jsx(AsyncSelect, { loadOptions: loadMops, defaultOptions: mopOptions, menuPortalTarget: document.body, menuPosition: "fixed", isDisabled: isPending || isCatalogLoading, placeholder: "Select MOP...", styles: makeSelectStyles({ nowrapValue: true, error: !!errors.mopId }), onChange: (option) => {
                                    const opt = option;
                                    field.onChange(opt?.value ?? null);
                                    setSelectedMop(opt);
                                }, value: selectedMop })) }) }), _jsx("div", { style: { width: receiverW, padding: '0 16px', flexShrink: 0 }, children: _jsx(Controller, { name: "receiverId", control: control, rules: { required: 'Receiver is required' }, render: ({ field }) => (_jsx(AsyncSelect, { loadOptions: loadReceivers, defaultOptions: receiverOptions, menuPortalTarget: document.body, menuPosition: "fixed", isDisabled: isPending || isCatalogLoading, placeholder: "Select receiver...", styles: makeSelectStyles({ nowrapValue: true, error: !!errors.receiverId }), onChange: (option) => {
                                    const opt = option;
                                    field.onChange(opt?.value ?? null);
                                    setSelectedReceiver(opt);
                                }, value: selectedReceiver })) }) }), _jsx("div", { style: { width: notesW, padding: '0 16px', flexShrink: 0 }, children: _jsx("textarea", { disabled: isPending, placeholder: "Notes (optional)", rows: 1, ...register('notes'), className: "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm font-normal focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-900 resize-none" }) }), _jsx("div", { style: { width: dateEditedW, padding: '0 16px', flexShrink: 0 }, className: "flex items-center", children: _jsx("span", { className: "text-sm font-normal text-gray-400 dark:text-gray-500", children: "\u2014" }) }), _jsxs("div", { style: { width: actionsW, padding: '0 16px', flexShrink: 0 }, className: "flex flex-col gap-1 items-start", children: [_jsx("button", { type: "submit", disabled: isPending || !isFormValid, className: "px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed", children: isPending ? 'Saving...' : 'Save Row' }), _jsx("button", { type: "button", onClick: closeAddRow, disabled: isPending, className: "px-3 py-1.5 text-gray-600 dark:text-gray-300 text-sm font-normal hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed", children: "Discard" })] })] }), createMutation.isError && (_jsx("p", { className: "text-xs font-normal text-red-600 dark:text-red-400 px-4 pb-1", children: "Failed to save. Please try again." }))] }));
}
