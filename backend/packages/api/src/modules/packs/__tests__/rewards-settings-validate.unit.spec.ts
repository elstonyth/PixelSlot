import { validateRewardsPatch } from '../rewards-settings-validate';

describe('validateRewardsPatch — clamp rules', () => {
  test('rejects a non-decaying / out-of-range / fractional override pct', () => {
    expect(() => validateRewardsPatch({ teamOverridePct: 1 })).toThrow(/between 0 and 1/i);
    expect(() => validateRewardsPatch({ teamOverridePct: 0 })).toThrow(/between 0 and 1/i);
    expect(() => validateRewardsPatch({ teamOverridePct: 0.205 })).toThrow(/whole percent/i);
    expect(() => validateRewardsPatch({ commissionCooldownDays: -1 })).toThrow(/>= 0/);
    expect(() => validateRewardsPatch({ overrideGenerationCap: 0 })).toThrow(/>= 1/);
  });

  test('accepts a valid decaying whole-percent patch', () => {
    expect(
      validateRewardsPatch({ teamOverridePct: 0.2, commissionCooldownDays: 3, overrideGenerationCap: 100 }),
    ).toEqual({ teamOverridePct: 0.2, commissionCooldownDays: 3, overrideGenerationCap: 100 });
  });

  test('rejects an empty patch (no recognised fields)', () => {
    expect(() => validateRewardsPatch({})).toThrow(/no valid settings/i);
  });

  test('accepts partial patch — only commissionCooldownDays', () => {
    expect(validateRewardsPatch({ commissionCooldownDays: 0 })).toEqual({
      commissionCooldownDays: 0,
    });
  });

  test('accepts partial patch — only overrideGenerationCap', () => {
    expect(validateRewardsPatch({ overrideGenerationCap: 1 })).toEqual({
      overrideGenerationCap: 1,
    });
  });

  test('rejects non-object body', () => {
    expect(() => validateRewardsPatch(null)).toThrow();
    expect(() => validateRewardsPatch('string')).toThrow();
  });
});
