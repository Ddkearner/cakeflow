import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "color-1": "var(--color-1)",
        "color-2": "var(--color-2)",
        "color-3": "var(--color-3)",
        "color-4": "var(--color-4)",
        "color-5": "var(--color-5)",
      },
      keyframes: {
        rainbow: {
          "0%": { "background-position": "0%" },
          "100%": { "background-position": "200%" },
        },
      },
      animation: {
        rainbow: "rainbow var(--speed, 2s) infinite linear",
      },
    },
  },
  plugins: [],
};
export default config;
