import './index.css';               // Tailwind CSS v3 directives — MUST be first import
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './lib/queryClient';
import { router } from './router';
import { api } from './lib/axios';
import { useAuthStore } from './stores/authStore';
import type { AuthUser } from './stores/authStore';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

// Rehydrate auth state from server session before rendering.
// Without this, Zustand resets to null on every page refresh and ProtectedRoute
// immediately redirects to /login even when a valid session cookie exists.
api.get<{ user: AuthUser }>('/auth/me')
  .then((r) => useAuthStore.getState().setUser(r.data.user))
  .catch(() => useAuthStore.getState().setUser(null))
  .finally(() => {
    createRoot(rootElement).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </StrictMode>,
    );
  });
