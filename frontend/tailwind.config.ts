import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ops: {
          ink: "#0b1220",
          panel: "#111827",
          line: "#d8dee9",
          blue: "#2563eb",
          cyan: "#0891b2",
          success: "#16a34a",
          warning: "#d97706"
        }
      },
      boxShadow: {
        glass: "0 18px 60px rgba(15, 23, 42, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
