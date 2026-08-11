import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F6FC",
        ink: "#302B46",
        muted: "#766F8B",
        line: "#E4E0EF",
        navy: "#292140",
        primary: "#6D63A9",
        "primary-hover": "#5D5199",
        success: "#5D8C76",
        warning: "#B69045",
        danger: "#BE626E",
      },
      boxShadow: {
        card: "0 1px 2px rgba(48, 43, 70, 0.04), 0 10px 28px rgba(67, 57, 105, 0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
