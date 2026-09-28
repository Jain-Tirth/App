/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#C42369',
          'primary-hover': '#A81C58',
          'primary-soft': '#FBF0F4',
          canvas: '#FAF7F2',
          surface: '#FFFFFF',
          gold: '#D4AF37',
          'gold-light': '#FDF9E7',
          border: '#EBE3D8',
          charcoal: '#221C1E',
          muted: '#6E6466',
          // Compatibility mappings for existing templates
          maroon: '#C42369',
          cream: '#FAF7F2',
          ink: '#221C1E',
          rose: '#FBF0F4',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 30px rgba(34, 28, 30, 0.06)',
        card: '0 4px 20px -2px rgba(34, 28, 30, 0.05)',
        glow: '0 8px 24px -4px rgba(196, 35, 105, 0.25)',
      },
      borderRadius: {
        brand: '1.25rem',
      },
    },
  },
  plugins: [],
};

