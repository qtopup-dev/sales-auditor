import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/axios';
import { queryClient } from '../lib/queryClient';

// Admin nav items per CONTEXT.md D-04 and UI-SPEC.md §AuthenticatedLayout
const ADMIN_NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/sales', label: 'Sales' },
  { to: '/products', label: 'Products' },
  { to: '/mops', label: 'MOPs' },
  { to: '/users', label: 'Users' },
];

// Moderator nav items per CONTEXT.md D-04 (ROLES-07: only Sales Sheet visible)
const MODERATOR_NAV = [{ to: '/sales', label: 'Sales Sheet' }];

export function AuthenticatedLayout() {
  const { user, setUser } = useAuthStore();
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
    <div className="flex h-screen overflow-hidden antialiased">
      {/* Sidebar — 240px fixed width per UI-SPEC.md */}
      <aside className="w-60 flex-shrink-0 bg-gray-100 border-r border-gray-200 flex flex-col">
        {/* App name */}
        <div className="px-6 py-6">
          <span className="text-xl font-semibold text-gray-900">Sales Auditor</span>
        </div>

        {/* Nav items — role-based (D-04, D-06: same layout, filtered items) */}
        <nav className="flex-1 px-2 py-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive
                  ? 'flex items-center px-4 py-2 text-sm text-blue-700 bg-blue-50 border-l-2 border-blue-600 min-h-[44px]'
                  : 'flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 hover:text-gray-900 min-h-[44px]'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: username + logout */}
        <div className="px-4 py-4 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-2 truncate">{user?.username}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          >
            Log Out
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 bg-gray-50 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
