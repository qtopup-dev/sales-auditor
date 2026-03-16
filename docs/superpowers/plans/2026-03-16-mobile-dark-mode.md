# Mobile-Friendly Layout + Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every screen of the Sales Auditing app usable on phones (≥375px) and add a persisted dark mode toggled from the bottom of the side nav.

**Architecture:** Tailwind `darkMode: 'class'` with `dark:` variants added in place (no CSS-variable refactor of Tailwind classes). A Zustand `themeStore` owns the theme, persisted to localStorage, defaulting to `prefers-color-scheme`; an inline script in `index.html` prevents light-flash. Below the `md` breakpoint the sidebar becomes a hamburger-triggered overlay drawer; tables scroll horizontally; desktop layout is unchanged. react-select (inline styles) is themed via CSS custom properties; Recharts via a `useChartColors()` hook.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v3.4 (config inline in `vite.config.ts`), Zustand v5, react-select v5, Recharts v3, Vite 8.

**Spec:** `docs/superpowers/specs/2026-03-16-mobile-dark-mode-design.md`

## Global Constraints

- Breakpoint: `md` (768px). Below = top bar + drawer. At/above = current fixed 240px sidebar, visually unchanged in light mode.
- localStorage key: `theme`, values `'light' | 'dark'`. Persist ONLY when the user toggles — first-visit system preference is not written to storage.
- Palette mapping (use everywhere, no ad-hoc colors):
  - `bg-white` → add `dark:bg-gray-800`
  - `bg-gray-50` (page/main surfaces) → add `dark:bg-gray-900`
  - `bg-gray-100` (sidebar, table headers, subtle fills) → add `dark:bg-gray-950` for the sidebar, `dark:bg-gray-800` for table headers/fills
  - `border-gray-200` / `border-gray-300` → add `dark:border-gray-700`
  - `text-gray-900` → add `dark:text-gray-100`
  - `text-gray-700` / `text-gray-600` → add `dark:text-gray-300`
  - `text-gray-500` / `text-gray-400` → add `dark:text-gray-400`
  - `hover:bg-gray-200` → add `dark:hover:bg-gray-800`
  - `hover:text-gray-900` → add `dark:hover:text-gray-100`
  - `bg-blue-50` (active nav / info washes) → add `dark:bg-blue-950`
  - `text-blue-700` → add `dark:text-blue-300`
  - `text-red-600` → add `dark:text-red-400`; `bg-red-50` → add `dark:bg-red-950`
  - `bg-green-100 text-green-800`-style badges → add `dark:bg-green-900 dark:text-green-200` (same pattern for other badge hues)
  - Blue-600 buttons/accents: unchanged in dark mode.
- Touch targets in nav/drawer: `min-h-[44px]` (existing convention — keep it).
- No backend changes. No new npm dependencies.
- Build/type-check command (run from repo root): `npm run build --workspace @alejinput/frontend` — expected: `tsc` clean, `vite build` succeeds.
- There is no unit-test infrastructure in the frontend package; verification per task is type-check/build, plus a full Playwright pass in the final task. Styling tasks have no TDD cycle.

---

### Task 1: Dark mode infrastructure (Tailwind config, theme store, no-flash script)

**Files:**
- Modify: `packages/frontend/vite.config.ts` (tailwind plugin options)
- Modify: `packages/frontend/tailwind.config.js`
- Modify: `packages/frontend/index.html`
- Create: `packages/frontend/src/stores/themeStore.ts`

**Interfaces:**
- Produces: `useThemeStore` hook with `{ theme: 'light' | 'dark'; toggleTheme: () => void }` from `../stores/themeStore` (or `../../stores/themeStore` from nested dirs). Later tasks (2, 5) consume `theme` and `toggleTheme` exactly as named.

- [ ] **Step 1: Enable class dark mode in both Tailwind configs**

In `packages/frontend/vite.config.ts`, add `darkMode: 'class',` to the inline tailwind options:

