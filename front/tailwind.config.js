/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        night: {
          50: '#f9faf9',      // Lightest grey/background
          100: '#f1f2f0',
          200: '#e3e6e0',
          300: '#d1d5cb',
          400: '#a6a781',      // Muted green/grey
          500: '#8c8d6a',
          600: '#737454',
          700: '#595a41',
          800: '#40412f',
          900: '#21262d',      // Darkest grey/text
        },
        accent: {
          DEFAULT: '#e3e161', // Main yellow accent
          dark: '#d4d255',    // Slightly darker for hover
        },
      },
      boxShadow: {
        card: "0 18px 50px rgba(33, 38, 45, 0.16)",
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

