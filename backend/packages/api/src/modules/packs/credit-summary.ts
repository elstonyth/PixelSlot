// Pure aggregation over the credit ledger, factored out of the service so it is
// unit-testable without a DB. Money is 2dp USD decimals; summing in INTEGER
// CENTS avoids the float drift a running decimal sum accumulates over a long
// ledger. `amount` is signed: positive = credit, negative = spend.

export interface LedgerTotals {
  balanceCents: number;
  topupCents: number;
  spendCents: number;
}

// Frozen: this is the shared fold SEED. foldLedgerRow is non-mutating today, but
// freezing makes any future in-place mutation fail loudly instead of silently
// corrupting the singleton across concurrent requests.
export const EMPTY_TOTALS: Readonly<LedgerTotals> = Object.freeze({
  balanceCents: 0,
  topupCents: 0,
  spendCents: 0,
});

export function foldLedgerRow(
  acc: LedgerTotals,
  row: { amount: number; reason: string },
): LedgerTotals {
  const cents = Math.round(row.amount * 100);
  return {
    balanceCents: acc.balanceCents + cents,
    topupCents: acc.topupCents + (cents > 0 && row.reason === "topup" ? cents : 0),
    spendCents: acc.spendCents + (cents < 0 ? -cents : 0),
  };
}

export function totalsToUsd(t: LedgerTotals): {
  balance: number;
  topupTotal: number;
  spendTotal: number;
} {
  return {
    balance: t.balanceCents / 100,
    topupTotal: t.topupCents / 100,
    spendTotal: t.spendCents / 100,
  };
}
