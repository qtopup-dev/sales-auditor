import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncSelect from 'react-select/async';
import { api } from '../../lib/axios';
import { makeSelectStyles } from '../../lib/selectStyles';
import { useSalesEditStore } from '../../stores/salesEditStore';
import { useAuthStore } from '../../stores/authStore';
const SELECT_FIELDS = ['productId', 'mopId', 'receiverId'];
export function EditableCell({ sale, field, displayValue }) {
    const queryClient = useQueryClient();
    const inputRef = useRef(null);
    // Targeted selectors: each derived boolean only re-renders THIS cell when ITS state changes.
    // Full store subscription would re-render all cells on every keystroke or Add Row toggle.
    const isThisCellActive = useSalesEditStore((s) => s.activeCellSaleId === sale.id && s.activeCellField === field);
    const isThisCellPending = useSalesEditStore((s) => s.activeCellSaleId === sale.id && s.activeCellField === field && s.isPending);
    // Only subscribe to draftValue when this cell is active; returns '' otherwise so
    // other cells' keystrokes don't cause this cell to re-render.
    const draftValue = useSalesEditStore((s) => s.activeCellSaleId === sale.id && s.activeCellField === field ? s.draftValue : '');
    // Actions are stable Zustand references — individual selectors never trigger re-renders.
    const setActiveCell = useSalesEditStore((s) => s.setActiveCell);
    const clearActiveCell = useSalesEditStore((s) => s.clearActiveCell);
    const setDraftValue = useSalesEditStore((s) => s.setDraftValue);
    const setPending = useSalesEditStore((s) => s.setPending);
    const { user } = useAuthStore();
    const { data: cachedProducts = [] } = useQuery({
        queryKey: ['catalog-products'],
        queryFn: () => api.get('/catalog/products').then((r) => r.data),
        staleTime: 5 * 60 * 1000,
    });
    const { data: cachedMops = [] } = useQuery({
        queryKey: ['catalog-mops'],
        queryFn: () => api.get('/catalog/mops').then((r) => r.data),
        staleTime: 5 * 60 * 1000,
    });
    const { data: cachedReceivers = [] } = useQuery({
        queryKey: ['catalog-receivers'],
        queryFn: () => api.get('/catalog/receivers').then((r) => r.data),
        staleTime: 5 * 60 * 1000,
    });
    // Any user with canEdit=true (or admin) may edit any active row
    const canEdit = user?.role === 'admin' || user?.canEdit === true;
    const isEditable = canEdit && sale.status !== 'void';
    // Auto-focus input when cell becomes active
    useEffect(() => {
        if (isThisCellActive && !isThisCellPending && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isThisCellActive, isThisCellPending]);
    const patchMutation = useMutation({
        mutationFn: ({ saleId, field: patchField, value, }) => api
            .patch(`/sales/${saleId}`, { field: patchField, value })
            .then((r) => r.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            clearActiveCell();
            setPending(false);
        },
        onError: () => {
            // Return to display mode; React Query cache already has prior value
            clearActiveCell();
            setPending(false);
        },
    });
    const handleClick = () => {
        // Read transient flags from store directly — no subscription needed for event handlers.
        const { isAddRowOpen, isPending: curPending, activeCellSaleId: curActive } = useSalesEditStore.getState();
        // D-03: blocked while Add Row form is open
        if (isAddRowOpen)
            return;
        // D-04: blocked while any PATCH is in-flight
        if (curPending)
            return;
        if (!isEditable)
            return;
        // D-04: if another cell is active, let it blur first (do not force clear here)
        if (curActive !== null && curActive !== sale.id)
            return;
        setActiveCell(sale.id, field, String(sale[field] ?? ''));
    };
    const handleBlur = () => {
        const { isPending: curPending, draftValue: curDraft } = useSalesEditStore.getState();
        if (!isThisCellActive || curPending)
            return;
        const originalValue = String(sale[field] ?? '');
        if (curDraft !== originalValue) {
            setPending(true);
            patchMutation.mutate({ saleId: sale.id, field, value: curDraft });
        }
        else {
            clearActiveCell();
        }
    };
    const loadProducts = (inputValue) => Promise.resolve(cachedProducts
        .filter((p) => p.name.toLowerCase().includes(inputValue.toLowerCase()))
        .map((p) => ({ value: p.id, label: p.name })));
    const loadMops = (inputValue) => Promise.resolve(cachedMops
        .filter((m) => m.name.toLowerCase().includes(inputValue.toLowerCase()))
        .map((m) => ({ value: m.id, label: m.name })));
    const loadReceivers = (inputValue) => Promise.resolve(cachedReceivers
        .filter((r) => r.name.toLowerCase().includes(inputValue.toLowerCase()))
        .map((r) => ({ value: r.id, label: r.name })));
    const handleSelectChange = (option) => {
        if (!option)
            return;
        setPending(true);
        patchMutation.mutate({ saleId: sale.id, field, value: String(option.value) });
    };
    // ── Pending state (cell disabled with spinner) ──────────────────────────────
    if (isThisCellPending) {
        return (_jsxs("div", { className: "flex items-center gap-1 bg-gray-100 dark:bg-gray-800 opacity-60 min-h-[48px] px-0 py-2", children: [_jsx("span", { className: "text-sm font-normal text-gray-400 dark:text-gray-500", children: displayValue || '—' }), _jsxs("svg", { className: "animate-spin h-4 w-4 text-gray-400 ml-1 flex-shrink-0", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", "aria-hidden": "true", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" })] })] }));
    }
    // ── Active state (cell is being edited) ────────────────────────────────────
    if (isThisCellActive) {
        // Select fields: react-select AsyncSelect with immediate-fire on change
        if (SELECT_FIELDS.includes(field)) {
            const loadOptions = field === 'productId' ? loadProducts
                : field === 'mopId' ? loadMops
                    : loadReceivers;
            return (_jsx("div", { className: "min-h-[48px] py-1", children: _jsx(AsyncSelect, { loadOptions: loadOptions, defaultOptions: true, autoFocus: true, menuPortalTarget: document.body, menuPosition: "fixed", styles: makeSelectStyles({ focusRing: true }), defaultInputValue: displayValue, onChange: handleSelectChange, onMenuClose: () => {
                        // If user closes menu without selecting, return to display mode
                        if (!useSalesEditStore.getState().isPending)
                            clearActiveCell();
                    } }) }));
        }
        // Notes field: textarea that auto-expands
        if (field === 'notes') {
            return (_jsx("div", { className: "min-h-[48px]", children: _jsx("textarea", { ref: (el) => {
                        inputRef.current = el;
                    }, value: draftValue, rows: 1, onChange: (e) => {
                        setDraftValue(e.target.value);
                        // Auto-expand height
                        e.target.style.height = 'auto';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                    }, onBlur: handleBlur, className: "w-full border border-blue-500 rounded-sm px-2 py-1 text-sm font-normal text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" }) }));
        }
        // Text fields: plain input
        return (_jsx("div", { className: "min-h-[48px] flex items-center", children: _jsx("input", { ref: (el) => {
                    inputRef.current = el;
                }, type: "text", value: draftValue, onChange: (e) => setDraftValue(e.target.value), onBlur: handleBlur, className: "w-full border border-blue-500 rounded-sm px-2 py-1 text-sm font-normal text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500", onKeyDown: (e) => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        clearActiveCell(); // discard draft without saving
                    }
                } }) }));
    }
    // ── Idle state ────────────────────────────────────────────────────────────────
    const isVoided = sale.status === 'void';
    const displayClass = isVoided
        ? 'text-sm font-normal text-gray-400 dark:text-gray-500 line-through'
        : 'text-sm font-normal text-gray-900 dark:text-gray-100';
    if (!isEditable) {
        return (_jsx("span", { className: `${displayClass} cursor-default block min-h-[48px] flex items-center`, children: displayValue || '—' }));
    }
    return (_jsx("span", { className: `${displayClass} cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 block min-h-[48px] flex items-center rounded-sm -mx-1 px-1`, onClick: handleClick, role: "button", tabIndex: 0, onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ')
                handleClick();
        }, children: displayValue || _jsx("span", { className: "text-gray-400 dark:text-gray-500", children: "\u2014" }) }));
}
