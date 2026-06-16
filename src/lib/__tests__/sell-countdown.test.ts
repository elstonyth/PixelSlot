import { describe, it, expect } from 'vitest';
import { SELL_COUNTDOWN_SECS, sellSecondsLeft } from '@/lib/sell-countdown';

describe('SELL_COUNTDOWN_SECS', () => {
  it('is the strict 30s display window', () => {
    expect(SELL_COUNTDOWN_SECS).toBe(30);
  });
});

describe('sellSecondsLeft', () => {
  it('rounds partial seconds up and never goes below zero', () => {
    const now = 1_000_000;
    expect(sellSecondsLeft(now + 30_000, now)).toBe(30);
    expect(sellSecondsLeft(now + 1, now)).toBe(1); // partial rounds up
    expect(sellSecondsLeft(now, now)).toBe(0);
    expect(sellSecondsLeft(now - 5_000, now)).toBe(0); // never negative
  });
});
