/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      animation: {
        'slide-up':   'slideUp 0.35s ease-out',
        'fade-in':    'fadeIn 0.3s ease-out',
        'spin-slow':  'spin 1.5s linear infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        slideUp:   { from: { opacity: 0, transform: 'translateY(24px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        pulseSoft: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
      },
      boxShadow: {
        card:    '0 1px 4px rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.04)',
        'card-hover': '0 2px 8px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.08)',
        glow:    '0 0 0 3px rgba(37,99,235,0.18)',
      },
    },
  },
  plugins: [],
}
