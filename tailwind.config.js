/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b0e14",
          900: "#11151d",
          800: "#171c26",
          700: "#212734",
          600: "#2c3342",
          500: "#3a4254",
          400: "#5a6478",
          300: "#8891a3",
          200: "#c2c8d4",
          100: "#e7e9ee",
        },
        accent: {
          500: "#4f7cff",
          600: "#3d63e0",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
