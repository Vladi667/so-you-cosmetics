/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ivory: '#FAF9F6',
        cream: '#FFFDD0',
        'mist-blue': '#B0C4DE',
        'stone-gray': '#8B8C89',
        'navy-blue': '#000080',
        sage: '#9DC183',
        lavender: '#E6E6FA',
        'botanical-green': '#556B2F',
        gold: '#CFB53B',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        fadeIn: 'fadeIn 1.5s ease-out forwards',
        fadeInUp: 'fadeInUp 1.5s ease-out forwards',
      }
    },
  },
  plugins: [],
}
