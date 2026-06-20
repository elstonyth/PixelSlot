// axe-core accessibility scan of key public routes against the running
// standalone storefront (:4000). Fails on serious/critical violations.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:4000';
const ROUTES = ['/', '/claw', '/leaderboard', '/how-it-works', '/about'];

const browser = await chromium.launch();
const page = await browser.newPage();
let failed = false;

for (const route of ROUTES) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const serious = violations.filter((v) =>
    ['serious', 'critical'].includes(v.impact ?? ''),
  );
  if (serious.length) {
    failed = true;
    console.error(`\n${route} — ${serious.length} serious/critical:`);
    for (const v of serious)
      console.error(`  [${v.impact}] ${v.id}: ${v.help}`);
  } else {
    console.log(`OK ${route}`);
  }
}
await browser.close();
if (failed) process.exit(1);
console.log('\nNo serious/critical a11y violations.');
