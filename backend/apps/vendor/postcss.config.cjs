// Deliberately empty: vendor's vite build uses no PostCSS processing — this is
// prod parity (the DO Docker build context is backend/, so no config is found
// there either). Without this file, PostCSS config discovery walks UP past the
// workspace and — in a full-repo checkout like CI — finds the ROOT repo's
// Tailwind v4 postcss.config.mjs, whose plugin isn't installed here → build
// error. Admin has its own real config (Tailwind 3); vendor ships unprocessed CSS.
module.exports = { plugins: [] };
