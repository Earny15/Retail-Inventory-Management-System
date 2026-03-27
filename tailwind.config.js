/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        navy: {
          50: '#f0f4fa',
          100: '#dce4f0',
          200: '#b8c9e2',
          300: '#8eabd1',
          400: '#5b86bc',
          500: '#3563a0',
          600: '#264a80',
          700: '#1b3664',
          800: '#142952',
          900: '#0f1d3d',
        }
      }
    },
  },
  plugins: [],
}