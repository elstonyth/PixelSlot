import { lockedCentsFromCommissions } from "../available-balance";

describe("lockedCentsFromCommissions", () => {
  const now = 1_000_000;
  it("locks pending and not-yet-matured commission", () => {
    const locked = lockedCentsFromCommissions(
      [
        { status: "available", matures_at_ms: now - 1, amount_cents: 500 }, // free
        { status: "pending", matures_at_ms: now - 1, amount_cents: 300 }, // locked (status)
        { status: "available", matures_at_ms: now + 1, amount_cents: 200 }, // locked (immature)
        { status: "suspended", matures_at_ms: now - 1, amount_cents: 100 }, // locked
        { status: "reversed", matures_at_ms: now - 1, amount_cents: 50 }, // locked
      ],
      now,
    );
    expect(locked).toBe(300 + 200 + 100 + 50);
  });
  it("locks nothing when all matured + available", () => {
    expect(
      lockedCentsFromCommissions(
        [{ status: "available", matures_at_ms: now - 10, amount_cents: 999 }],
        now,
      ),
    ).toBe(0);
  });
});
