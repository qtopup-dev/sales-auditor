import { create } from 'zustand';

// D-05 (LOCKED): edit-mode state isolated from React Query server state
// This store tracks which cell is active, the draft value, pending state,
// and UI overlay states (add-row form, audit drawer, void dialog).
// Mixing any of these into React Query cache causes focus-loss bugs during virtual scroll.
interface SalesEditState {
  // UI overlay states
  isAddRowOpen: boolean;
  openAuditSaleId: number | null;
  isVoidDialogOpen: boolean;
  voidTargetSaleId: number | null;
  // Inline cell edit state
  activeCellSaleId: number | null;
  activeCellField: string | null;
  draftValue: string;
  isPending: boolean;
  // Actions
  openAddRow: () => void;
  closeAddRow: () => void;
  setActiveCell: (saleId: number, field: string, initialValue: string) => void;
  clearActiveCell: () => void;
  setDraftValue: (value: string) => void;
  setPending: (pending: boolean) => void;
  openAuditDrawer: (saleId: number) => void;
  closeAuditDrawer: () => void;
  openVoidDialog: (saleId: number) => void;
  closeVoidDialog: () => void;
}

export const useSalesEditStore = create<SalesEditState>()((set) => ({
  isAddRowOpen: false,
  openAuditSaleId: null,
  isVoidDialogOpen: false,
  voidTargetSaleId: null,
  activeCellSaleId: null,
  activeCellField: null,
  draftValue: '',
  isPending: false,
  openAddRow: () => set({ isAddRowOpen: true }),
  closeAddRow: () => set({ isAddRowOpen: false }),
  setActiveCell: (saleId, field, initialValue) =>
    set({ activeCellSaleId: saleId, activeCellField: field, draftValue: initialValue }),
  clearActiveCell: () =>
    set({ activeCellSaleId: null, activeCellField: null, draftValue: '' }),
  setDraftValue: (value) => set({ draftValue: value }),
  setPending: (pending) => set({ isPending: pending }),
  openAuditDrawer: (saleId) => set({ openAuditSaleId: saleId }),
  closeAuditDrawer: () => set({ openAuditSaleId: null }),
  openVoidDialog: (saleId) => set({ isVoidDialogOpen: true, voidTargetSaleId: saleId }),
  closeVoidDialog: () => set({ isVoidDialogOpen: false, voidTargetSaleId: null }),
}));

// Synchronous getter for use outside React components if needed
export const getSalesEditState = () => useSalesEditStore.getState();
