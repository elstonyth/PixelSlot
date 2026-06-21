import {
  directReferralPctForLevel,
  directCommissionSen,
} from "../referral-commission";

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

describe("directReferralPctForLevel", () => {
  it("returns the exact band pct (1/2/3/4/5)", () => {
    expect(directReferralPctForLevel(1, LADDER)).toBe(1);
    expect(directReferralPctForLevel(10, LADDER)).toBe(2);
    expect(directReferralPctForLevel(20, LADDER)).toBe(3);
    expect(directReferralPctForLevel(40, LADDER)).toBe(4); // L40 = 4% (not blank)
    expect(directReferralPctForLevel(50, LADDER)).toBe(5);
    expect(directReferralPctForLevel(100, LADDER)).toBe(5);
  });
  it("throws when the level row is missing (no silent 0% commission)", () => {
    expect(() => directReferralPctForLevel(7, LADDER)).toThrow();
  });
});

describe("directCommissionSen", () => {
  it("computes pct of spend in sen (half-up)", () => {
    expect(directCommissionSen(10000, 5)).toBe(500); // 5% of RM100 = RM5
    expect(directCommissionSen(333, 20)).toBe(67); // half-up, matches pctOfSen
  });
  it("is 0 for non-positive spend (free open / guard)", () => {
    expect(directCommissionSen(0, 5)).toBe(0);
    expect(directCommissionSen(-100, 5)).toBe(0);
  });
});
