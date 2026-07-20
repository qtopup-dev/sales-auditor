import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { api } from '../lib/axios';
import { queryClient } from '../lib/queryClient';
import { ClockControl } from '../components/shift/ClockControl';
import { ChangePasswordModal } from '../components/users/ChangePasswordModal';

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

// Sidebar body — shared between the static desktop aside and the mobile drawer
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

  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Escape closes the dropdown (same pattern as the mobile-drawer Escape handler).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Click-outside closes the dropdown (no existing analog — standard useRef + mousedown idiom).
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

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

      {/* Dark mode toggle — above username/logout */}
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

      {/* Bottom: username dropdown (Change Password + Log Out) — replaces the old plain username + Log Out */}
      <div ref={menuRef} className="relative px-4 py-4 border-t border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex items-center justify-between w-full px-4 py-2 min-h-[44px] text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span className="truncate">{user?.username}</span>
          {/* Chevron — up when closed (menu opens upward) */}
          <svg
            className={`w-4 h-4 flex-shrink-0 ${menuOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute bottom-full left-4 right-4 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 z-50"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setPasswordModalOpen(true);
              }}
              className="flex items-center w-full px-4 py-2 min-h-[44px] text-sm font-normal text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
            >
              Change Password
            </button>
            <div className="border-t border-gray-200 dark:border-gray-700" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                handleLogout();
              }}
              className="flex items-center w-full px-4 py-2 min-h-[44px] text-sm font-normal text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
            >
              Log Out
            </button>
          </div>
        )}
      </div>

      <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
    </>
  );
}

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
