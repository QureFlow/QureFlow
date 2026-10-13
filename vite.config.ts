import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      watch: {
        // Backend compilation and verification artifacts must not reset an in-progress booking.
        ignored: ['**/backend/**', '**/docs/**', '**/dist/**', '**/*.md'],
      },
      proxy: {
        '/api': {
          target: `http://localhost:${env.VITE_BACKEND_PORT || '5000'}`,
          changeOrigin: true,
        },
      },
    },
  };
});
