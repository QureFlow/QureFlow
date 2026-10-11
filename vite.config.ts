import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    watch: {
      // Backend compilation and verification artifacts must not reset an in-progress booking.
      ignored: ['**/backend/**', '**/docs/**', '**/dist/**', '**/*.md'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
