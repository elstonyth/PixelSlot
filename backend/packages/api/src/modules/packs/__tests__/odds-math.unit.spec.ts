import { computeOdds, TOTAL_BPS, type OddsInput } from "../odds-math";

const sumWeight = (computed: { weight: number }[]) =>
  computed.reduce((s, c) => s + c.weight, 0);

// Helpers to build entries.
const unlocked = (card_id: string): OddsInput => ({ card_id, locked: false, pct: 0 });
const locked = (card_id: string, pct: number): OddsInput => ({ card_id, locked: true, pct });

describe("computeOdds — even-split invariants", () => {
  it("splits evenly across all-unlocked cards and sums to exactly 10000 bps", () => {
    const entries = ["a", "b", "c", "d"].map(unlocked);
    const { computed, error } = computeOdds(entries);
    expect(error).toBeNull();
    expect(sumWeight(computed)).toBe(TOTAL_BPS);
    // 10000 / 4 = 2500 each, no remainder.
    expect(computed.map((c) => c.weight)).toEqual([2500, 2500, 2500, 2500]);
  });

  it("distributes the rounding remainder so the total is still exactly 10000", () => {
    // 10000 / 7 = 1428 r4 → four cards get 1429, three get 1428.
    const entries = ["a", "b", "c", "d", "e", "f", "g"].map(unlocked);
    const { computed, error } = computeOdds(entries);
    expect(error).toBeNull();
    expect(sumWeight(computed)).toBe(TOTAL_BPS);
    const weights = computed.map((c) => c.weight).sort((x, y) => x - y);
    expect(weights).toEqual([1428, 1428, 1428, 1429, 1429, 1429, 1429]);
  });

  it("locks one card and splits the remainder evenly among the rest (advisor example)", () => {
    // Lock A=40% → other 3 split 60% evenly (2000 bps each).
    const entries = [locked("a", 40), unlocked("b"), unlocked("c"), unlocked("d")];
    const { computed, error } = computeOdds(entries);
    expect(error).toBeNull();
    expect(sumWeight(computed)).toBe(TOTAL_BPS);
    const byId = Object.fromEntries(computed.map((c) => [c.card_id, c.weight]));
    expect(byId.a).toBe(4000);
    expect(byId.b).toBe(2000);
    expect(byId.c).toBe(2000);
    expect(byId.d).toBe(2000);
  });

  it("locks two cards and splits the remainder among the rest", () => {
    // Lock A=40%, B=20% → others split 40% evenly.
    const entries = [locked("a", 40), locked("b", 20), unlocked("c"), unlocked("d")];
    const { computed } = computeOdds(entries);
    const byId = Object.fromEntries(computed.map((c) => [c.card_id, c.weight]));
    expect(byId.a).toBe(4000);
    expect(byId.b).toBe(2000);
    expect(byId.c).toBe(2000);
    expect(byId.d).toBe(2000);
    expect(sumWeight(computed)).toBe(TOTAL_BPS);
  });

  it("supports fractional locked percentages (2 dp → bps)", () => {
    const entries = [locked("a", 12.5), unlocked("b"), unlocked("c")];
    const { computed, error } = computeOdds(entries);
    expect(error).toBeNull();
    const byId = Object.fromEntries(computed.map((c) => [c.card_id, c.weight]));
    expect(byId.a).toBe(1250); // 12.5% = 1250 bps
    // remainder 8750 / 2 = 4375 each.
    expect(byId.b).toBe(4375);
    expect(byId.c).toBe(4375);
    expect(sumWeight(computed)).toBe(TOTAL_BPS);
  });

  it("is order-independent: the same set in any order yields the same per-card weights", () => {
    const a = [locked("x", 33.33), unlocked("a"), unlocked("b"), unlocked("c")];
    const b = [unlocked("c"), unlocked("a"), locked("x", 33.33), unlocked("b")];
    const wa = Object.fromEntries(computeOdds(a).computed.map((c) => [c.card_id, c.weight]));
    const wb = Object.fromEntries(computeOdds(b).computed.map((c) => [c.card_id, c.weight]));
    expect(wa).toEqual(wb);
    expect(sumWeight(computeOdds(a).computed)).toBe(TOTAL_BPS);
  });
});

describe("computeOdds — validation", () => {
  it("rejects when locked rates exceed 100%", () => {
    const { error } = computeOdds([locked("a", 60), locked("b", 50)]);
    expect(error).toMatch(/exceed 100%/i);
  });

  it("rejects when every card is locked but the total is not exactly 100%", () => {
    const { error } = computeOdds([locked("a", 40), locked("b", 40)]);
    expect(error).toMatch(/total exactly 100%/i);
  });

  it("accepts when every card is locked and the total is exactly 100%", () => {
    const { computed, error } = computeOdds([locked("a", 70), locked("b", 30)]);
    expect(error).toBeNull();
    expect(sumWeight(computed)).toBe(TOTAL_BPS);
  });

  it("allows locked cards to sum to 100% with unlocked cards going to 0%", () => {
    const entries = [locked("a", 100), unlocked("b"), unlocked("c")];
    const { computed, error } = computeOdds(entries);
    expect(error).toBeNull();
    const byId = Object.fromEntries(computed.map((c) => [c.card_id, c.weight]));
    expect(byId.a).toBe(TOTAL_BPS);
    expect(byId.b).toBe(0);
    expect(byId.c).toBe(0);
  });

  it("rejects an out-of-range locked percentage", () => {
    expect(computeOdds([locked("a", 150), unlocked("b")]).error).toMatch(/between 0% and 100%/i);
    expect(computeOdds([locked("a", -5), unlocked("b")]).error).toMatch(/between 0% and 100%/i);
  });

  it("rejects an empty entry set", () => {
    expect(computeOdds([]).error).toMatch(/no cards/i);
  });
});
