/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef8fa',
          100: '#daf0f3',
          200: '#b6e0e7',
          300: '#7ac5d2',
          400: '#3eabbd',
          500: '#168fa5',
          600: '#087b91',
          700: '#096378',
          800: '#104e60',
          900: '#133d4e',
          950: '#102e3d',
        },
        navy: {
          800: '#142c4b',
          900: '#0c2340',
          950: '#08172b',
        },
        clinic: {
          bg: '#f8fafc',
          card: '#ffffff',
          border: '#e2e8f0',
          subtle: '#f1f5f9',
          muted: '#64748b',
          dark: '#0f172a',
        },
        status: {
          waiting: '#f59e0b',
          serving: '#2563eb',
          completed: '#16a34a',
          cancelled: '#dc2626',
          paused: '#6b7280',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        subtle: '0 2px 5px rgba(16, 46, 61, 0.035)',
        card: '0 4px 20px rgba(16, 46, 61, 0.045)',
        elevated: '0 12px 36px rgba(16, 46, 61, 0.10)',
      },
    },
  },
  plugins: [],
};
