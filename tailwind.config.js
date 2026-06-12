/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        emerald: {
          50: '#e6fbf6',
          100: '#c2f5e8',
          200: '#8fe9d3',
          300: '#5cdcc0',
          400: '#2eecc4',
          500: '#07e6ae',
          600: '#06c89a',
          700: '#048a6a',
          800: '#036b53',
          900: '#024a3a',
        },
      },
    },
  },
  plugins: [],
}
