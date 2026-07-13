/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          maroon: '#7a1f2a',
          gold: '#c6a86a',
          ink: '#1f1b1c',
          sand: '#f5efe6',
        },
      },
      boxShadow: {
        soft: '0 18px 50px rgba(52, 24, 28, 0.12)',
      },
    },
  },
  plugins: [],
};
