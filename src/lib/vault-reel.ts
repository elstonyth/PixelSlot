// Pure spin physics + 3D barrel curvature for the Vault Room reel. No DOM, no
// React — see src/lib/__tests__/vault-reel.test.ts. Spec: slot-machine-redesign.md
// ("Momentum & Mass + final crawl" + timing masterplan).
import { POKEDEX_MAX } from './reel';

/** Ratchet wind-up: the strip pulls back half a cell before release. */
export const WINDUP_MS = 180;
/** Full-speed blur phase (columns start together; stagger extends this phase). */
export const BLUR_MS = 1400;
/** Friction phase: cells tick past slower and slower. */
export const FRICTION_MS = 720;
/** Suspense crawl — LAST column only. */
export const CRAWL_MS = 500;
/** Half-row overshoot + pendulum settle. */
export const SETTLE_MS = 260;
/** Per-column stop stagger (L→R). */
export const STOP_STAGGER_MS = 400;
/** Rows visible in the reel window. */
export const VISIBLE_CELLS = 5;
/**
 * Width/height ratio of EVERY card-shaped surface (reel tiles, slab back and
 * front). Shared so the landed tile → slab morph reads as one object growing
 * (spec decision #16 — shape-synced reveal).
 */
export const CARD_ASPECT = 3 / 4.2;
/**
 * Winner's strip index for the VAULT reel — LOW on the strip because cells
 * stream TOP → BOTTOM (spec #22): all pre-roll travel comes from the cells
 * ABOVE (after) the winner, so a low index leaves ~38 cells of genuine blur
 * runway inside the fixed strip (spec decision #31). The bounds invariant
 * (no frame paints past either strip end at max window height) is test-encoded.
 */
export const VAULT_WIN_INDEX = 9;
/** Decoy sprites cycle a small pool — a real slot repeats its symbol set, and
 *  12 distinct images per column (instead of 47) slashes decode/network cost. */
export const VAULT_DECOY_POOL = 12;

/**
 * Vault analog of `buildDexStrip` (spec decision #31): decoys repeat from a
 * small deterministic pool instead of 47 unique dexes; winner pinned at
 * `winIndex`. Same geometry validation as buildDexStrip.
 */
export function buildVaultStrip(
  winnerDex: number | null,
  length: number,
  winIndex: number,
  poolSize = VAULT_DECOY_POOL,
): number[] {
  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError('buildVaultStrip: length must be a positive integer');
  }
  if (!Number.isInteger(winIndex) || winIndex < 0 || winIndex >= length) {
    throw new RangeError(
      'buildVaultStrip: winIndex must be within [0, length)',
    );
  }
  const safeWinner =
    winnerDex !== null &&
    Number.isInteger(winnerDex) &&
    winnerDex >= 1 &&
    winnerDex <= POKEDEX_MAX
      ? winnerDex
      : 1;
  const strip = Array.from(
    { length },
    (_, i) => (((i % poolSize) * 167 + 13) % POKEDEX_MAX) + 1,
  );
  strip[winIndex] = safeWinner;
  return strip;
}

const easeOutQuad = (p: number) => 1 - (1 - p) * (1 - p);
const easeInQuad = (p: number) => p * p;
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);

/** Total run time of column `colIndex` of `count` (all columns start together). */
export function columnDurationMs(colIndex: number, count: number): number {
  const isLast = colIndex === count - 1;
  return (
    WINDUP_MS +
    BLUR_MS +
    FRICTION_MS +
    (isLast ? CRAWL_MS : 0) +
    SETTLE_MS +
    colIndex * STOP_STAGGER_MS
  );
}

/** When the LAST column settles — sizes the watchdog and phase handoff. */
export function spinTotalMs(count: number): number {
  return columnDurationMs(count - 1, count);
}

