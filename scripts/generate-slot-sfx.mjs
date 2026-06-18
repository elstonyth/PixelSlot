// Generates the slot-machine SFX referenced by src/lib/use-sound.ts.
//
// These are SYNTHESIZED from scratch with ffmpeg (sine/noise + envelopes) — so
// they are genuinely public-domain (CC0): no third-party samples, no attribution,
// no license risk. Mono, 44.1kHz, libmp3lame; each is a fraction of a second so
// every file lands well under the ~100KB budget.
//
// Run: node scripts/generate-slot-sfx.mjs   (requires ffmpeg on PATH)
// Output: public/sounds/slot-{spin,stop,win,bigwin,sell}.mp3
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'sounds');
mkdirSync(outDir, { recursive: true });

const COMMON = [
  '-ac',
  '1',
  '-ar',
  '44100',
  '-codec:a',
  'libmp3lame',
  '-b:a',
  '96k',
];

function ff(label, inputArgs, outName) {
  const out = join(outDir, outName);
  const args = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    ...inputArgs,
    ...COMMON,
    out,
  ];
  execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log(`  ✓ ${outName}`);
}

// Build an ascending arpeggio in ONE ffmpeg call: one `aevalsrc` sine per note
// (explicit amplitude `amp` → predictable peak ≈ amp; ffmpeg's `sine` source is
// only ~-18dB, too quiet), a quick out-fade so notes don't run together, then
// concat. `amp` ≈ 0.7 lands the peak near -3dB without clipping (notes don't
// overlap, so the concat never sums).
function arpeggio(notes, noteDur, amp, outName) {
  const inputs = [];
  const filters = [];
  notes.forEach((freq, i) => {
    inputs.push(
      '-f',
      'lavfi',
      '-i',
      `aevalsrc='${amp}*sin(2*PI*${freq}*t)':d=${noteDur}:s=44100`,
    );
    // gentle attack (avoid click) + sustain, then decay over the last ~45%.
    filters.push(
      `[${i}]afade=t=in:st=0:d=0.006,afade=t=out:st=${(noteDur * 0.55).toFixed(3)}:d=${(noteDur * 0.45).toFixed(3)}[n${i}]`,
    );
  });
  const chain = notes.map((_, i) => `[n${i}]`).join('');
  const fc = `${filters.join(';')};${chain}concat=n=${notes.length}:v=0:a=1`;
  ff(outName, [...inputs, '-filter_complex', fc], outName);
}

console.log('Generating slot SFX →', outDir);

// spin — a short rising mechanical whir/whoosh (one-shot; the hook plays it once
// at SPIN press). Rising instantaneous pitch (160→…) + a ~28Hz motor tremolo,
// with a tail fade so it doesn't end on a click.
ff(
  'spin',
  [
    '-f',
    'lavfi',
    '-i',
    "aevalsrc='0.42*sin(2*PI*(160*t+150*t*t))*(0.72+0.28*sin(2*PI*28*t))':d=0.55:s=44100",
    '-af',
    'afade=t=out:st=0.45:d=0.1',
  ],
  'slot-spin.mp3',
);

// stop — a short, bright detent "click" (filtered pink-noise burst, fast decay).
ff(
  'stop',
  [
    '-f',
    'lavfi',
    '-i',
    'anoisesrc=color=pink:duration=0.07:amplitude=0.55',
    '-af',
    'highpass=f=500,afade=t=out:st=0.004:d=0.06,volume=0.9',
  ],
  'slot-stop.mp3',
);

// win — bright 3-note ascending arpeggio (C5–E5–G5).
arpeggio([523.25, 659.25, 783.99], 0.14, 0.72, 'slot-win.mp3');

// bigwin — louder, longer 5-note rising run (C5–E5–G5–C6–E6) for Epic/Legendary.
arpeggio(
  [523.25, 659.25, 783.99, 1046.5, 1318.51],
  0.15,
  0.82,
  'slot-bigwin.mp3',
);

// sell — a quick two-tone "cha-ching" register chirp (B5→E6).
arpeggio([987.77, 1318.51], 0.11, 0.72, 'slot-sell.mp3');

console.log('Done.');
