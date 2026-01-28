/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Backgrounds
        dark: {
          primary: '#0a0a0a',
          secondary: '#141414',
          tertiary: '#1f1f1f',
          elevated: '#262626',
        },
        // Accent (Neon Green)
        accent: {
          DEFAULT: '#00ff88',
          hover: '#00cc6a',
          muted: 'rgba(0, 255, 136, 0.12)',
        },
        // Text
        text: {
          primary: '#ffffff',
          secondary: '#a1a1a1',
          muted: '#666666',
        },
        // Borders
        border: {
          primary: '#262626',
          secondary: '#333333',
          accent: 'rgba(0, 255, 136, 0.25)',
        },
        // Categories
        cat: {
          brasil: '#3b82f6',
          futebol: '#22c55e',
          fofocas: '#f472b6',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