```ts
tailwindcss({
  darkMode: 'class',
  content: [
    join(__dirname, 'index.html'),
    join(__dirname, 'src/**/*.{js,ts,jsx,tsx}'),
  ],
  theme: { extend: {} },
  plugins: [],
}),
```

In `packages/frontend/tailwind.config.js` (editor-tooling stub — keep in sync):

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 2: Add the no-flash inline script to index.html**

In `packages/frontend/index.html`, add this as the FIRST child of `<head>` after the charset/viewport metas (must run before the app bundle):

```html
<script>
  // Set dark class before first paint — mirrors themeStore's initial-theme logic.
  (function () {
    try {
      var t = localStorage.getItem('theme');
      if (t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      }
    } catch (e) { /* localStorage unavailable — default to light */ }
  })();
</script>
```

- [ ] **Step 3: Create the theme store**

Create `packages/frontend/src/stores/themeStore.ts`:

```ts
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
```

- [ ] **Step 4: Type-check and build**

Run: `npm run build --workspace @alejinput/frontend`
Expected: PASS (tsc clean, vite build succeeds)

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/vite.config.ts packages/frontend/tailwind.config.js packages/frontend/index.html packages/frontend/src/stores/themeStore.ts
git commit -m "feat(theme): dark mode infrastructure — class strategy, theme store, no-flash script"
```

---

### Task 2: Sidebar dark variants + dark mode toggle button

**Files:**
- Modify: `packages/frontend/src/layouts/AuthenticatedLayout.tsx`

**Interfaces:**
- Consumes: `useThemeStore` from Task 1.
- Produces: sidebar inner content structured so Task 3 can render it in both the static aside and the mobile drawer. Extract it as a local component `SidebarContent` in the same file (not exported).

- [ ] **Step 1: Rework AuthenticatedLayout — extract SidebarContent, add toggle + dark classes**

Replace the body of `packages/frontend/src/layouts/AuthenticatedLayout.tsx` with:

```tsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { api } from '../lib/axios';
import { queryClient } from '../lib/queryClient';
import { ClockControl } from '../components/shift/ClockControl';

// Admin nav items per CONTEXT.md D-04 and UI-SPEC.md §AuthenticatedLayout
const ADMIN_NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/sales', label: 'Sales' },
  { to: '/products', label: 'Products' },
  { to: '/mops', label: 'MOPs' },
  { to: '/receivers', label: 'Receivers' },
  { to: '/users', label: 'Users' },
  { to: '/shifts', label: 'Shifts' },
];

// Moderator nav items per CONTEXT.md D-04 (ROLES-07: only Sales Sheet visible)
const MODERATOR_NAV = [
  { to: '/sales', label: 'Sales Sheet' },
  { to: '/shift-history', label: 'Shift History' },
];

// Sidebar body — shared between the static desktop aside and the mobile drawer (Task 3)
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, setUser } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const navItems = user?.role === 'admin' ? ADMIN_NAV : MODERATOR_NAV;

  // AUTH-03: logout — pessimistic: await server before clearing client state (CLAUDE.md Rule 10)
  const handleLogout = async () => {
    await api.post('/auth/logout');
    queryClient.clear();
    setUser(null);
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* App name */}
      <div className="px-6 py-6">
        <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sales Auditor</span>
      </div>

      {/* Nav items — role-based (D-04, D-06: same layout, filtered items) */}
      <nav className="flex-1 px-2 py-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              isActive
                ? 'flex items-center px-4 py-2 text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 border-l-2 border-blue-600 min-h-[44px]'
                : 'flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 min-h-[44px]'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {user?.role === 'moderator' && <ClockControl />}

      {/* Dark mode toggle — above username/logout per spec */}
      <div className="px-2 pb-1">
        <button
          type="button"
          onClick={toggleTheme}
          aria-pressed={theme === 'dark'}
          className="flex items-center gap-3 w-full px-4 py-2 min-h-[44px] text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 rounded"
        >
          {theme === 'dark' ? (
            // Sun icon
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
            </svg>
          ) : (
            // Moon icon
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>

      {/* Bottom: username + logout */}
      <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 truncate">{user?.username}</p>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950 rounded"
        >
          Log Out
        </button>
      </div>
    </>
  );
}

