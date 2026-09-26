import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        noir: {
          950: "#0a0908",
          900: "#12100d",
          800: "#1b1712",
          700: "#262019",
        },
        gild: {
          200: "#f3e3bb",
          300: "#e9cf96",
          400: "#ddb96f",
          500: "#c9a227",
          600: "#a8861f",
        },
        candle: "#f7ead0",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
