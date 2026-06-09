// Headless Playwright verification for a clone. Cacheless and measurable — use
// THIS to verify, never the live browser tab (stale cache lies).
//
// Setup (once, in the project):  npm i -D playwright && npx playwright install chromium
// Run:  node verify-clone.mjs <url> [outDir]
//   e.g. node verify-clone.mjs http://localhost:4000/ docs/research
//
// Checks, at 390/768/1440/1920/2560/3840 (incl. 4K):
//   - horizontal overflow (documentElement.scrollWidth > innerWidth) = layout bug
//   - broken images (complete && naturalWidth === 0)
//   - scroll-entry animation: elements hidden below the fold on load, shown after scroll
// Saves a full-page screenshot per width so you can READ them back.

import { chromium } from "playwright";
import fs from "node:fs";

const url = process.argv[2] || "http://localhost:4000/";
const outDir = process.argv[3] || "docs/research";
const SIZES = [390, 768, 1440, 1920, 2560, 3840];
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const report = [];

for (const w of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(1200);

  // hidden-below-fold count on load (entry animations not yet triggered)
  const beforeHidden = await page.evaluate(() =>
    [...document.querySelectorAll("*")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.top > window.innerHeight && +getComputedStyle(e).opacity < 0.05 && r.height > 20;
    }).length,
  );

  // scroll through to trigger reveals + lazy images
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y <= h; y += Math.round(window.innerHeight * 0.6)) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 110));
    }
    window.scrollTo(0, h);
    await new Promise((r) => setTimeout(r, 900));
  });

  const after = await page.evaluate(() => ({
    stillHidden: [...document.querySelectorAll("*")].filter(
      (e) => +getComputedStyle(e).opacity < 0.05 && e.getBoundingClientRect().height > 20,
    ).length,
    broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
    overflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
  }));

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/verify_${w}.png`, fullPage: true });

  const row = { width: w, beforeHidden, ...after };
  report.push(row);
  console.log(
    `[${w}] overflowX=${after.overflowX}px broken=${after.broken} ` +
      `hiddenOnLoad=${beforeHidden} stillHiddenAfterScroll=${after.stillHidden}`,
  );
  await page.close();
}

fs.writeFileSync(`${outDir}/verify-report.json`, JSON.stringify(report, null, 2));
const bad = report.filter((r) => r.overflowX > 2 || r.broken > 0);
console.log(bad.length ? `\nFAIL: ${JSON.stringify(bad)}` : "\nPASS: no overflow, no broken images at any width.");
await browser.close();
