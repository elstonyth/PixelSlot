// scripts/process-balls.mjs
// Turn the operator's white-background Pokéball PNGs into transparent, trimmed,
// square WebP reel assets. Run: node scripts/process-balls.mjs
// Source dir: $BALL_SRC (default C:\Users\PC\Desktop\Pokeball).
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { env } from 'node:process';
import { floodFillAlpha } from '../src/lib/ball-alpha.ts';

const SRC = env.BALL_SRC || 'C:\\Users\\PC\\Desktop\\Pokeball';
const OUT = 'public/images/balls';
mkdirSync(OUT, { recursive: true });

// source filename → output slug
const MAP = {
  'Master_Ball_on_white_background_202606181251.png': 'master',
  'Luxury_ball_black_gold_red_202606181251.png': 'luxury',
  'Stylized_Ultra_Ball_on_white_202606181251.png': 'ultra',
  'Stylized_Great_Ball_on_white_202606181251.png': 'great',
  'Poké_Ball_on_white_background_202606181251.png': 'poke',
  'Premier_Ball_on_white_background_202606181251.png': 'decoy-premier',
  'Timer_Ball_on_white_background_202606181251.png': 'decoy-timer',
  'Dive_Ball_on_white_background_202606181251.png': 'decoy-dive',
  'Nest_Ball_on_white_background_202606181251.png': 'decoy-nest',
  'Friend_Ball_on_white_background_202606181251.png': 'decoy-friend',
  'Love_Ball_on_white_background_202606181251.png': 'decoy-love',
  'Blue_Net_Ball_on_white_202606181251.png': 'decoy-net',
};

async function process(file, slug) {
  const { data, info } = await sharp(join(SRC, file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  floodFillAlpha(data, info.width, info.height, { threshold: 240 });
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim() // crop the now-transparent margins
    .resize(256, 256, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90 })
    .toFile(join(OUT, `${slug}.webp`));
  console.log(`  ✓ ${slug}.webp`);
}

console.log('Processing balls →', OUT);
for (const [file, slug] of Object.entries(MAP)) {
  await process(file, slug).catch((e) =>
    console.error(`  ✗ ${slug}: ${e.message}`),
  );
}
console.log('Done.');
