/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        coastal: {
          50: '#edfdf7',
          100: '#d4f8eb',
          500: '#14a374',
          600: '#0B6E4F',
          700: '#075f47',
          900: '#05392e'
        },
        skywash: '#eef9ff',
        seafoam: '#dff8ef'
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif']
      },
      boxShadow: {
        soft: '0 20px 60px rgba(7, 95, 71, 0.12)'
      }
    }
  },
  plugins: []
};
