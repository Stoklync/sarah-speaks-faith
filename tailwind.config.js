/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'soft-rose': '#fce7f3',
        'soft-pink-rose': '#fbcfe8',
      },
    },
  },
  plugins: [],
}

