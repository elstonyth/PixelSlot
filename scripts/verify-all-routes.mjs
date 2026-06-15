// Verify-all sweep: every clone route at mobile->4K for horizontal overflow +
// broken images (natural size 0). Concrete, fast soundness check of the clone.
import { launch, newContext, gotoStable, BASE } from './lib/pw.mjs';

const ROUTES = [
  '/',
  '/claw',
  '/claw/pokemon-mythic',
  '/marketplace',
  '/leaderboard',
  '/pack-party',
  '/how-it-works',
];
const WIDTHS = [390, 768, 1440, 1920, 2560, 3840];

const browser = await launch();
const report = [];
for (const route of ROUTES) {
  const row = { route, overflow: [], brokenImgs: 0 };
  for (const w of WIDTHS) {
    const ctx = await newContext(browser, {
      viewport: { width: w, height: 900 },
    });
    const page = await ctx.newPage();
    try {
      await gotoStable(page, `${BASE}${route}`);
      const r = await page.evaluate(() => {
        const over =
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth;
        const broken = [...document.querySelectorAll('img')].filter(
          (i) => i.complete && i.naturalWidth === 0 && (i.currentSrc || i.src),
        ).length;
        return { over, broken };
      });
      if (r.over > 1) row.overflow.push(`${w}:+${r.over}`);
      row.brokenImgs = Math.max(row.brokenImgs, r.broken);
    } catch (e) {
      row.overflow.push(`${w}:ERR`);
    }
    await ctx.close();
  }
  row.status =
    row.overflow.length === 0 && row.brokenImgs === 0 ? 'OK' : 'ISSUE';
  report.push(row);
}
await browser.close();
console.log(JSON.stringify(report, null, 2));
const allOk = report.every((r) => r.status === 'OK');
console.log(
  'VERDICT:',
  allOk ? 'PASS — no overflow / broken images on any route' : 'ISSUES found',
);
