import axios from 'axios';
import { queryClient } from './queryClient';
import { router } from '../router';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Required: session cookie must be sent on all /api requests (RESEARCH.md)
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 401) {
      // Guard: skip redirect on /login (prevents circular redirect loop — login form 401s
      // are handled in onSubmit catch, not here) and /invite/:token (public route hit by
      // anonymous visitors; the background /auth/me rehydration in main.tsx always 401s
      // for them and must not bounce them away from the invite form).
      const currentPath = (router.state as { location: { pathname: string } }).location.pathname;
      if (currentPath !== '/login' && !currentPath.startsWith('/invite/')) {
        queryClient.clear();
        // CONTEXT.md D-11: store returnTo in location state (not server-side — no open redirect risk)
        router.navigate('/login', {
          state: { returnTo: currentPath },
          replace: true,
        });
      }
    }
    return Promise.reject(error);
  },
);
