import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// __dirname equivalent in ESM — resolves to the packages/frontend/ directory
// (where this config file lives), regardless of where `vite --config` is invoked from.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  root: __dirname, // Vite root = packages/frontend/ (where index.html lives)
  plugins: [react()],
  server: {
    port: 5173, // Matches CLIENT_ORIGIN in .env and .env.example
    proxy: {
      // Proxy all /api/* requests to the backend Express server
      // This means fetch('/api/health') in the frontend hits http://localhost:3001/health
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
