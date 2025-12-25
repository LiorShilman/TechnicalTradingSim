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
    },
  },
  plugins: [],
}
