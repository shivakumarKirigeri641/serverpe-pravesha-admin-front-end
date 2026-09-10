import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * In development the panel runs on 3200 and the API on 7777, so /admin/api is
 * proxied — same-origin in the browser, which keeps the bearer token and the
 * CSV downloads working exactly as they will in production.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3200,
    proxy: {
      '/admin/api': { target: 'http://localhost:7777', changeOrigin: true },
    },
  },
});
