// Ship the graded-slab default frame + print its measured geometry
// (window insets, label box, holo probe). The shipped webp is derived from
// the design session's operator-approved processed master.
//
// PROVENANCE / DEVIATION from the plan (2026-07-17): the plan transcribed a
// green-key + white-flood pipeline over docs/research/slabframe-snapgen-v2.png
// with v1-era thresholds (>=250 background flood, (242,242,244) case check,
// CASE_ALPHA 0.55). That transcription does not reproduce the session's
// approved output: v2's page background carries a soft contact shadow
// (~211-224 RGB) that the >=250 flood never removes — it ships as a gray halo
// over dark pages — and v2's case tone (175-220) makes the case-survival
// check throw. The session iterated past v2 (v3/v4 masters, 2026-07-16
// 22:46/23:09) and left its approved processed output on disk:
// docs/research/slabframe-final-1600.png — exact 1600x2867 (SLAB_ASPECT
// 0.5581), glassy case (uniform alpha 115 ≈ 0.45, flat 244 tone), fully
// opaque label, background keyed clean (verified 2026-07-17 by pixel-sampling
// a dark-page composite: background lands at the page color exactly).
// This script ships THAT file — no re-keying, zero threshold drift.
// NOTE: its measured window/label geometry deviates from the plan's recorded
// expectations (which were measured on an intermediate v2 processing):
// window left/right 0.1144/0.1169 vs plan 0.1069/0.1062; label top 0.0617 vs
// plan 0.0474. The printed values below are the shipped frame's real geometry
// — downstream constants (SLAB_WINDOW, Task 5 LABEL_BOX) must use these.
// Usage: node scripts/process-slabframe-v2.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '..', 'package.json'));
const sharp = require('sharp');

const SRC = path.join(
  here,
  '..',
  'docs',
  'research',
  'slabframe-final-1600.png',
);
const OUT = path.join(here, '..', 'public', 'images', 'slab-frame.webp');
const TARGET_W = 1600; // = MAX_FRAME_WIDTH in bake-slab.ts

readFileSync(SRC); // fail fast if the local-only master is missing

// ---- 1. load + sanity-check the approved master ----
const { data, info } = await sharp(SRC)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const W = info.width,
  H = info.height,
  CH = info.channels;
if (W !== TARGET_W || H !== 2867) {
  throw new Error(`expected the approved 1600x2867 master, got ${W}x${H}`);
}
// border ring must be fully transparent (no background halo)
for (let x = 0; x < W; x++) {
  if (data[x * CH + 3] > 8 || data[((H - 1) * W + x) * CH + 3] > 8) {
    throw new Error(
      `opaque background pixel on the top/bottom border at x=${x}`,
    );
  }
}
for (let y = 0; y < H; y++) {
  if (data[y * W * CH + 3] > 8 || data[(y * W + W - 1) * CH + 3] > 8) {
    throw new Error(
      `opaque background pixel on the left/right border at y=${y}`,
    );
  }
}
// glassy case body present (uniform ~alpha 115) and opaque label present
let glassPx = 0,
  opaquePx = 0;
for (let p = 0; p < W * H; p++) {
  const a = data[p * CH + 3];
  if (a > 100 && a < 130) glassPx++;
  else if (a > 240) opaquePx++;
}
if (glassPx < W * H * 0.1) {
  throw new Error(`glassy case body missing: only ${glassPx} px at alpha~115`);
}
if (opaquePx < W * H * 0.05) {
  throw new Error(`opaque label region missing: only ${opaquePx} px`);
}
console.log(
  'glassy-case pixels:',
  glassPx,
  `(${((glassPx / (W * H)) * 100).toFixed(1)}%)`,
  ' opaque(label) pixels:',
  opaquePx,
  `(${((opaquePx / (W * H)) * 100).toFixed(1)}%)`,
);

// ---- 2. ship ----
await sharp(SRC).webp({ quality: 90, alphaQuality: 90 }).toFile(OUT);

// ---- 3. verify the webp encode kept the alpha mask (transparent-vs-not) ----
{
  const { data: D2 } = await sharp(OUT)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let mismatch = 0;
  for (let p = 0; p < W * H; p++) {
    if (data[p * CH + 3] <= 8 !== D2[p * CH + 3] <= 8) mismatch++;
  }
  console.log(
    'webp alpha-mask mismatch vs master:',
    mismatch,
    `(${((mismatch / (W * H)) * 100).toFixed(4)}%)`,
  );
  if (mismatch > W * H * 0.003) {
    throw new Error('webp encode perturbed the alpha mask beyond tolerance');
  }
}

// ---- 4. measure the shipped frame (never eyeball — §5) ----
const { data: D, info: I } = await sharp(OUT)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const w = I.width,
  h = I.height,
  ch = I.channels;
