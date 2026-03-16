# Mobile-Friendly Layout + Dark Mode — Design

**Date:** 2026-03-16
**Status:** Approved by user (pre-implementation)

## Goal

Make the entire Sales Auditing app usable on phones (≥375px wide) and add a
user-controlled dark mode with a toggle at the bottom of the side nav.

## Decisions (user-confirmed)

| Decision | Choice |
|---|---|
| Tables on mobile | Horizontal scroll inside `overflow-x-auto` containers (no card layouts) |
| Nav on mobile | Hamburger in a sticky top bar + slide-in overlay drawer |
| Dark mode default | Follow OS `prefers-color-scheme`; user toggle overrides, persisted in localStorage |
| Dark mode mechanism | Tailwind `darkMode: 'class'` + `dark:` variants (no CSS-variable theme refactor) |
| Mobile mechanism | Tailwind responsive utilities; JS only for drawer open/close state |
| Breakpoint | `md` (768px): below = mobile top bar + drawer; at/above = current fixed 240px sidebar, unchanged |

## 1. Dark mode infrastructure

- Add `darkMode: 'class'` to the inline Tailwind config in
  `packages/frontend/vite.config.ts` and to the stub
  `packages/frontend/tailwind.config.js` (kept in sync for editor tooling).
- New `packages/frontend/src/stores/themeStore.ts` (Zustand):
  - `theme: 'light' | 'dark'` and `toggleTheme()`.
  - Initial value: `localStorage['theme']` if set, else
    `matchMedia('(prefers-color-scheme: dark)')`.
  - Setting theme writes localStorage and toggles the `dark` class on
    `document.documentElement`.
- Inline `<script>` in `packages/frontend/index.html` (before the app bundle)
  applies the `dark` class from the same localStorage key / media query before
  first paint — prevents light-flash on reload.

## 2. Toggle in the side nav

- Location: bottom of the sidebar in `AuthenticatedLayout.tsx`, directly above
  the username/logout block (below `ClockControl` for moderators).
- A full-width button styled like a nav item: sun/moon inline SVG + label
  ("Dark mode" / "Light mode"), `min-h-[44px]` touch target.
- Present identically inside the mobile drawer (same component, same slot).

## 3. Dark variants across components

- Add `dark:` classes to every component with color utilities: layout, all
  pages, tables (`SalesTable`, `AdminSalesTable`, `ShiftHistoryTable`, catalog
  pages), modals, forms, badges, filter bars, cards, drawers, dialogs.
- Palette mapping (consistent everywhere):
  - Surfaces: `bg-gray-50/white/gray-100` → `dark:bg-gray-900/gray-800`
  - Borders: `border-gray-200/300` → `dark:border-gray-700`
  - Text: `text-gray-900/700/500` → `dark:text-gray-100/300/400`
  - Blue accents/active states stay blue; adjust light-blue washes
    (`bg-blue-50` → `dark:bg-blue-950`-style equivalents).
  - Status colors (badges, void rows) get dark-safe equivalents.
- **react-select** (renders inline styles, ignores Tailwind): one shared
  module `packages/frontend/src/lib/selectStyles.ts` whose style values read
  CSS custom properties defined on `:root` and `.dark` in `index.css`. All
  react-select instances use it.
- **Recharts**: `useChartColors()` hook returning axis/grid/text/tooltip
  colors keyed off `themeStore`; `SalesCharts` consumes it.

## 4. Mobile navigation

- `AuthenticatedLayout.tsx`:
  - `< md`: sticky top bar (app name + hamburger button, 44px target).
    Sidebar renders as a fixed overlay drawer (same content) sliding in from
    the left with a semi-opaque backdrop.
  - Drawer closes on: nav item click, backdrop click, Escape key.
  - Drawer open state is local `useState` (not persisted, not global).
  - `>= md`: exactly the current static sidebar; top bar hidden.
- Clock control, dark-mode toggle, username, and logout all live inside the
  sidebar/drawer, so mobile loses nothing.

## 5. Mobile content adaptations

- Main content padding: `p-4 md:p-8`.
- Tables: wrap in `overflow-x-auto`; tables keep `min-w` so columns hold
  their widths and the container scrolls sideways.
- Filter bars, stat/KPI card grids, dashboard charts, Add Row form: stack to
  1–2 columns on small screens (`grid-cols-1 sm:grid-cols-2 ...`).
- Modals/dialogs: near-full-width with outer margin on phones
  (`mx-4 w-full max-w-*`), `max-h` with internal scroll.
- Login / invite-register pages: responsive padding around the centered card.
- Viewport meta tag in `index.html`: verify present and correct.

## Error handling

- localStorage unavailable (private mode): theme falls back to media query;
  toggle still works for the session (in-memory state).
- No backend changes; no API surface touched.

## Testing

1. `tsc` type-check + `vite build` pass.
2. Playwright smoke pass at 375×812 and 1280×800, both themes: login, sales
   sheet (scroll + edit a cell), dashboard, one catalog page, users page,
   drawer open/close, toggle persistence across reload.

## Out of scope

- Card-style mobile tables, bottom tab bar, per-user server-side theme
  preference, PWA/offline, backend changes.
