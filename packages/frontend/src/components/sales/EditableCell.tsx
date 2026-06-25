import { useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncSelect from 'react-select/async';
import type { Sale } from '@alejinput/shared';
import { api } from '../../lib/axios';
import { useSalesEditStore } from '../../stores/salesEditStore';
import { useAuthStore } from '../../stores/authStore';

interface EditableCellProps {
  sale: Sale;
  field: 'productId' | 'mopId' | 'receiver' | 'notes';
  displayValue: string;
}

const SELECT_FIELDS = ['productId', 'mopId'] as const;
type SelectField = (typeof SELECT_FIELDS)[number];

export function EditableCell({ sale, field, displayValue }: EditableCellProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Targeted selectors: each derived boolean only re-renders THIS cell when ITS state changes.
  // Full store subscription would re-render all cells on every keystroke or Add Row toggle.
  const isThisCellActive = useSalesEditStore(
    (s) => s.activeCellSaleId === sale.id && s.activeCellField === field,
  );
  const isThisCellPending = useSalesEditStore(
    (s) => s.activeCellSaleId === sale.id && s.activeCellField === field && s.isPending,
  );
  // Only subscribe to draftValue when this cell is active; returns '' otherwise so
  // other cells' keystrokes don't cause this cell to re-render.
  const draftValue = useSalesEditStore((s) =>
    s.activeCellSaleId === sale.id && s.activeCellField === field ? s.draftValue : '',
  );
  // Actions are stable Zustand references — individual selectors never trigger re-renders.
  const setActiveCell = useSalesEditStore((s) => s.setActiveCell);
  const clearActiveCell = useSalesEditStore((s) => s.clearActiveCell);
  const setDraftValue = useSalesEditStore((s) => s.setDraftValue);
  const setPending = useSalesEditStore((s) => s.setPending);

  const { user } = useAuthStore();

  const { data: cachedProducts = [] } =
    useQuery<Array<{ id: number; name: string; price: string }>>({
      queryKey: ['catalog-products'],
      queryFn: () => api.get('/catalog/products').then((r) => r.data),
      staleTime: 5 * 60 * 1000,
    });

  const { data: cachedMops = [] } =
    useQuery<Array<{ id: number; name: string }>>({
      queryKey: ['catalog-mops'],
      queryFn: () => api.get('/catalog/mops').then((r) => r.data),
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
    mutationFn: ({
      saleId,
      field: patchField,
      value,
    }: {
      saleId: number;
      field: string;
      value: string;
    }) =>
      api
        .patch<Sale>(`/sales/${saleId}`, { field: patchField, value })
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
    const { isAddRowOpen, isPending: curPending, activeCellSaleId: curActive } =
      useSalesEditStore.getState();
    // D-03: blocked while Add Row form is open
    if (isAddRowOpen) return;
    // D-04: blocked while any PATCH is in-flight
    if (curPending) return;
    if (!isEditable) return;
    // D-04: if another cell is active, let it blur first (do not force clear here)
    if (curActive !== null && curActive !== sale.id) return;
    setActiveCell(sale.id, field, String(sale[field as keyof Sale] ?? ''));
  };

  const handleBlur = () => {
    const { isPending: curPending, draftValue: curDraft } = useSalesEditStore.getState();
    if (!isThisCellActive || curPending) return;
    const originalValue = String(sale[field as keyof Sale] ?? '');
    if (curDraft !== originalValue) {
      setPending(true);
      patchMutation.mutate({ saleId: sale.id, field, value: curDraft });
    } else {
      clearActiveCell();
    }
  };

  const loadProducts = (inputValue: string) =>
    Promise.resolve(
      cachedProducts
        .filter((p) => p.name.toLowerCase().includes(inputValue.toLowerCase()))
        .map((p) => ({ value: p.id, label: p.name }))
    );

  const loadMops = (inputValue: string) =>
    Promise.resolve(
      cachedMops
        .filter((m) => m.name.toLowerCase().includes(inputValue.toLowerCase()))
        .map((m) => ({ value: m.id, label: m.name }))
    );

  const handleSelectChange = (
    option: { value: number; label: string } | null,
  ) => {
    if (!option) return;
    setPending(true);
    patchMutation.mutate({ saleId: sale.id, field, value: String(option.value) });
  };

  // ── Pending state (cell disabled with spinner) ──────────────────────────────
  if (isThisCellPending) {
    return (
      <div className="flex items-center gap-1 bg-gray-100 opacity-60 min-h-[48px] px-0 py-2">
        <span className="text-sm font-normal text-gray-400">{displayValue || '—'}</span>
        <svg
          className="animate-spin h-4 w-4 text-gray-400 ml-1 flex-shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    );
  }

  // ── Active state (cell is being edited) ────────────────────────────────────
  if (isThisCellActive) {
    // Select fields: react-select AsyncSelect with immediate-fire on change
    if (SELECT_FIELDS.includes(field as SelectField)) {
      const loadOptions = field === 'productId' ? loadProducts : loadMops;
      return (
        <div className="min-h-[48px] py-1">
          <AsyncSelect
            loadOptions={loadOptions}
            defaultOptions
            autoFocus
            menuPortalTarget={document.body}
            menuPosition="fixed"
            styles={{
              control: (base) => ({
                ...base,
                minHeight: '36px',
                fontSize: '14px',
                borderColor: '#3b82f6',
                boxShadow: '0 0 0 1px #3b82f6',
              }),
              menu: (base) => ({ ...base, zIndex: 9999 }),
            }}
            defaultInputValue={displayValue}
            onChange={handleSelectChange}
            onMenuClose={() => {
              // If user closes menu without selecting, return to display mode
              if (!useSalesEditStore.getState().isPending) clearActiveCell();
            }}
          />
        </div>
      );
    }

    // Notes field: textarea that auto-expands
    if (field === 'notes') {
      return (
        <div className="min-h-[48px]">
          <textarea
            ref={(el) => {
              inputRef.current = el;
            }}
            value={draftValue}
            rows={1}
            onChange={(e) => {
              setDraftValue(e.target.value);
              // Auto-expand height
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onBlur={handleBlur}
            className="w-full border border-blue-500 rounded-sm px-2 py-1 text-sm font-normal text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </div>
      );
    }

    // Text fields: plain input
    return (
      <div className="min-h-[48px] flex items-center">
        <input
          ref={(el) => {
            inputRef.current = el;
          }}
          type="text"
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          onBlur={handleBlur}
          className="w-full border border-blue-500 rounded-sm px-2 py-1 text-sm font-normal text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              clearActiveCell(); // discard draft without saving
            }
          }}
        />
      </div>
    );
  }

  // ── Idle state ────────────────────────────────────────────────────────────────
  const isVoided = sale.status === 'void';
  const displayClass = isVoided
    ? 'text-sm font-normal text-gray-400 line-through'
    : 'text-sm font-normal text-gray-900';

  if (!isEditable) {
    return (
      <span
        className={`${displayClass} cursor-default block min-h-[48px] flex items-center`}
      >
        {displayValue || '—'}
      </span>
    );
  }

  return (
    <span
      className={`${displayClass} cursor-pointer hover:bg-blue-50 block min-h-[48px] flex items-center rounded-sm -mx-1 px-1`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
    >
      {displayValue || <span className="text-gray-400">—</span>}
    </span>
  );
}
