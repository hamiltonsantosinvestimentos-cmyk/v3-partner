import type { Config } from "tailwindcss";

// Tailwind v4 uses CSS @theme — this file is mostly for plugins
const config: Config = {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  plugins: [],
};

export default config;
