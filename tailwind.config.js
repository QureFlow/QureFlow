/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f6fe',
          100: '#ddeafe',
          200: '#c2dbfd',
          300: '#99c3fc',
          400: '#67a0f8',
          500: '#3b7ef3',
          600: '#2360e7',
          700: '#1b4bcd',
          800: '#1c3ea5',
          900: '#1c3682',
          950: '#0c2340', // deep navy
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
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'card': '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.06)',
        'elevated': '0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
      }
    },
  },
  plugins: [],
}
