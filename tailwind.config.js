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
        // Neo-Brutalist Colors
        brutal: {
          yellow: '#FFDD00',
          orange: '#FF6B35',
          cyan: '#00D4FF',
          black: '#000000',
          white: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['Space Mono', 'JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'brutal': '6px 6px 0 0 #000000',
        'brutal-sm': '4px 4px 0 0 #000000',
        'brutal-lg': '8px 8px 0 0 #000000',
        'brutal-yellow': '4px 4px 0 0 #FFDD00',
        'brutal-accent': '4px 4px 0 0 #00ff88',
      },
    },
  },
  plugins: [],
};
