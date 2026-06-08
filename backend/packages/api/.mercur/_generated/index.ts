// Bridge for the `@acme/api/_generated` package export.
//
// package.json maps `./_generated` -> `./.mercur/_generated/index.ts`, but the
// Mercur CLI emits the generated `Routes` type to `../index.d.ts`. Re-export it
// here so the admin/vendor typed clients resolve. Safe to overwrite if the CLI
// later emits the canonical generated file at this path.
export type { Routes } from "../index";
