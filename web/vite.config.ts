import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/catalog': {
        target: 'http://localhost:8081',
        changeOrigin: false,
      },
      '/api/cart': {
        target: 'http://localhost:8082',
        changeOrigin: false,
      },
      '/api/orders': {
        target: 'http://localhost:8083',
        changeOrigin: false,
      },
    },
  },
  // Ensure dev-public is only served in dev mode
  publicDir: 'public',
});
