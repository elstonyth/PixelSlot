import {
  directReferralPctForLevel,
  directCommissionSen,
  teamOverrideSchedule,
} from '../referral-commission';

const LADDER = [
  { level: 1, direct_referral_pct: 1 },
  { level: 9, direct_referral_pct: 1 },
  { level: 10, direct_referral_pct: 2 },
  { level: 20, direct_referral_pct: 3 },
  { level: 30, direct_referral_pct: 4 },
  { level: 40, direct_referral_pct: 4 },
  { level: 50, direct_referral_pct: 5 },
  { level: 100, direct_referral_pct: 5 },
];

describe('directReferralPctForLevel', () => {
  it('returns the exact band pct (1/2/3/4/5)', () => {
    expect(directReferralPctForLevel(1, LADDER)).toBe(1);
    expect(directReferralPctForLevel(10, LADDER)).toBe(2);
    expect(directReferralPctForLevel(20, LADDER)).toBe(3);
    expect(directReferralPctForLevel(40, LADDER)).toBe(4); // L40 = 4% (not blank)
    expect(directReferralPctForLevel(50, LADDER)).toBe(5);
    expect(directReferralPctForLevel(100, LADDER)).toBe(5);
  });
  it('throws when the level row is missing (no silent 0% commission)', () => {
    expect(() => directReferralPctForLevel(7, LADDER)).toThrow();
  });
});

describe('directCommissionSen', () => {
  it('computes pct of spend in sen (half-up)', () => {
    expect(directCommissionSen(10000, 5)).toBe(500); // 5% of RM100 = RM5
    expect(directCommissionSen(333, 20)).toBe(67); // half-up, matches pctOfSen
  });
  it('is 0 for non-positive spend (free open / guard)', () => {
    expect(directCommissionSen(0, 5)).toBe(0);
    expect(directCommissionSen(-100, 5)).toBe(0);
  });
});

describe('teamOverrideSchedule', () => {
  it('matches the golden vector (direct 10000 -> 2000,400,80,16,3, stop)', () => {
    expect(teamOverrideSchedule(10000, 20, 100)).toEqual([
      { generation: 2, amountSen: 2000 },
      { generation: 3, amountSen: 400 },
      { generation: 4, amountSen: 80 },
      { generation: 5, amountSen: 16 },
      { generation: 6, amountSen: 3 },
    ]);
  });

  it('terminates on the RAW pre-round product, not the rounded value', () => {
    // prev=3 -> 3*0.2=0.6 raw < 1 -> NOTHING paid (the rounded-up 1 is suppressed).
    expect(teamOverrideSchedule(3, 20, 100)).toEqual([]);
    // prev=5 -> 5*0.2=1.0 raw (not < 1) -> pays exactly 1 sen, then 1*0.2=0.2 < 1 stops.
    expect(teamOverrideSchedule(5, 20, 100)).toEqual([
      { generation: 2, amountSen: 1 },
    ]);
  });

  it('respects the rounding-aware bound (exceeds bare 0.25x at small bases)', () => {
    const s = teamOverrideSchedule(38, 20, 100); // 38 -> [8, 2]
    const total = s.reduce((a, r) => a + r.amountSen, 0);
    expect(s).toEqual([
      { generation: 2, amountSen: 8 },
      { generation: 3, amountSen: 2 },
    ]);
    expect(total).toBe(10);
    expect(total).toBeGreaterThan(0.25 * 38); // 10 > 9.5 — bare 0.25x is FALSE
    expect(total).toBeLessThanOrEqual(0.25 * 38 + s.length); // rounding-aware bound holds
  });

  it('caps the schedule depth at overrideGenerationCap (defensive)', () => {
    // A base so large it cannot self-terminate by depth 3 -> the cap truncates it.
    expect(
      teamOverrideSchedule(10_000_000_000, 20, 3).map((r) => r.generation),
    ).toEqual([2, 3]);
  });

  it('returns no overrides for a non-positive direct commission', () => {
    expect(teamOverrideSchedule(0, 20, 100)).toEqual([]);
    expect(teamOverrideSchedule(-100, 20, 100)).toEqual([]);
  });

  it("enforces strict decay so a misconfigured override rate can't run away to the cap", () => {
    // Defense-in-depth: the function documents "decaying" + "self-terminates", but
    // half-up rounding has a FIXED POINT at >=75% (pctOfSen(2,75)=2, never < 1 sen)
    // and the amounts GROW at >=100%. Without enforcing decay these pay
    // overrideGenerationCap-many ancestors (or explode) on every settled open.
    // A misconfigured rate must strictly decay and stop, NOT reach the cap.

    // 75% (half-up fixed point): must terminate far short of the cap (was: length 99).
    const fixedPoint = teamOverrideSchedule(100, 75, 100);
    expect(fixedPoint.length).toBeLessThan(50);
    expect(fixedPoint[fixedPoint.length - 1].generation).toBeLessThan(100);

    // >=100% (e.g. team_override_pct entered as 2.0 -> overridePct 200): NO growing
    // tail -- no override amount may exceed the basis it decays from.
    expect(
      teamOverrideSchedule(100, 200, 100).every((s) => s.amountSen < 100),
    ).toBe(true);

    // Strictly monotonic decrease for every rate, including misconfigured ones.
    for (const pct of [20, 75, 99, 200, 2000]) {
      const s = teamOverrideSchedule(100, pct, 100);
      for (let i = 1; i < s.length; i++) {
        expect(s[i].amountSen).toBeLessThan(s[i - 1].amountSen);
      }
    }
  });
});