export function AuthenticatedLayout() {
  return (
    <div className="flex h-screen overflow-hidden antialiased">
      {/* Sidebar — 240px fixed width per UI-SPEC.md */}
      <aside className="w-60 flex-shrink-0 bg-gray-100 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <SidebarContent />
      </aside>

      {/* Main content area */}
      <main className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
```

Note: `SidebarContent` takes `onNavigate` (fires on nav-item click) so Task 3's drawer can close itself; the static aside passes nothing.

- [ ] **Step 2: Type-check and build**

Run: `npm run build --workspace @alejinput/frontend`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/layouts/AuthenticatedLayout.tsx
git commit -m "feat(theme): dark mode toggle in side nav, sidebar dark variants"
```

---

### Task 3: Mobile navigation — top bar, hamburger, overlay drawer

**Files:**
- Modify: `packages/frontend/src/layouts/AuthenticatedLayout.tsx`

**Interfaces:**
- Consumes: `SidebarContent({ onNavigate })` from Task 2.
- Produces: final layout shell. No later task touches this file.

- [ ] **Step 1: Add drawer state, top bar, backdrop, and responsive classes**

In `AuthenticatedLayout.tsx`, replace the `AuthenticatedLayout` function (keep `SidebarContent` from Task 2 unchanged) with:

```tsx
export function AuthenticatedLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Escape closes the mobile drawer
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden antialiased">
      {/* Mobile top bar — hidden at md+ */}
      <header className="md:hidden flex items-center gap-3 px-4 h-14 flex-shrink-0 bg-gray-100 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="flex items-center justify-center w-11 h-11 -ml-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
        >
          {/* Hamburger icon */}
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Sales Auditor</span>
      </header>

      {/* Static sidebar — desktop only. 240px fixed width per UI-SPEC.md */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-gray-100 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile drawer + backdrop */}
      {drawerOpen && (
        <div className="md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 bg-gray-900/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer — same content as the desktop sidebar */}
          <aside className="fixed inset-y-0 left-0 z-40 w-60 bg-gray-100 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col shadow-xl">
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content area */}
      <main className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-auto p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
```

Add to the imports at the top of the file:

```tsx
import { useEffect, useState } from 'react';
```

- [ ] **Step 2: Type-check and build**

Run: `npm run build --workspace @alejinput/frontend`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/layouts/AuthenticatedLayout.tsx
git commit -m "feat(mobile): hamburger top bar and slide-in nav drawer below md"
```

---

### Task 4: react-select theming via CSS variables + shared styles module

**Files:**
- Modify: `packages/frontend/src/index.css`
- Create: `packages/frontend/src/lib/selectStyles.ts`
- Modify: `packages/frontend/src/components/admin/SalesFilterBar.tsx` (replace local `selectStyles`, lines 40–53)
- Modify: `packages/frontend/src/components/sales/AddRowForm.tsx` (three inline `styles={{...}}` blocks)
- Modify: `packages/frontend/src/components/sales/EditableCell.tsx` (its react-select `styles` prop — same substitution pattern)

**Interfaces:**
- Produces: `makeSelectStyles(opts?: { height?: number; error?: boolean; nowrapValue?: boolean })` from `lib/selectStyles.ts` returning a react-select `StylesConfig`. All react-select instances in the app use it; no other file defines select styles after this task.

- [ ] **Step 1: Define theme CSS variables in index.css**

Replace `packages/frontend/src/index.css` content with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Theme variables for libraries that render inline styles (react-select). */
:root {
  --select-bg: #ffffff;          /* white */
  --select-border: #d1d5db;      /* gray-300 */
  --select-border-hover: #9ca3af;/* gray-400 */
  --select-text: #111827;        /* gray-900 */
  --select-placeholder: #6b7280; /* gray-500 */
  --select-menu-bg: #ffffff;
  --select-option-focus: #eff6ff;   /* blue-50 */
  --select-option-selected: #2563eb;/* blue-600 */
  --select-disabled-bg: #f3f4f6; /* gray-100 */
}

.dark {
  --select-bg: #1f2937;          /* gray-800 */
  --select-border: #4b5563;      /* gray-600 */
  --select-border-hover: #6b7280;/* gray-500 */
  --select-text: #f3f4f6;        /* gray-100 */
  --select-placeholder: #9ca3af; /* gray-400 */
  --select-menu-bg: #1f2937;
  --select-option-focus: #172554;   /* blue-950 */
  --select-option-selected: #2563eb;/* blue-600 */
  --select-disabled-bg: #111827; /* gray-900 */
}
```

- [ ] **Step 2: Create the shared styles module**

Create `packages/frontend/src/lib/selectStyles.ts`:

```ts
import type { CSSObjectWithLabel, StylesConfig, GroupBase } from 'react-select';

interface SelectStyleOpts {
  height?: number;       // fixed control height in px (e.g. 40 for filter bar)
  error?: boolean;       // red border for validation errors
  nowrapValue?: boolean; // ellipsize placeholder/single value (sales sheet cells)
}

const ellipsis: CSSObjectWithLabel = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

// Single source of react-select styling. Colors read CSS variables set on
// :root / .dark in index.css so selects follow the active theme without re-render.
export function makeSelectStyles<Option, IsMulti extends boolean = false>(
  opts: SelectStyleOpts = {},
): StylesConfig<Option, IsMulti, GroupBase<Option>> {
  const { height, error, nowrapValue } = opts;
  return {
    control: (base) => ({
      ...base,
      ...(height ? { height: `${height}px`, minHeight: `${height}px` } : { minHeight: '36px' }),
      fontSize: '14px',
      borderRadius: '6px',
      backgroundColor: 'var(--select-bg)',
      borderColor: error ? '#ef4444' : 'var(--select-border)',
      '&:hover': { borderColor: error ? '#ef4444' : 'var(--select-border-hover)' },
    }),
    valueContainer: (base) => ({ ...base, flexWrap: 'nowrap' }),
    singleValue: (base) => ({
      ...base,
      color: 'var(--select-text)',
      ...(nowrapValue ? ellipsis : {}),
    }),
    input: (base) => ({ ...base, color: 'var(--select-text)' }),
    placeholder: (base) => ({
      ...base,
      color: 'var(--select-placeholder)',
      ...(nowrapValue ? ellipsis : {}),
    }),
    menu: (base) => ({ ...base, zIndex: 9999, backgroundColor: 'var(--select-menu-bg)' }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'var(--select-option-selected)'
        : state.isFocused
          ? 'var(--select-option-focus)'
          : 'var(--select-menu-bg)',
      color: state.isSelected ? '#ffffff' : 'var(--select-text)',
    }),
  };
}
```

- [ ] **Step 3: Use it in SalesFilterBar**

In `SalesFilterBar.tsx`: delete the local `selectStyles` const (lines 40–53), add `import { makeSelectStyles } from '../../lib/selectStyles';`, and change all three `styles={selectStyles}` props to `styles={makeSelectStyles({ height: 40 })}`.

- [ ] **Step 4: Use it in AddRowForm**

In `AddRowForm.tsx`: add the same import; replace each of the three inline `styles={{ control: ..., menu: ..., valueContainer: ..., placeholder: ..., singleValue: ... }}` blocks with:

```tsx
styles={makeSelectStyles({ nowrapValue: true, error: !!errors.productId })}
```

(using `errors.mopId` / `errors.receiverId` for the MOP / Receiver selects respectively).

- [ ] **Step 5: Use it in EditableCell**

In `EditableCell.tsx`: find its react-select `styles` prop, note any cell-specific values it sets (height, font size), and replace it with `makeSelectStyles({ nowrapValue: true, ...(matching opts) })`. If it sets a style `makeSelectStyles` cannot express, extend `SelectStyleOpts` with that one option rather than leaving a local styles object behind.

- [ ] **Step 6: Type-check and build**

Run: `npm run build --workspace @alejinput/frontend`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/src/index.css packages/frontend/src/lib/selectStyles.ts packages/frontend/src/components/admin/SalesFilterBar.tsx packages/frontend/src/components/sales/AddRowForm.tsx packages/frontend/src/components/sales/EditableCell.tsx
git commit -m "feat(theme): theme-aware shared react-select styles via CSS variables"
```

---

### Task 5: Recharts dark theming — useChartColors hook

**Files:**
- Create: `packages/frontend/src/hooks/useChartColors.ts`
- Modify: `packages/frontend/src/components/admin/SalesCharts.tsx`

**Interfaces:**
- Consumes: `useThemeStore` from Task 1.
- Produces: `useChartColors(): { grid: string; axis: string; accent: string; tooltipBg: string; tooltipBorder: string; tooltipText: string }`.

- [ ] **Step 1: Create the hook**

Create `packages/frontend/src/hooks/useChartColors.ts`:

```ts
import { useThemeStore } from '../stores/themeStore';

// Recharts takes literal color props — it can't read Tailwind classes, so
// chart colors switch with the theme here.
export function useChartColors() {
  const theme = useThemeStore((s) => s.theme);
  return theme === 'dark'
    ? {
        grid: '#374151',        // gray-700
        axis: '#9ca3af',        // gray-400
        accent: '#3b82f6',      // blue-500 — brighter on dark surfaces
        tooltipBg: '#1f2937',   // gray-800
        tooltipBorder: '#374151',
        tooltipText: '#f3f4f6', // gray-100
      }
    : {
        grid: '#e5e7eb',        // gray-200 (current hardcoded value)
        axis: '#6b7280',        // gray-500
        accent: '#2563eb',      // blue-600 (current hardcoded value)
        tooltipBg: '#ffffff',
        tooltipBorder: '#e5e7eb',
        tooltipText: '#111827', // gray-900
      };
}
```

- [ ] **Step 2: Apply in SalesCharts**

In `SalesCharts.tsx`:
- `const colors = useChartColors();` at the top of the component.
- Replace every `stroke="#e5e7eb"` on `CartesianGrid` with `stroke={colors.grid}`.
- Replace every `stroke="#2563eb"` / `fill="#2563eb"` on `Line`/`Bar` with `{colors.accent}`.
- On every `XAxis` and `YAxis`, add `tick={{ fill: colors.axis, fontSize: 12 }}` and `stroke={colors.grid}` (merge with any existing tick props rather than dropping them).
- On every `Tooltip`, add `contentStyle={{ backgroundColor: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, color: colors.tooltipText }}` and `labelStyle={{ color: colors.tooltipText }}`.
- Add `dark:` variants to the chart card wrappers in this file per the Global Constraints mapping (e.g. `bg-white` → `bg-white dark:bg-gray-800`, headings `text-gray-900 dark:text-gray-100`).
- Mobile: if the charts are in a multi-column grid, make it `grid-cols-1 lg:grid-cols-2` (or `lg:grid-cols-3` if three across today) so charts stack on phones.

- [ ] **Step 3: Type-check and build**

Run: `npm run build --workspace @alejinput/frontend`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/hooks/useChartColors.ts packages/frontend/src/components/admin/SalesCharts.tsx
git commit -m "feat(theme): theme-aware Recharts colors, charts stack on mobile"
```

---

### Task 6: Modal + dialog components — responsive width and dark variants

**Files:**
- Modify: `packages/frontend/src/components/Modal.tsx`
- Modify: `packages/frontend/src/components/sales/VoidConfirmDialog.tsx`
- Modify: `packages/frontend/src/components/shift/ClockOutConfirmDialog.tsx`
- Modify: `packages/frontend/src/components/shift/ForceClockOutConfirmDialog.tsx`
- Modify: `packages/frontend/src/components/sales/AuditDrawer.tsx`

**Interfaces:**
- Consumes/Produces: no API changes — `Modal` props (`open`, `onClose`, `title`, `children`, `footer`) stay identical.

- [ ] **Step 1: Make Modal responsive and dark-aware**

In `Modal.tsx`, change the card div (line 34) from:

```tsx
className="bg-white rounded-lg shadow-xl w-[480px] max-h-[90vh] overflow-y-auto"
```

to:

```tsx
className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-[480px] mx-4 max-h-[90vh] overflow-y-auto"
```

Then apply the Global Constraints palette mapping to the rest of the file: title `text-gray-900` → add `dark:text-gray-100`; borders `border-gray-200` → add `dark:border-gray-700`; close button `text-gray-400 hover:text-gray-600` → add `dark:text-gray-500 dark:hover:text-gray-300`. The overlay `bg-gray-900/50` works for both themes — leave it.

- [ ] **Step 2: Sweep the four dialog/drawer components**

For each of `VoidConfirmDialog.tsx`, `ClockOutConfirmDialog.tsx`, `ForceClockOutConfirmDialog.tsx`, `AuditDrawer.tsx`:
- If it renders its own fixed-width card (not via `Modal`), apply the same `w-full max-w-[N] mx-4` pattern.
- `AuditDrawer` (side panel): on mobile use full width — `w-full sm:w-[N]` where N is its current fixed width.
- Apply the Global Constraints palette mapping to every color utility class in these files. Destructive red buttons: keep `bg-red-600 text-white` as-is.

- [ ] **Step 3: Type-check and build**

Run: `npm run build --workspace @alejinput/frontend`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/Modal.tsx packages/frontend/src/components/sales/VoidConfirmDialog.tsx packages/frontend/src/components/shift/ClockOutConfirmDialog.tsx packages/frontend/src/components/shift/ForceClockOutConfirmDialog.tsx packages/frontend/src/components/sales/AuditDrawer.tsx
git commit -m "feat(ui): responsive dark-aware modals, dialogs, and audit drawer"
```

---

### Task 7: Dark + mobile sweep — sales & shift components

**Files (modify all):**
- `packages/frontend/src/components/sales/SalesTable.tsx`
- `packages/frontend/src/components/sales/AddRowForm.tsx` (color classes only — selects done in Task 4)
- `packages/frontend/src/components/sales/EditableCell.tsx` (color classes only)
- `packages/frontend/src/components/shift/ClockControl.tsx`
- `packages/frontend/src/components/shift/ShiftTotalsBanner.tsx`
- `packages/frontend/src/components/shift/ShiftHistoryTable.tsx`
- `packages/frontend/src/components/shift/AdminShiftTabs.tsx`
- `packages/frontend/src/components/StatusBadge.tsx`
- `packages/frontend/src/components/PaginationFooter.tsx`
- `packages/frontend/src/pages/SalesPage.tsx`
- `packages/frontend/src/pages/ShiftHistoryPage.tsx`

**Interfaces:** none — class-only changes; no prop or export changes allowed in this task.

- [ ] **Step 1: Apply the palette mapping to every color utility in the listed files**

Mechanical rule: for each className containing a color utility listed in Global Constraints, append the mapped `dark:` variant(s). Specific per-file requirements on top of the mapping:
- `SalesTable.tsx`: header row (line 165) `bg-gray-100 border-b border-gray-200` → add `dark:bg-gray-800 dark:border-gray-700`; sticky header keeps `z-10`. The scroll container at line 161 already handles horizontal overflow (`overflow-auto` + `minWidth: 1060px` on the table) — verify, don't change. Void-row styling gets dark-safe equivalents per the red mapping.
- `AddRowForm.tsx`: textarea `border-gray-300 ... disabled:bg-gray-100` → add `dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-900`; Discard button and muted `text-gray-400` spans per mapping. Error text `text-red-600` → add `dark:text-red-400`.
- `StatusBadge.tsx`: each hue follows the badge pattern from Global Constraints (`bg-X-100 text-X-800` → add `dark:bg-X-900 dark:text-X-200`).
- `PaginationFooter.tsx`: buttons/labels per mapping; ensure the footer wraps on narrow screens (`flex-wrap gap-2` if it's a single flex row).
- `ClockControl.tsx`, `ShiftTotalsBanner.tsx`, `AdminShiftTabs.tsx`, `ShiftHistoryTable.tsx`: mapping throughout; `ShiftHistoryTable`'s existing `overflow-x-auto` wrapper (line 146) stays — add `min-w-[640px]` to its `<table className="w-full">` so columns don't crush on phones.
- `SalesPage.tsx`, `ShiftHistoryPage.tsx`: page headings/copy per mapping; any page-level `p-8`/fixed paddings become `p-4 md:p-8` ONLY if the page adds its own padding (the layout already provides main padding — don't double it); toolbars get `flex-wrap gap-2`.

- [ ] **Step 2: Type-check and build**

Run: `npm run build --workspace @alejinput/frontend`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/sales packages/frontend/src/components/shift packages/frontend/src/components/StatusBadge.tsx packages/frontend/src/components/PaginationFooter.tsx packages/frontend/src/pages/SalesPage.tsx packages/frontend/src/pages/ShiftHistoryPage.tsx
git commit -m "feat(theme): dark variants and mobile fixes for sales and shift screens"
```

---

### Task 8: Dark + mobile sweep — admin, catalog, users screens

**Files (modify all):**
- `packages/frontend/src/pages/DashboardPage.tsx`
- `packages/frontend/src/pages/AdminShiftsPage.tsx`
- `packages/frontend/src/pages/UsersPage.tsx`
- `packages/frontend/src/pages/ProductsPage.tsx`
- `packages/frontend/src/pages/MopsPage.tsx`
- `packages/frontend/src/pages/ReceiversPage.tsx`
- `packages/frontend/src/components/admin/AdminSalesTable.tsx`
- `packages/frontend/src/components/admin/SalesFilterBar.tsx` (color classes only — selects done in Task 4)
- `packages/frontend/src/components/admin/StatCard.tsx`
- `packages/frontend/src/components/admin/KpiCard.tsx`
- `packages/frontend/src/components/catalog/ProductModal.tsx`
- `packages/frontend/src/components/catalog/MopModal.tsx`
- `packages/frontend/src/components/catalog/ReceiverModal.tsx`
- `packages/frontend/src/components/users/UserModal.tsx`
- `packages/frontend/src/components/users/InviteModal.tsx`
- `packages/frontend/src/components/users/ResetPasswordModal.tsx`

**Interfaces:** none — class-only changes; no prop or export changes allowed in this task.

- [ ] **Step 1: Apply the palette mapping + mobile stacking to the listed files**

Mechanical mapping as in Task 7, plus:
- `AdminSalesTable.tsx`: existing `overflow-x-auto` wrapper (line 275) stays; add `min-w-[900px]` to the `<table className="w-full">`. Header/body colors per mapping.
- `SalesFilterBar.tsx`: it already uses `flex-wrap` — verify each field group behaves on 375px width (fixed `w-48`/`w-40` are fine); labels and inputs per mapping (`border-gray-300` date inputs also get `dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600` + `dark:[color-scheme:dark]` so the native picker icon is visible).
- `StatCard.tsx` / `KpiCard.tsx`: card surfaces `bg-white` → add `dark:bg-gray-800`; value/label text per mapping.
- `DashboardPage.tsx`: any stat/KPI grid becomes `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (keep current desktop column count as the largest tier).
- Catalog/users pages: page header rows (`title + Add button`) get `flex-wrap gap-2`; tables that lack an `overflow-x-auto` wrapper get one (`<div className="overflow-x-auto">` around the table, `min-w-[640px]` on the table).
- All six modals (catalog + users): body form fields per mapping — inputs get `dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600`; labels `text-gray-700` → add `dark:text-gray-300`; helper/error text per mapping. Layout comes from `Modal` (Task 6) — no width changes here.

- [ ] **Step 2: Type-check and build**

Run: `npm run build --workspace @alejinput/frontend`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/pages packages/frontend/src/components/admin packages/frontend/src/components/catalog packages/frontend/src/components/users
git commit -m "feat(theme): dark variants and mobile fixes for admin, catalog, users screens"
```

---

### Task 9: Auth pages (login, invite-register) — dark + mobile

**Files:**
- Modify: `packages/frontend/src/pages/LoginPage.tsx`
- Modify: `packages/frontend/src/pages/InviteRegisterPage.tsx`

**Interfaces:** none.

- [ ] **Step 1: Apply mapping + responsive padding**

Both pages: outer wrapper gets `px-4` so the centered card never touches screen edges at 375px; card `bg-white` → add `dark:bg-gray-800` and `w-full max-w-[N]` if it has a fixed width; page background `bg-gray-50` → add `dark:bg-gray-900`; inputs/labels/buttons/errors per the Global Constraints mapping (inputs: `dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600`).

- [ ] **Step 2: Type-check and build**

Run: `npm run build --workspace @alejinput/frontend`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/pages/LoginPage.tsx packages/frontend/src/pages/InviteRegisterPage.tsx
git commit -m "feat(theme): dark and mobile support for login and invite pages"
```

---

### Task 10: End-to-end verification pass (Playwright)

**Files:**
- Modify: whatever the pass uncovers (fixes only; no new features).

- [ ] **Step 1: Build and start the app**

Run: `npm run build --workspace @alejinput/frontend`, then start the dev servers the way this repo normally runs them (backend + `vite`). Expected: app reachable at `http://localhost:5173`.

- [ ] **Step 2: Playwright pass — desktop light (1280×800)**

Log in as an admin. Visit: Dashboard, Sales, Products, MOPs, Receivers, Users, Shifts. Expected: layout identical to pre-change (sidebar visible, no top bar, spacing unchanged).

- [ ] **Step 3: Playwright pass — desktop dark**

Click the sidebar "Dark mode" toggle. Expected: entire viewport switches (no white patches — check table headers, modals via opening one, filter selects, charts, badges). Reload the page. Expected: dark persists with no white flash.

- [ ] **Step 4: Playwright pass — mobile (375×812), both themes**

Resize to 375×812. Expected: top bar with hamburger; no sidebar. Open the drawer: nav items, (moderator) clock control, dark toggle, logout all present; backdrop click, nav click, and Escape each close it. Sales sheet: table scrolls horizontally inside its container; page body does NOT scroll horizontally; a cell can be edited; Add Row works. Dashboard: cards and charts stacked single-column. Open one modal: fits the viewport with margins. Toggle dark in the drawer: everything switches.

- [ ] **Step 5: Moderator pass — mobile**

Log in as a moderator at 375×812: Sales Sheet + Shift History nav only, clock in/out control usable in drawer.

- [ ] **Step 6: Fix anything found, re-run the failing check, commit**

```bash
git add -A packages/frontend
git commit -m "fix(theme): issues found in mobile/dark verification pass"
```

(Skip the commit if nothing was found.)

---

## Self-Review (completed)

- **Spec coverage:** infra §1 → Task 1; toggle §2 → Task 2; dark variants §3 → Tasks 2, 4–9; react-select → Task 4; Recharts → Task 5; mobile nav §4 → Task 3; content adaptations §5 → Tasks 5–9 (padding in Task 3's `main`); error handling (localStorage) → Task 1; testing → per-task builds + Task 10. Viewport meta: verified present in `index.html` — no change needed.
- **Placeholder scan:** Tasks 6–9 use the exact Global Constraints mapping table plus per-file requirements instead of full file listings (30+ files of class edits); every instruction names the exact classes to add.
- **Type consistency:** `useThemeStore` / `toggleTheme` (Tasks 1→2→5), `SidebarContent({ onNavigate })` (Tasks 2→3), `makeSelectStyles(opts)` (Task 4 only) — names match across tasks.
