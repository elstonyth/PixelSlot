import {
  EMPTY_TOTALS,
  foldLedgerRow,
  totalsToUsd,
  type LedgerTotals,
} from "../credit-summary";

function foldAll(
  rows: { amount: number; reason: string; externalFundedCents: number }[],
): LedgerTotals {
  return rows.reduce(foldLedgerRow, EMPTY_TOTALS);
}

describe("foldLedgerRow + totalsToUsd (external-funded)", () => {
  it("accumulates balance, topup, spend, external balance and external spend", () => {
    // topup RM100 (external +10000), open RM75 consuming 7500 external,
    // buyback +RM45 (external 0), open RM50 consuming the remaining 2500 external.
    const rows = [
      { amount: 100, reason: "topup", externalFundedCents: 10000 },
      { amount: -75, reason: "pack_open", externalFundedCents: -7500 },
      { amount: 45, reason: "buyback", externalFundedCents: 0 },
      { amount: -50, reason: "pack_open", externalFundedCents: -2500 },
    ];
    const t = foldAll(rows);
    expect(t.balanceCents).toBe(2000); // 10000 - 7500 + 4500 - 5000
    expect(t.topupCents).toBe(10000);
    expect(t.spendCents).toBe(12500); // |−75| + |−50|
    expect(t.externalBalanceCents).toBe(0); // 10000 − 7500 − 2500
    expect(t.externalFundedSpendCents).toBe(10000); // 7500 + 2500 consumed
    expect(totalsToUsd(t)).toEqual({
      balance: 20,
      topupTotal: 100,
      spendTotal: 125,
      externalFundedSpendTotal: 100,
    });
  });

  it("treats a missing/NULL external column (old rows) as zero external", () => {
    const t = foldLedgerRow(EMPTY_TOTALS, {
      amount: -10,
      reason: "pack_open",
      externalFundedCents: 0,
    });
    expect(t.externalFundedSpendCents).toBe(0);
    expect(t.spendCents).toBe(1000);
  });

  it("only pack_open rows contribute to external spend, not adjustments", () => {
    const t = foldAll([
      { amount: -3, reason: "adjustment", externalFundedCents: 0 },
      { amount: -10, reason: "pack_open", externalFundedCents: -1000 },
    ]);
    expect(t.externalFundedSpendCents).toBe(1000);
  });

  it("the invariant externalSpend + externalBalance == external-in holds", () => {
    const rows = [
      { amount: 60, reason: "topup", externalFundedCents: 6000 },
      { amount: -25, reason: "pack_open", externalFundedCents: -2500 },
    ];
    const t = foldAll(rows);
    expect(t.externalFundedSpendCents + t.externalBalanceCents).toBe(6000);
  });
});
