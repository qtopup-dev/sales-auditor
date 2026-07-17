import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { getAuthUser } from '../stores/authStore';
import { AuthenticatedLayout } from '../layouts/AuthenticatedLayout';
import { LoginPage } from '../pages/LoginPage';
import { InviteRegisterPage } from '../pages/InviteRegisterPage';
import { DashboardPage } from '../pages/DashboardPage';
import { SalesPage } from '../pages/SalesPage';
import { UsersPage } from '../pages/UsersPage';
import { ProductsPage } from '../pages/ProductsPage';
import { MopsPage } from '../pages/MopsPage';
import { ReceiversPage } from '../pages/ReceiversPage';
import { ShiftHistoryPage } from '../pages/ShiftHistoryPage';
import { AdminShiftsPage } from '../pages/AdminShiftsPage';

// ─── ProtectedRoute ──────────────────────────────────────────────────────────
// CONTEXT.md D-11: stores returnTo in location.state for post-login redirect
// ROLES-07/08: requiredRole='admin' redirects non-admins to /sales; no requiredRole allows all authenticated users

function ProtectedRoute({ requiredRole }: { requiredRole?: 'admin' | 'moderator' }) {
  const user = getAuthUser();
  const location = useLocation();

  if (!user) {
    // Not authenticated — redirect to login with returnTo stored in location state
    return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    // Wrong role — redirect to their default page
    return <Navigate to={user.role === 'admin' ? '/dashboard' : '/sales'} replace />;
  }

  return <Outlet />;
}

export const router = createBrowserRouter([
  // Unauthenticated routes
  { path: '/login', element: <LoginPage /> },
  { path: '/invite/:token', element: <InviteRegisterPage /> },

  // All authenticated routes wrapped in ProtectedRoute (requires any valid session)
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AuthenticatedLayout />,
        children: [
          // Moderator route — accessible to both roles
          { path: '/sales', element: <SalesPage /> },
          { path: '/shift-history', element: <ShiftHistoryPage /> },

          // Admin-only routes — ProtectedRoute with requiredRole='admin'
          {
            element: <ProtectedRoute requiredRole="admin" />,
            children: [
              { path: '/dashboard', element: <DashboardPage /> },
              { path: '/products', element: <ProductsPage /> },
              { path: '/mops', element: <MopsPage /> },
              { path: '/receivers', element: <ReceiversPage /> },
              { path: '/users', element: <UsersPage /> },
              { path: '/shifts', element: <AdminShiftsPage /> },
            ],
          },
        ],
      },
    ],
  },

  // Fallback redirect
  { path: '*', index: true, element: <Navigate to="/login" replace /> },
]);