/**
 * Strip offset (px) at time `tMs`, painted by the caller as `translateY(-offset)`.
 * Cells stream TOP → BOTTOM (spec decision #22): the strip starts with the
 * winner sitting ABOVE the payline and DESCENDS into it, so `offset` starts
 * HIGH (target + pre-roll travel) and eases DOWN to `targetPx`. The wind-up
 * pulls UP half a cell first (offset spikes ABOVE the start), then releases
 * downward. Piecewise:
 *   wind-up (offset rises above start = strip pulls up) → blur (ease-in to
 *   speed, ~18-27 cells stream past) → friction (ease-out, offset still
 *   falling) → crawl (last column only, slow readable descent) → settle
 *   (damped overshoot BELOW the target = winner dips under the payline, then
 *   rises to rest).
 * The blur distance is sized so the blur's exit velocity MATCHES friction's
 * entry velocity (no jerk at the handoff — spec decision #31): friction opens
 * at 3·frictionPx/FRICTION_MS = itemH/40 px/ms, and an easeInQuad ramp reaches
 * that after covering (itemH/80)·blurMs. Total travel therefore needs the
 * winner pinned LOW on the strip (VAULT_WIN_INDEX) — the fit is test-encoded.
 */
export function spinOffset(
  tMs: number,
  targetPx: number,
  colIndex: number,
  count: number,
  itemH: number,
): number {
  const isLast = colIndex === count - 1;
  const blur = BLUR_MS + colIndex * STOP_STAGGER_MS;
  const windupPx = itemH / 2;
  const crawlPx = isLast ? itemH * 2 : 0;
  const frictionPx = itemH * 6;
  const overshootPx = itemH / 2;
  // Blur travel that lands exactly at friction's entry velocity (see doc above).
  const blurPx = (itemH * blur) / 80;
  // The winner starts this far ABOVE its landed (centered) position and descends.
  const startPx = targetPx + frictionPx + crawlPx + blurPx;

  const t1 = WINDUP_MS;
  const t2 = t1 + blur;
  const t3 = t2 + FRICTION_MS;
  const t4 = t3 + (isLast ? CRAWL_MS : 0);
  const t5 = t4 + SETTLE_MS;

  if (tMs <= 0) return startPx;
  if (tMs >= t5) return targetPx;

  // blurEnd is where the fast blur phase hands off to friction — one friction +
  // crawl span above the target.
  const blurEnd = targetPx + frictionPx + crawlPx;
  if (tMs < t1) {
    // Wind-up: strip pulls UP half a cell → offset rises ABOVE the start.
    return startPx + windupPx * easeOutQuad(tMs / t1);
  }
  if (tMs < t2) {
    // Accelerate downward from the wound-up position to blurEnd; easeInQuad ends
    // at max velocity, handing off to the decelerating friction phase.
    const from = startPx + windupPx;
    return from + (blurEnd - from) * easeInQuad((tMs - t1) / blur);
  }
  if (tMs < t3) {
    // Friction: descend the friction span, decelerating.
    return blurEnd - frictionPx * easeOutCubic((tMs - t2) / FRICTION_MS);
  }
  if (tMs < t4) {
    // Crawl: slow, readable, near-linear descent across the last two cells.
    return targetPx + crawlPx - crawlPx * easeOutQuad((tMs - t3) / CRAWL_MS);
  }
  // Settle: damped single overshoot BELOW the target (winner dips under the
  // payline), returning to rest. Mirror of the upward version's sign.
  const p = (tMs - t4) / SETTLE_MS;
  return targetPx - overshootPx * Math.sin(Math.PI * p) * (1 - p);
}

/**
 * 3D barrel curvature for a cell whose center is `distPx` from the window
 * center (positive = below). `radiusPx` is half the window height.
 */
export function cellCurve(
  distPx: number,
  radiusPx: number,
): {
  rotateXDeg: number;
  scale: number;
  brightness: number;
  translateZPx: number;
} {
  const n = Math.max(-1, Math.min(1, distPx / radiusPx));
  const a = Math.abs(n);
  return {
    rotateXDeg: -38 * n + 0, // coerce signed zero to unsigned zero
    scale: 1 - 0.18 * a,
    brightness: 1 - 0.45 * a,
    translateZPx: -46 * a + 0, // coerce signed zero to unsigned zero
  };
}

/** Cheap motion-blur illusion: vertical stretch + ghosting, transform-only. */
export function blurStretch(velocityPxPerMs: number): {
  scaleY: number;
  opacity: number;
} {
  const v = Math.abs(velocityPxPerMs);
  return {
    scaleY: 1 + Math.min(0.35, v * 0.06),
    opacity: 1 - Math.min(0.45, v * 0.08),
  };
}
