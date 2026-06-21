import { pctOfSen } from './money';

// Pure direct-referral commission math (DB-free, unit-testable like vip-ladder).
// Phase 2a is direct-only; the override DAG (team_override) is Phase 2b.

export type LadderPctRow = { level: number; direct_referral_pct: number };

// The direct-referral percent earned by a sponsor AT a given level. Every level
// 1..100 has a pct in [1,5] (no null/blank — L40 = 4%, spec §18). A missing row
// is a seed/config bug, not a 0% payout — throw rather than silently underpay.
export function directReferralPctForLevel(
  level: number,
  ladder: LadderPctRow[],
): number {
  const row = ladder.find((r) => r.level === level);
  if (!row) {
    throw new Error(`directReferralPctForLevel: no ladder row for level ${level}`);
  }
  return row.direct_referral_pct;
}

// Direct commission in sen for a recruit's external-funded open of `recruitSpendSen`
// at the sponsor's `pct`. Half-up via pctOfSen (matches the ledger ROUND). Never
// negative; 0 when there is no positive basis (free open).
export function directCommissionSen(
  recruitSpendSen: number,
  pct: number,
): number {
  if (recruitSpendSen <= 0 || pct <= 0) return 0;
  return pctOfSen(recruitSpendSen, pct);
}
