// pickWonRow — pure weighted selection over any array of { weight: number }.
// Lives in the packs module as a dependency-free leaf (imports nothing) so BOTH
// the normal pack draw (roll-pack) AND the reward draw (draw-prize) can import it
// WITHOUT pulling in the packs module index → service. That keeps draw-prize a
// pure leaf, so service.ts can statically import drawPrize with no load-time cycle.
// ponytail: last-row fallback handles roll >= totalWeight (rounding / float drift).
// Empty input is a caller precondition violation (both current callers guard:
// drawPrize returns {kind:'nothing'} on no survivors, fetchPackData throws on
// empty odds) — fail loudly rather than return undefined for any future reuse.
export function pickWonRow<T extends { weight: number }>(
  rows: T[],
  roll: number,
): T {
  if (rows.length === 0) {
    throw new Error('pickWonRow: rows must be non-empty');
  }
  let won = rows[rows.length - 1];
  for (const r of rows) {
    roll -= r.weight;
    if (roll < 0) {
      won = r;
      break;
    }
  }
  return won;
}
