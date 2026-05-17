import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#354A37",
          green: "#354A37",
          white: "#FFFFFF",
          black: "#000000",
          danger: "#FAA9A9",
          success: "#D0FFB6",
        },
        // Chart palette — distinct, readable on both light and dark backgrounds.
        // Access via var(--chart-1) … var(--chart-5) in CSS, or Tailwind bg-chart-1 etc.
        chart: {
          1: "var(--chart-1)", // teal-blue   — Sessions
          2: "var(--chart-2)", // amber        — Orders
          3: "var(--chart-3)", // violet       — Subscriptions
          4: "var(--chart-4)", // rose         — extra series
          5: "var(--chart-5)", // sky          — extra series
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)",
        "soft-lg": "0 2px 4px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.08)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
