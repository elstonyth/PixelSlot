// Pure available/locked fold (DB-free, unit-testable). A commission credit is
// LOCKED — not yet spendable — while its lifecycle status is anything but
// 'available', OR while it has not matured (now < matures_at). Maturity is a
// READ-TIME predicate (the authoritative, drift-proof gate); a materialized
// status is denormalization only. Inputs/outputs are integer sen.
export type CommissionLockRow = {
  status: string;
  matures_at_ms: number;
  amount_cents: number;
};

export function lockedCentsFromCommissions(
  rows: CommissionLockRow[],
  nowMs: number,
): number {
  let locked = 0;
  for (const r of rows) {
    const immature = nowMs < r.matures_at_ms;
    const heldByStatus = r.status !== 'available';
    if (immature || heldByStatus) locked += Math.max(0, r.amount_cents);
  }
  return locked;
}
