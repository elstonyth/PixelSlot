import { describe, it, expect } from 'vitest';
import { levelProgressPct } from '../vip-map';

describe('levelProgressPct', () => {
  it('restarts at each level — mid-segment spend is ~48%, not ~98%', () => {
    // LV85 → LV86 from the 2026-07-22 report: spend 1,864,328 inside
    // [1,832,540 .. 1,898,770] used to render ~98% (spend / end).
    expect(levelProgressPct(1_864_328, 1_832_540, 1_898_770)).toBe(48);
  });

  it('clamps below the segment to 0 and above it to 100', () => {
    expect(levelProgressPct(50, 100, 200)).toBe(0);
    expect(levelProgressPct(250, 100, 200)).toBe(100);
  });

  it('treats degenerate segments (end <= start) as complete', () => {
    expect(levelProgressPct(0, 0, 0)).toBe(100);
    expect(levelProgressPct(5, 10, 10)).toBe(100);
  });
});
