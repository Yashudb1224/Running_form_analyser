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
        background: "#F3F1EC",
        surface: "#FFFFFF",
        card: "#F8F7F3",
        border: "#DEDCD5",
        primary: "#2D6598",
        secondary: "#527A9C",
        success: "#39705A",
        warning: "#9B6A17",
        danger: "#A7443F",
        muted: "#66727D",
      },
    },
  },
  plugins: [],
};
export default config;
