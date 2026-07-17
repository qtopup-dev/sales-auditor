import { create } from 'zustand';

// D-05 pattern (LOCKED, salesEditStore.ts precedent): UI overlay state isolated from React
// Query server state. Tracks both confirm dialogs' open/closed state and the force-clock-out
// target (shiftId + username for the confirmation copy).
interface ShiftState {
  isClockOutDialogOpen: boolean;
  isForceClockOutDialogOpen: boolean;
  forceClockOutTarget: { shiftId: number; username: string } | null;
  openClockOutDialog: () => void;
  closeClockOutDialog: () => void;
  openForceClockOutDialog: (target: { shiftId: number; username: string }) => void;
  closeForceClockOutDialog: () => void;
}

export const useShiftStore = create<ShiftState>()((set) => ({
  isClockOutDialogOpen: false,
  isForceClockOutDialogOpen: false,
  forceClockOutTarget: null,
  openClockOutDialog: () => set({ isClockOutDialogOpen: true }),
  closeClockOutDialog: () => set({ isClockOutDialogOpen: false }),
  openForceClockOutDialog: (target) => set({ isForceClockOutDialogOpen: true, forceClockOutTarget: target }),
  closeForceClockOutDialog: () => set({ isForceClockOutDialogOpen: false, forceClockOutTarget: null }),
}));
