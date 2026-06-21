import { VIP_LEVELS } from '../../../scripts/vip-levels.data';

describe('VIP_LEVELS data', () => {
  it('has exactly 100 rows, levels 1..100 unique', () => {
    expect(VIP_LEVELS).toHaveLength(100);
    const levels = VIP_LEVELS.map((r) => r.level);
    expect(new Set(levels).size).toBe(100);
    expect(Math.min(...levels)).toBe(1);
    expect(Math.max(...levels)).toBe(100);
  });

  it('has strictly increasing whole-MYR thresholds 0..3,000,000', () => {
    const byLevel = [...VIP_LEVELS].sort((a, b) => a.level - b.level);
    expect(byLevel[0].spend_threshold).toBe(0);
    expect(byLevel[99].spend_threshold).toBe(3_000_000);
    for (let i = 1; i < byLevel.length; i++) {
      expect(byLevel[i].spend_threshold).toBeGreaterThan(
        byLevel[i - 1].spend_threshold,
      );
      expect(Number.isInteger(byLevel[i].spend_threshold)).toBe(true);
    }
  });

  it('has the agreed referral-% bands (L40=4, L50-100=5)', () => {
    const at = (lvl: number) =>
      VIP_LEVELS.find((r) => r.level === lvl)!.direct_referral_pct;
    expect(at(1)).toBe(1);
    expect(at(40)).toBe(4);
    expect(at(50)).toBe(5);
    expect(at(100)).toBe(5);
  });

  it('unlocks a frame at every 10th level and Z box at 100', () => {
    for (const r of VIP_LEVELS) {
      expect(r.frame_unlock).toBe(r.level % 10 === 0);
    }
    expect(VIP_LEVELS.find((r) => r.level === 100)!.box_tier).toBe('Z');
  });
});
