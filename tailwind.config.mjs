/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sage: {
          DEFAULT: '#8B9A6E',
          50: '#F5F7F1',
          100: '#E9EFE2',
          200: '#D5E1C7',
          300: '#BDCFA9',
          400: '#A4BC8B',
          500: '#8B9A6E',
          600: '#717E57',
          700: '#576241',
          800: '#3D452C',
          900: '#232819',
        },
        ivory: {
          DEFAULT: '#F7F2EB',
          50: '#FDFCFB',
          100: '#FAF8F4',
          200: '#F7F2EB',
          300: '#EFE6D7',
          400: '#E4D7C0',
          500: '#D6C3A3',
        },
        warmBorder: '#EAE2D6',
        mutedNeutral: '#EEEEEE',
        coffeeYellow: '#FFDD00',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
