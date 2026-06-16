import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // verdict palette
        clear: "#16a34a",
        thin: "#d97706",
        pass: "#dc2626",
      },
    },
  },
  plugins: [],
};

export default config;
