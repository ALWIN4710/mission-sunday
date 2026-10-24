/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark forest-green primary palette
        forest: {
          50:  '#f0f7f4',
          100: '#daeee5',
          200: '#b8ddcc',
          300: '#89c5ab',
          400: '#57a686',
          500: '#358a6a',
          600: '#256f55',
          700: '#1d5a44',
          800: '#184838',
          900: '#143b2e',
          950: '#0a211a',
        },
        // Warm neutrals
        sand: {
          50:  '#fdfaf6',
          100: '#faf3e8',
          200: '#f5e4cd',
          300: '#edd0a7',
          400: '#e3b37a',
          500: '#d9955a',
          600: '#cc7b43',
          700: '#a85e35',
          800: '#874d30',
          900: '#6d402a',
        },
        // Accent for success/profit
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.08)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.12), 0 2px 4px -1px rgba(0,0,0,0.08)',
        'modal': '0 20px 60px -10px rgba(0,0,0,0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseSoft: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.7 } },
      },
    },
  },
  plugins: [],
}
