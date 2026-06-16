import {
  EMPTY_TOTALS,
  foldLedgerRow,
  totalsToUsd,
} from "../credit-summary";

describe("credit-summary fold", () => {
  it("sums balance in cents, accumulating top-ups and spends separately", () => {
    const rows = [
      { amount: 50, reason: "topup" },
      { amount: -10, reason: "pack_open" },
      { amount: 9, reason: "buyback" }, // a credit, but NOT a top-up
      { amount: -2.5, reason: "adjustment" }, // negative adjustment = a spend
    ];
    const totals = rows.reduce(foldLedgerRow, EMPTY_TOTALS);
    expect(totalsToUsd(totals)).toEqual({
      balance: 46.5, // 50 - 10 + 9 - 2.5
      topupTotal: 50, // only the topup row
      spendTotal: 12.5, // |−10| + |−2.5|
    });
  });

  it("avoids float drift on half-cent amounts", () => {
    const rows = [
      { amount: 0.1, reason: "topup" },
      { amount: 0.2, reason: "topup" },
    ];
    const totals = rows.reduce(foldLedgerRow, EMPTY_TOTALS);
    expect(totalsToUsd(totals).balance).toBe(0.3);
    expect(totalsToUsd(totals).topupTotal).toBe(0.3);
  });

  it("treats a positive adjustment as a credit but not a top-up or spend", () => {
    const totals = foldLedgerRow(EMPTY_TOTALS, { amount: 5, reason: "adjustment" });
    expect(totalsToUsd(totals)).toEqual({
      balance: 5,
      topupTotal: 0,
      spendTotal: 0,
    });
  });
});
