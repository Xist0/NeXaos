/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        night: {
          50: "#f5f7fb",
          100: "#eaeef5",
          200: "#c7d3e4",
          300: "#a4b7d3",
          400: "#5d7fab",
          500: "#264a84",
          600: "#1d3765",
          700: "#142547",
          800: "#0b1329",
          900: "#050912",
        },
        accent: {
          DEFAULT: "#f97316",
          dark: "#ea580c",
        },
      },
      boxShadow: {
        card: "0 25px 80px rgba(5, 9, 18, 0.35)",
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

