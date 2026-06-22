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

export type OverrideStep = { generation: number; amountSen: number };

// Team override (Phase 2b) — the second referral layer. For each ancestor ABOVE
// the direct sponsor, a flat `overridePercent` of the PRIOR generation's
// commission, decaying up the tree. override[1] = the direct commission (not
// returned here); this returns depths 2..N. Decay compounds on the ROUNDED parent
// (pctOfSen matches the ledger ROUND). Terminate BEFORE a generation when the RAW
// pre-round product < 1 sen — never pay a sen "born" from rounding a sub-sen value
// up (master §7 / spec D1). `generation` IS absolute tree depth.
// `overrideGenerationCap` is a defensive backstop: self-termination at <1 sen
// trips first for any realistic base, so a schedule that reaches the cap is an
// anomaly the caller logs.
export function teamOverrideSchedule(
  directCommissionSen: number,
  overridePercent: number,
  overrideGenerationCap: number,
): OverrideStep[] {
  const out: OverrideStep[] = [];
  let prev = directCommissionSen; // override[1] (depth 1 = direct sponsor)
  for (let depth = 2; depth <= overrideGenerationCap; depth++) {
    if ((prev * overridePercent) / 100 < 1) break; // raw pre-round < 1 sen -> stop
    const amountSen = pctOfSen(prev, overridePercent);
    out.push({ generation: depth, amountSen });
    prev = amountSen;
  }
  return out;
}
