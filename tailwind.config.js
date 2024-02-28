const cssColor = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: cssColor("paper"),
        shell: cssColor("shell"),
        ink: cssColor("ink"),
        slate: cssColor("slate"),
        copper: cssColor("copper"),
        teal: cssColor("teal"),
        line: cssColor("line"),
        panel: cssColor("panel"),
        code: cssColor("code"),
        elevated: cssColor("elevated"),
        focus: cssColor("focus"),
        rust: cssColor("rust"),
      },
      boxShadow: {
        pane: "var(--shadow-pane)",
        active: "var(--shadow-active)",
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "sans-serif"],
        mono: ["Consolas", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
