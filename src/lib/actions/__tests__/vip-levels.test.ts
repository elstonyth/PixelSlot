import { describe, it, expect, vi } from 'vitest';

// vip.ts imports '@/lib/data/customer', which imports 'server-only' (throws
// outside an RSC and isn't an installed package) — stub it like
// src/lib/data/__tests__/profiles.test.ts does. mapVipLevels itself is pure
// and never touches auth, so no other mocking is needed.
vi.mock('server-only', () => ({}));

import { mapVipLevels } from '@/lib/actions/vip';

describe('mapVipLevels', () => {
  it('maps snake_case wire rows to camelCase VipLevel', () => {
    const out = mapVipLevels([
      {
        level: 2,
        threshold: 3.09,
        reward: {
          voucher_amount: 2,
          box_tier: 'a',
          frame_unlock: false,
          direct_referral_pct: 2,
        },
      },
    ]);
    expect(out).toEqual([
      {
        level: 2,
        threshold: 3.09,
        reward: {
          voucherAmount: 2,
          boxTier: 'a',
          frameUnlock: false,
          directReferralPct: 2,
        },
      },
    ]);
  });

  it('returns [] for an empty ladder', () => {
    expect(mapVipLevels([])).toEqual([]);
  });
});
