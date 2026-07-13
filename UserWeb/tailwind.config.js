/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          maroon: '#8B0000',
          gold: '#D4AF37',
          cream: '#F8F1E7',
          ink: '#2F1B1B',
          rose: '#F6E0DD'
        }
      },
      boxShadow: {
        soft: '0 20px 45px rgba(70, 22, 22, 0.12)'
      }
    },
  },
  plugins: [],
};
