// Pure presentation helpers for the Transactions account page. Isomorphic (no
// server-only imports) so the server component can call them directly.
import type { CreditTxn } from '@/lib/actions/vault';
import { usd } from '@/lib/format';

const REASON_LABEL: Record<CreditTxn['reason'], string> = {
  topup: 'Top-up',
  pack_open: 'Pack open',
  buyback: 'Sell-back',
  adjustment: 'Adjustment',
};

export const reasonLabel = (reason: CreditTxn['reason']): string =>
  REASON_LABEL[reason];

/** "+$48.00" for credits, "-$25.00" for spends (amount carries the sign). */
export function signedUsd(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${usd(Math.abs(amount))}`;
}

/**
 * Rows are newest-first (API order). Returns each row with the balance the
 * account held immediately AFTER that transaction, derived by walking backward
 * from the current (authoritative, full-ledger) balance.
 */
export function withRunningBalance(
  rows: CreditTxn[],
  currentBalance: number,
): (CreditTxn & { balanceAfter: number })[] {
  let running = currentBalance;
  return rows.map((r) => {
    const balanceAfter = running;
    running = Math.round((running - r.amount) * 100) / 100; // balance before this row
    return { ...r, balanceAfter };
  });
}
