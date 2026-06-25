import { create } from 'zustand';

// AuthUser is the frontend auth state shape — matches AuthSession.user from @alejinput/shared
export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'moderator';
  canEdit: boolean;
  organizationId: number;
}

interface AuthState {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
}

// Zustand v5: curried create<State>()() — NOT create<State>() (RESEARCH.md State of the Art)
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

// Synchronous getter for use OUTSIDE React tree (router ProtectedRoute, axios interceptor)
// Returns current Zustand store state without hooks — works at module init time
export const getAuthUser = (): AuthUser | null => useAuthStore.getState().user;
