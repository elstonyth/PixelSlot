// Capture an animation/carousel frame-by-frame so you build motion from DATA,
// not guesses. Films screenshots + per-frame transforms of matching elements.
//
// Run:  node film-motion.mjs <url> <css-selector> [frames] [intervalMs] [outDir]
//   e.g. node film-motion.mjs https://example.com "section .card img" 60 120 docs/research/film
//
// For each frame it records, per matched element: src/tag, bounding box, and the
// Tailwind-v4-aware transform props (translate/scale/rotate — NOT just `transform`,
// which reads "none" under Tailwind v4) plus opacity. Decide slide/rotate/fade/
// stack from the numbers, then build to the measured values.
//
// Tip: if the page scrolls inside a container (not window), the carousel/hero is
// usually time-driven and visible at top — filming works as-is. For scroll-entry
// animations, park the section below the fold first, then scroll it in while filming.

import { chromium } from "playwright";
import fs from "node:fs";

const [, , url, selector, framesArg, intervalArg, outArg] = process.argv;
if (!url || !selector) {
  console.error('Usage: node film-motion.mjs <url> "<selector>" [frames] [intervalMs] [outDir]');
  process.exit(1);
}
const frames = Number(framesArg) || 60;
const interval = Number(intervalArg) || 120;
const outDir = outArg || "docs/research/film";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
for (let i = 0; i < 25; i++) {
  if (await page.evaluate(() => document.images.length > 4)) break;
  await page.waitForTimeout(1000);
}
await page.waitForTimeout(2500);

const timeline = [];
for (let f = 0; f < frames; f++) {
  const snap = await page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)].map((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const src = (el.currentSrc || el.src || "").split("/").pop()?.split("?")[0] || el.tagName;
      return {
        src,
        x: Math.round(r.x),
        cx: Math.round(r.x + r.width / 2),
        w: Math.round(r.width),
        h: Math.round(r.height),
        opacity: +(+cs.opacity).toFixed(2),
        translate: cs.translate, // Tailwind v4 props
        scale: cs.scale,
        rotate: cs.rotate,
        transform: cs.transform === "none" ? "" : cs.transform,
      };
    });
  }, selector);
  timeline.push({ f, els: snap });
  if (f % 5 === 0) await page.screenshot({ path: `${outDir}/f${String(f).padStart(2, "0")}.png` });
  await page.waitForTimeout(interval);
}

fs.writeFileSync(`${outDir}/timeline.json`, JSON.stringify(timeline, null, 1));
console.log(`Filmed ${frames} frames of "${selector}" -> ${outDir}/ (timeline.json + screenshots).`);
// quick console digest of the first matched element across frames
timeline.forEach((t) => {
  const e = t.els[0];
  if (e) console.log(`f${String(t.f).padStart(2, "0")}: ${e.src} cx${e.cx} o${e.opacity} tr=${e.translate} sc=${e.scale} rot=${e.rotate}`);
});
await browser.close();
