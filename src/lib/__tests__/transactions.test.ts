import { describe, it, expect } from 'vitest';
import { reasonLabel, signedUsd, withRunningBalance } from '@/lib/transactions';
import type { CreditTxn } from '@/lib/actions/vault';

describe('reasonLabel', () => {
  it('maps each reason to a human label', () => {
    expect(reasonLabel('topup')).toBe('Top-up');
    expect(reasonLabel('pack_open')).toBe('Pack open');
    expect(reasonLabel('buyback')).toBe('Sell-back');
    expect(reasonLabel('adjustment')).toBe('Adjustment');
  });
});

describe('signedUsd', () => {
  it('prefixes a sign and formats the magnitude', () => {
    expect(signedUsd(48)).toBe('+$48.00');
    expect(signedUsd(-25)).toBe('-$25.00');
    expect(signedUsd(0)).toBe('$0.00');
  });
});

describe('withRunningBalance', () => {
  it('walks newest-first rows back from the current balance', () => {
    const rows: CreditTxn[] = [
      { id: 'c', amount: 10, reason: 'buyback', createdAt: '2026-06-03' },
      { id: 'b', amount: -4, reason: 'pack_open', createdAt: '2026-06-02' },
      { id: 'a', amount: 20, reason: 'topup', createdAt: '2026-06-01' },
    ];
    const out = withRunningBalance(rows, 26);
    expect(out.map((r) => r.balanceAfter)).toEqual([26, 16, 20]);
  });
});
