// Even-split odds math — MIRROR of the backend's authoritative copy at
// packages/api/src/modules/packs/odds-math.ts. The admin form's live preview
// MUST compute byte-identically to the save workflow, or the preview would lie
// about what gets persisted. Everything below this header is kept verbatim in
// lock-step with the API copy.

export const TOTAL_BPS = 10000;

export interface OddsInput {
  card_id: string;
  locked: boolean;
  /** Win % (0–100) for locked cards. Ignored (recomputed) for unlocked cards. */
  pct: number;
}

export interface ComputedOdd {
  card_id: string;
  /** Basis points (1% = 100 bps). Σ over a pack == TOTAL_BPS when valid. */
  weight: number;
  locked: boolean;
  /** weight / 100 — the resulting win %, for display. */
  pct: number;
}

export interface OddsResult {
  /** Per-card result, in the SAME order as the input. Always populated
   *  (best-effort) so the preview renders even while `error` is set. */
  computed: ComputedOdd[];
  /** Non-null when the configuration is invalid and must NOT be saved. */
  error: string | null;
  /** Σ of locked win rates, as a % (for the form summary). */
  lockedTotalPct: number;
  unlockedCount: number;
}

const clampBps = (bps: number): number => Math.max(0, Math.min(TOTAL_BPS, bps));

/**
 * Compute the normalized per-card odds for a pack from the editor's entries.
 * Never throws — invalid input yields a best-effort `computed` plus a non-null
 * `error` (the workflow rejects on `error`; the form disables Save on `error`).
 */
export function computeOdds(entries: OddsInput[]): OddsResult {
  const safe = Array.isArray(entries) ? entries : [];
  const unlocked = safe.filter((e) => e.locked === false);

  let error: string | null = null;
  let lockedBpsTotal = 0;
  const lockedBpsById = new Map<string, number>();

  for (const e of safe) {
    if (!e.locked) continue;
    const pct = Number(e.pct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      error ??= "Each locked win rate must be between 0% and 100%.";
    }
    const bps = clampBps(Math.round((Number.isFinite(pct) ? pct : 0) * 100));
    lockedBpsById.set(e.card_id, bps);
    lockedBpsTotal += bps;
  }

  if (safe.length === 0) error ??= "No cards to configure.";
  if (lockedBpsTotal > TOTAL_BPS) error ??= "Locked win rates exceed 100%.";
  if (unlocked.length === 0 && lockedBpsTotal !== TOTAL_BPS) {
    error ??= "With every card locked, win rates must total exactly 100%.";
  }

  // Even-split the remainder across the unlocked cards. Distribute the rounding
  // leftover to the lowest card_ids so the result is order-independent (the
  // preview and the save compute byte-identically).
  const remainder = Math.max(0, TOTAL_BPS - lockedBpsTotal);
  const n = unlocked.length;
  const base = n > 0 ? Math.floor(remainder / n) : 0;
  const leftoverCount = n > 0 ? remainder - base * n : 0;
  const leftoverIds = new Set(
    unlocked
      .map((e) => e.card_id)
      .sort()
      .slice(0, leftoverCount),
  );

  const computed: ComputedOdd[] = safe.map((e) => {
    const weight = e.locked
      ? lockedBpsById.get(e.card_id) ?? 0
      : base + (leftoverIds.has(e.card_id) ? 1 : 0);
    return { card_id: e.card_id, weight, locked: e.locked, pct: weight / 100 };
  });

  return {
    computed,
    error,
    lockedTotalPct: lockedBpsTotal / 100,
    unlockedCount: n,
  };
}
