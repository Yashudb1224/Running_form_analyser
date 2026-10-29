import type { Config } from "tailwindcss";

// Colors resolve to CSS variables (RGB triplets) defined per theme in globals.css.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: token("background"),
        surface: token("surface"),
        card: token("card"),
        subtle: token("subtle"),
        border: token("border"),
        "border-strong": token("border-strong"),
        ink: token("ink"),
        body: token("body"),
        muted: token("muted"),
        primary: token("primary"),
        "primary-hover": token("primary-hover"),
        "on-primary": token("on-primary"),
        secondary: token("secondary"),
        success: token("success"),
        warning: token("warning"),
        danger: token("danger"),
        "leg-left": token("leg-left"),
        "leg-right": token("leg-right"),
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.05), 0 1px 3px rgb(var(--shadow) / 0.07)",
        raised: "0 4px 16px -4px rgb(var(--shadow) / 0.12), 0 2px 4px rgb(var(--shadow) / 0.05)",
      },
    },
  },
  plugins: [],
};
export default config;
