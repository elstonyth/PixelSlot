import { cardByHandle, makeRarityOf, toCardView } from "../card-view";

const card = {
  handle: "pikachu-001",
  name: "Pikachu",
  set: "Base",
  grader: "PSA",
  grade: "10",
  market_value: "0.15",
  image: "/p.png",
};

describe("cardByHandle", () => {
  it("indexes cards by handle", () => {
    const m = cardByHandle([card]);
    expect(m.get("pikachu-001")).toBe(card);
    expect(m.size).toBe(1);
  });
});

describe("makeRarityOf", () => {
  const odds = [{ pack_id: "p1", card_id: "pikachu-001", rarity: "Epic" }];
  it("looks rarity up by (pack, card) pair", () => {
    const rarityOf = makeRarityOf(odds);
    expect(rarityOf("p1", "pikachu-001")).toBe("Epic");
  });
  it("defaults missing pairs to Common", () => {
    const rarityOf = makeRarityOf(odds);
    expect(rarityOf("p9", "nope")).toBe("Common");
  });
});

describe("toCardView", () => {
  it("shapes the canonical 8-field card view with money-normalized FMV", () => {
    expect(toCardView(card, "Epic")).toEqual({
      handle: "pikachu-001",
      name: "Pikachu",
      set: "Base",
      grader: "PSA",
      grade: "10",
      rarity: "Epic",
      market_value: 0.15,
      image: "/p.png",
    });
  });
});
