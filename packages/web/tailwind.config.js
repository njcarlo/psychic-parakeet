/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        coastal: {
          50: '#eef6fe',
          100: '#d9ecfd',
          200: '#b6dafb',
          300: '#86c2f8',
          400: '#4ea3f1',
          500: '#2186e4',
          600: '#0f6fce',
          700: '#0d59a6',
          800: '#114a86',
          900: '#0c2f54'
        },
        skywash: '#eef9ff',
        seafoam: '#e2f1fd'
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif']
      },
      boxShadow: {
        soft: '0 20px 60px rgba(11, 71, 128, 0.14)'
      }
    }
  },
  plugins: []
};
