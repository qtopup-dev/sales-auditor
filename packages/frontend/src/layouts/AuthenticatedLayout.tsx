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
