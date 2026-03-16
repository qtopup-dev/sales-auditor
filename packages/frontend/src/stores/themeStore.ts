import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

// First visit: no stored choice → follow OS. Stored choice always wins.
function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable (private mode) — fall through to media query
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeClass(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

// Zustand v5: curried create<State>()() — project convention (see authStore.ts)
export const useThemeStore = create<ThemeState>()((set, get) => ({
  theme: getInitialTheme(),
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    applyThemeClass(next);
    try {
      localStorage.setItem(STORAGE_KEY, next); // persist only on explicit user choice
    } catch {
      // private mode — theme still works for this session
    }
    set({ theme: next });
  },
}));

// Sync class on module load (covers the store/class drift case; inline
// index.html script already handled first paint).
applyThemeClass(useThemeStore.getState().theme);
