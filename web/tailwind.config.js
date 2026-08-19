/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#E8E0CC',
          dark: '#D5CCB3',
        },
        forest: {
          DEFAULT: '#1E3D20',
          dark: '#142915',
          light: '#2A522C',
        },
        clubBlack: {
          DEFAULT: '#1A1A1A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Oswald', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
