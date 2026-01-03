/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0a0e27',
        'dark-panel': '#151932',
        'dark-border': '#1e2442',
        'profit': '#00c853',
        'loss': '#ff1744',
        'text-primary': '#e8eaed',
        'text-secondary': '#9aa0a6',
      },
      fontFamily: {
        'sans': ['Inter', 'sans-serif'],
        'mono': ['Roboto Mono', 'monospace'],
      },
      screens: {
        'xs': '475px',
        // sm: 640px (default)
        // md: 768px (default) - Tablet portrait
        // lg: 1024px (default) - Tablet landscape / small desktop
        // xl: 1280px (default) - Desktop
        // 2xl: 1536px (default) - Large desktop
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
    },
  },
  plugins: [],
}
