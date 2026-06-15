import { defineConfig } from '@playwright/test';

// READ-ONLY production smoke. Separate dir + config so it can NEVER be picked up
// by the mutating e2e suite (which would corrupt prod). No auth, no writes.
// Run: npx playwright test -c playwright.prod-smoke.config.ts
export default defineConfig({
  testDir: './tests/prod-smoke',
  testMatch: /\.smoke\.ts$/,
  fullyParallel: true,
  workers: 2,
  retries: 1, // prod cold-start / network flake tolerance
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  outputDir: 'tests/prod-smoke/.artifacts',
  use: {
    navigationTimeout: 30_000,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
