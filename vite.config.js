import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* The admin panel talks to the Pravesha back-end and nothing else. In
   development Vite proxies /admin to it; in production VITE_API_BASE points at
   api.pravesha.in and this builds to static files. */
const API = process.env.VITE_PROXY_TARGET || 'http://localhost:5005';

export default defineConfig({
  plugins: [react()],
  server: { port: 5200, proxy: { '/admin': { target: API, changeOrigin: true } } },
  preview: { port: 5201, proxy: { '/admin': { target: API, changeOrigin: true } } },
  build: { outDir: 'dist', sourcemap: false },
});
