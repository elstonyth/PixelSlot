// src/modules/packs/vip-rewards.ts
export type RewardKind = 'voucher' | 'frame';
export type Reward = { kind: RewardKind; payload: Record<string, unknown> };

// Levels gained this open. L1 is a non-granting entry tier (D8): start at 2.
export function levelsToGrant(highestEver: number, newLevel: number): number[] {
  const start = Math.max(highestEver + 1, 2);
  const out: number[] = [];
  for (let L = start; L <= newLevel; L++) out.push(L);
  return out;
}

// Ladder rewards for ONE level (L≥2). Snapshot values into payload (immune to
// later admin ladder edits, like commission.effective_pct). Box tier derives
// live from vip_member_state at draw time (B6) — not granted per-rung. 'prize'
// is never granted here (D7).
// ponytail: box removed; tier resolves at draw time via settleRewardDraw (B6)
export function rewardsForLevel(row: {
  level: number;
  voucher_amount: number;
  box_tier: string;
  frame_unlock: boolean;
}): Reward[] {
  const out: Reward[] = [];
  if (Number(row.voucher_amount) > 0)
    out.push({
      kind: 'voucher',
      payload: { amount_myr: Number(row.voucher_amount) },
    });
  if (row.frame_unlock)
    out.push({ kind: 'frame', payload: { level: row.level } });
  return out;
}
