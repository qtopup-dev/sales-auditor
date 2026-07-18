import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/axios';

type RegisterFormData = { username: string; password: string; confirmPassword: string };

// AUTH-05/AUTH-06: register via invite link
// GET /api/auth/invite/:token validates without consuming (stateless GET — RESEARCH.md Pitfall 7)
// POST /api/auth/invite/:token consumes token + creates user
export function InviteRegisterPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  // Token validity state — null = loading, true = valid, false = invalid/expired
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterFormData>();

  // Validate token on mount (stateless GET — no mutation, no token consumption)
  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      return;
    }
    api
      .get(`/auth/invite/${token}`)
      .then(() => setTokenValid(true))
      .catch(() => setTokenValid(false));
  }, [token]);

  const onSubmit = async (data: RegisterFormData) => {
    if (!token) return;
    try {
      await api.post(`/auth/invite/${token}`, {
        username: data.username,
        password: data.password,
      });
      // On success: redirect to /login (UI-SPEC.md — no success screen, immediate redirect)
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      if (apiError === 'INVITE_INVALID') {
        setTokenValid(false); // Show expired card
      } else {
        setError('root', { message: 'Something went wrong. Please try again.' });
      }
    }
  };

  // Loading state
  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Checking invite link...</p>
      </div>
    );
  }

  // Expired/used token — error card (no form per UI-SPEC.md)
  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-[400px] p-8 border border-gray-200 rounded-lg shadow-sm bg-white">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Invite Link Invalid</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This invite link has expired or already been used. Contact your admin for a new link.
          </p>
        </div>
      </div>
    );
  }

  const password = watch('password');

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-[400px] p-6 sm:p-8 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-800">
        {/* Heading — UI-SPEC.md Copywriting Contract */}
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Create Your Account</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">Set a password to complete registration</p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Username field */}
          <div className="mb-4">
            <label htmlFor="reg-username" className="text-sm text-gray-500 dark:text-gray-400 block mb-1">
              Username
            </label>
            <input
              id="reg-username"
              type="text"
              autoComplete="username"
              disabled={isSubmitting}
              {...register('username', {
                required: 'Username is required',
                minLength: { value: 2, message: 'Username must be at least 2 characters' },
                maxLength: { value: 100, message: 'Username must be 100 characters or fewer' },
              })}
              className={`h-10 w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.username
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
              }`}
            />
            {errors.username && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.username.message}</p>
            )}
          </div>

          {/* Password field */}
          <div className="mb-4">
            <label htmlFor="reg-password" className="text-sm text-gray-500 dark:text-gray-400 block mb-1">
              Password
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters.' },
              })}
              className={`h-10 w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.password
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
              }`}
            />
            {errors.password && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm password field */}
          <div className="mb-6">
            <label htmlFor="reg-confirm" className="text-sm text-gray-500 dark:text-gray-400 block mb-1">
              Confirm Password
            </label>
            <input
              id="reg-confirm"
              type="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (value) => value === password || 'Passwords do not match.',
              })}
              className={`h-10 w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.confirmPassword
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
              }`}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Form-level error */}
          {errors.root && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1 mb-4">{errors.root.message}</p>
          )}

          {/* Submit button — pessimistic UI: disabled + label change during round-trip (CLAUDE.md Rule 10) */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
