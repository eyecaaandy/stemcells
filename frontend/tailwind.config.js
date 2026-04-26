/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        forge: {
          bg:      '#0a0a0f',
          surface: '#111118',
          border:  '#1e1e2e',
          accent:  '#7c6aff',
          dim:     '#3d3d5c',
          muted:   '#6b6b8a',
          text:    '#e8e8f0',
        },
      },
      keyframes: {
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        'pulse-bar': {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%':      { transform: 'scaleY(1)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'spin-slow':  'spin-slow 3s linear infinite',
        'pulse-bar':  'pulse-bar 1s ease-in-out infinite',
        'fade-up':    'fade-up 0.5s ease both',
        'shimmer':    'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
}
