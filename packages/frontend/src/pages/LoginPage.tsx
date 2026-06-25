import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/axios';
import { useAuthStore } from '../stores/authStore';
import type { AuthUser } from '../stores/authStore';

type LoginFormData = { username: string; password: string };

// AUTH-01: login with username and password
// CONTEXT.md D-10: admin → /dashboard, moderator → /sales
// CONTEXT.md D-11: returnTo from location.state applied after login
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuthStore();

  // If a server session already exists (e.g. page refresh), skip the login screen
  useEffect(() => {
    api.get<{ user: AuthUser }>('/auth/me').then((res) => {
      setUser(res.data.user);
      const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
      const defaultRoute = res.data.user.role === 'admin' ? '/dashboard' : '/sales';
      navigate(returnTo ?? defaultRoute, { replace: true });
    }).catch(() => {
      // No active session — stay on login page
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    try {
      const res = await api.post<{
        user: {
          id: number;
          username: string;
          role: 'admin' | 'moderator';
          canEdit: boolean;
          organizationId: number;
        };
      }>('/auth/login', data);
      setUser(res.data.user);
      // CONTEXT.md D-11: honor returnTo if present (set by ProtectedRoute or 401 interceptor)
      const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
      const defaultRoute = res.data.user.role === 'admin' ? '/dashboard' : '/sales';
      navigate(returnTo ?? defaultRoute, { replace: true });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 401) {
        // UI-SPEC.md Copywriting: single error — no username enumeration (T-02-P05-01)
        setError('root', { message: 'Invalid username or password.' });
      } else {
        setError('root', { message: 'Something went wrong. Please try again.' });
      }
    }
  };

  return (
    // Full viewport centering — login is outside AuthenticatedLayout
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-[400px] p-8 border border-gray-200 rounded-lg shadow-sm bg-white">
        {/* Heading — UI-SPEC.md Copywriting Contract */}
        <h1 className="text-2xl font-semibold text-gray-900">Sales Auditor</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">Sign in to your account</p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Username field */}
          <div className="mb-4">
            <label htmlFor="username" className="text-sm text-gray-500 block mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              disabled={isSubmitting}
              {...register('username', { required: 'Username is required' })}
              className={`h-10 w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.username
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
            />
            {errors.username && (
              <p className="text-sm text-red-600 mt-1">{errors.username.message}</p>
            )}
          </div>

          {/* Password field */}
          <div className="mb-6">
            <label htmlFor="password" className="text-sm text-gray-500 block mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              disabled={isSubmitting}
              {...register('password', { required: 'Password is required' })}
              className={`h-10 w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.password
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
            />
            {errors.password && (
              <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Form-level error (401 or network error) — single error below fields (T-02-P05-01) */}
          {errors.root && (
            <p className="text-sm text-red-600 mt-1 mb-4">{errors.root.message}</p>
          )}

          {/* Submit button — pessimistic UI: disabled + label change during round-trip (CLAUDE.md Rule 10) */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Signing in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
