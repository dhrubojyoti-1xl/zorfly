/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // The app ships its own reset + design-token system in src/styles.css
  // (existing component primitives rely on it) — Preflight would fight that,
  // so it stays off. Tailwind is available here as utility classes only.
  corePlugins: { preflight: false },
  theme: {
    extend: {}
  },
  plugins: []
};
