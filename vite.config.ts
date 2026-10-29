import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    build: { outDir: mode === 'mobile' ? 'dist-mobile' : 'dist' },
    server: {
      // 5173 is Vite's default and is often taken by other local projects.
      port: 5180,
      strictPort: true,
      watch: {
        // Backend compilation and verification artifacts must not reset an in-progress booking.
        ignored: ['**/backend/**', '**/docs/**', '**/dist/**', '**/dist-mobile/**',
          '**/android/**', '**/scripts/**', '**/capacitor.config.ts', '**/*.md'],
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
