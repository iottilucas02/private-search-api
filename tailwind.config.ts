import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#e8f6ff",
        graphite: "#9fb6c9",
        line: "#1d3148",
        panel: "#111c2f",
        field: "#081323",
        teal: "#06b6d4",
        amber: "#f59e0b",
        rose: "#fb7185"
      },
      boxShadow: {
        surface: "0 18px 45px rgba(2, 8, 23, 0.28)"
      }
    }
  },
  plugins: []
};

export default config;