const A = (x, y) => D[(y * w + x) * ch + 3];
const RGB = (x, y) => {
  const i = (y * w + x) * ch;
  return [D[i], D[i + 1], D[i + 2]];
};
// exterior flood (transparent + border-connected), then window = interior transparent bbox
const ext = new Uint8Array(w * h);
const st = [];
for (let x = 0; x < w; x++) st.push(x, 0, x, h - 1);
for (let y = 0; y < h; y++) st.push(0, y, w - 1, y);
while (st.length) {
  const y = st.pop(),
    x = st.pop();
  if (x < 0 || y < 0 || x >= w || y >= h) continue;
  const p = y * w + x;
  if (ext[p] || A(x, y) > 8) continue;
  ext[p] = 1;
  st.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
}
let wx0 = w,
  wy0 = h,
  wx1 = -1,
  wy1 = -1;
for (let y = 0; y < h; y++)
  for (let x = 0; x < w; x++) {
    if (A(x, y) <= 8 && !ext[y * w + x]) {
      if (x < wx0) wx0 = x;
      if (x > wx1) wx1 = x;
      if (y < wy0) wy0 = y;
      if (y > wy1) wy1 = y;
    }
  }
console.log('frame', `${w}x${h}`, 'SLAB_ASPECT', (w / h).toFixed(4));
console.log(
  'SLAB_WINDOW  top',
  (wy0 / h).toFixed(4),
  ' left',
  (wx0 / w).toFixed(4),
  ' right',
  ((w - 1 - wx1) / w).toFixed(4),
  ' bottom',
  ((h - 1 - wy1) / h).toFixed(4),
  ' window aspect',
  ((wx1 - wx0) / (wy1 - wy0)).toFixed(4),
);
// label = the WHITE STICKER inside the red border, top 20% of the frame.
// NOT the red outer bbox: all text constants are fractions of the sticker
// (measured 2026-07-16 on 4 real cert labels incl. cert 152108321 — the same
// Pikachu ex #238; using the red bbox pushed the right column outside the
// label). Off-centre scanlines so neither the border's rounded corners nor
// the centred PSA logo can truncate the walk.
const isRedAt = (x, y) => {
  const [r, g, b] = RGB(x, y);
  return A(x, y) > 200 && r > 140 && g < 90 && b < 90;
};
let lx0 = w,
  ly0 = h,
  lx1 = -1,
  ly1 = -1;
for (let y = 0; y < Math.floor(h * 0.2); y++)
  for (let x = 0; x < w; x++) {
    if (isRedAt(x, y)) {
      if (x < lx0) lx0 = x;
      if (x > lx1) lx1 = x;
      if (y < ly0) ly0 = y;
      if (y > ly1) ly1 = y;
    }
  }
const rowY = Math.round(ly0 + (ly1 - ly0) * 0.3); // crosses text at worst, never the logo
let sx0 = Math.round((lx0 + lx1) / 2);
while (sx0 > lx0 && !isRedAt(sx0 - 1, rowY)) sx0--;
let sx1 = Math.round((lx0 + lx1) / 2);
while (sx1 < lx1 && !isRedAt(sx1 + 1, rowY)) sx1++;
const colX = Math.round(lx0 + (lx1 - lx0) * 0.15); // left of the centred PSA logo
let sy0 = Math.round((ly0 + ly1) / 2);
while (sy0 > ly0 && !isRedAt(colX, sy0 - 1)) sy0--;
let sy1 = Math.round((ly0 + ly1) / 2);
while (sy1 < ly1 && !isRedAt(colX, sy1 + 1)) sy1++;
const STICKER = { x: sx0, y: sy0, w: sx1 - sx0 + 1, h: sy1 - sy0 + 1 };
console.log(
  'LABEL_BOX (white sticker)  top',
  (STICKER.y / h).toFixed(4),
  ' left',
  (STICKER.x / w).toFixed(4),
  ' right',
  ((w - STICKER.x - STICKER.w) / w).toFixed(4),
  ' height',
  (STICKER.h / h).toFixed(4),
);
// holo probe: the frame's baked-in PSA logo — dark ink bands inside the
// sticker (§13; text rows must stay above its top edge)
let hy0 = -1;
for (let y = sy0 + Math.floor(STICKER.h * 0.5); y <= sy1 && hy0 < 0; y++) {
  for (let x = sx0 + 3; x < sx1 - 3; x++) {
    const [r, g, b] = RGB(x, y);
    if (A(x, y) > 200 && Math.max(r, g, b) < 190) {
      hy0 = y;
      break;
    }
  }
}
if (hy0 >= 0) {
  console.log(
    'HOLO/logo top  frac-of-sticker',
    ((hy0 - sy0) / STICKER.h).toFixed(3),
    '(text baseline 3 sits at 0.723 — must be ABOVE this)',
  );
} else {
  console.log(
    'HOLO probe: no logo ink found in the sticker bottom half — inspect manually',
  );
}
