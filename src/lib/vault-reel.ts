// Pure spin physics + 3D barrel curvature for the Vault Room reel. No DOM, no
// React — see src/lib/__tests__/vault-reel.test.ts. Spec: slot-machine-redesign.md
// ("Momentum & Mass + final crawl" + timing masterplan).

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
 * Strip offset (px, 0 → targetPx) at time `tMs`. Piecewise:
 * wind-up (dips negative) → blur (ease-in to speed) → friction (ease-out) →
 * crawl (last column only, slow readable approach) → settle (damped overshoot).
 * Callers apply as `translateY(-offset)` (same sign convention as reelTargetY).
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
  const frictionPx = Math.min(itemH * 6, Math.max(0, targetPx - crawlPx));
  const overshootPx = itemH / 2;

  const t1 = WINDUP_MS;
  const t2 = t1 + blur;
  const t3 = t2 + FRICTION_MS;
  const t4 = t3 + (isLast ? CRAWL_MS : 0);
  const t5 = t4 + SETTLE_MS;

  if (tMs <= 0) return 0;
  if (tMs >= t5) return targetPx;

  const blurEnd = targetPx - frictionPx - crawlPx;
  if (tMs < t1) {
    return -windupPx * easeOutQuad(tMs / t1);
  }
  if (tMs < t2) {
    // Accelerate from the wound-up position to blurEnd; easeInQuad ends at max
    // velocity, handing off to the decelerating friction phase.
    return -windupPx + (blurEnd + windupPx) * easeInQuad((tMs - t1) / blur);
  }
  if (tMs < t3) {
    return blurEnd + frictionPx * easeOutCubic((tMs - t2) / FRICTION_MS);
  }
  if (tMs < t4) {
    // Crawl: slow, readable, near-linear approach across the last two cells.
    return targetPx - crawlPx + crawlPx * easeOutQuad((tMs - t3) / CRAWL_MS);
  }
  // Settle: damped single overshoot past the target, returning to rest.
  const p = (tMs - t4) / SETTLE_MS;
  return targetPx + overshootPx * Math.sin(Math.PI * p) * (1 - p);
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
