/** @type {import('tailwindcss').Config} */
// Tailwind config for the standalone Mercur admin SPA. MUST stay `.cjs`: this
// package is `type: module`, but Tailwind v3's config loader uses CommonJS require().
//
// `@mercurjs/admin/index.css` ships source `@tailwind` directives (the bundled
// app.css only carries design tokens, not utility classes), so the consuming app
// must run Tailwind. Without this config the utility layer (incl. the `lg:`
// responsive variants that drive the desktop sidebar) is never generated and the
// shell collapses to its mobile-stacked layout. The `content` globs MUST include
// the dashboard/admin package dist so their classes are not purged.
module.exports = {
  presets: [require("@medusajs/ui-preset")],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@medusajs/dashboard/dist/**/*.{js,mjs}",
    "./node_modules/@mercurjs/admin/dist/**/*.{js,mjs}",
  ],
};
