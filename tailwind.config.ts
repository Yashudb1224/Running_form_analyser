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
        background: "#0B0F17",
        surface: "#141C2B",
        card: "#161F30",
        border: "#222C3E",
        primary: "#00E5FF",
        secondary: "#38BDF8",
        success: "#00FF66",
        warning: "#FFB800",
        danger: "#FF4B4B",
        muted: "#94A3B8"
      },
    },
  },
  plugins: [],
};
export default config;
